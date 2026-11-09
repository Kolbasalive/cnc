package main

import (
	"context"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func saveMQTT(ctx context.Context, pool *pgxpool.Pool, topic, valueText string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	receivedAt := time.Now()
	valueText = strings.TrimSpace(valueText)

	var valueNum *float64
	if n, err := strconv.ParseFloat(valueText, 64); err == nil {
		valueNum = &n
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
		INSERT INTO mqtt_messages (received_at, topic, value_num, value_text)
		VALUES ($1, $2, $3, $4)
	`, receivedAt, topic, valueNum, valueText)
	if err != nil {
		return err
	}

	if source, standID, metric, ok := classifySensor(topic); ok {
		if valueNum == nil {
			logger.Printf("MQTT SKIP sensor_readings: topic=%s value=%q\n", topic, valueText)
		} else {
			_, err = tx.Exec(ctx, `
				INSERT INTO sensor_readings (received_at, source, stand_id, metric, value)
				VALUES ($1, $2, $3, $4, $5)
			`, receivedAt, source, standID, metric, *valueNum)
			if err != nil {
				return err
			}
		}
	}

	if signal, ok := classifyLathe(topic); ok {
		_, err = tx.Exec(ctx, `
			INSERT INTO demo_lathe_signals (received_at, signal, value_num, value_text)
			VALUES ($1, $2, $3, $4)
		`, receivedAt, signal, valueNum, valueText)
		if err != nil {
			return err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	logger.Printf("MQTT SAVED: %s | %s | %s\n", receivedAt.Format(time.RFC3339), topic, valueText)
	return nil
}

func classifySensor(topic string) (source string, standID *int, metric string, ok bool) {
	switch topic {
	case "demodata/temp":
		return "demodata", nil, "temp", true
	case "demodata/hump":
		return "demodata", nil, "humidity", true
	case "cncmqtt/temp":
		return "demo_lathe", nil, "temp", true
	case "cncmqtt/hump":
		return "demo_lathe", nil, "humidity", true
	}

	rest, found := strings.CutPrefix(topic, "sensor/")
	if !found || len(rest) < 2 {
		return "", nil, "", false
	}

	switch rest[0] {
	case 't':
		metric = "temp"
	case 'h':
		metric = "humidity"
	default:
		return "", nil, "", false
	}

	stand, err := strconv.Atoi(rest[1:])
	if err != nil || (stand != 3 && stand != 5) {
		return "", nil, "", false
	}
	return "stand", &stand, metric, true
}

func classifyLathe(topic string) (string, bool) {
	rest, found := strings.CutPrefix(topic, "cnc/lathe/")
	if !found || rest == "" {
		return "", false
	}
	switch rest {
	case "x", "z", "program":
		return rest, true
	case "programpercent":
		return "program_percent", true
	default:
		return "", false
	}
}
