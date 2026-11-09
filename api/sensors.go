package main

import (
	"context"
	"net/http"
	"strconv"
	"time"
)

type sensorPoint struct {
	ReceivedAt time.Time `json:"received_at"`
	Source     string    `json:"source"`
	StandID    *int      `json:"stand_id"`
	Metric     string    `json:"metric"`
	Value      float64   `json:"value"`
}

func (s *server) latestSensors(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := queryContext(r)
	defer cancel()

	items, err := s.querySensors(ctx, `
		SELECT DISTINCT ON (source, stand_id, metric)
			received_at, source, stand_id, metric, value
		FROM sensor_readings
		ORDER BY source, stand_id, metric, received_at DESC
	`)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (s *server) historySensors(w http.ResponseWriter, r *http.Request) {
	span, err := parseRange(r)
	if err != nil {
		writeBadRequest(w, err.Error())
		return
	}

	query := `
		SELECT received_at, source, stand_id, metric, value
		FROM sensor_readings
		WHERE received_at >= $1 AND received_at < $2
	`
	args := []any{span.From, span.To}
	next := 3

	if source := r.URL.Query().Get("source"); source != "" {
		if source != "demodata" && source != "stand" && source != "demo_lathe" {
			writeBadRequest(w, "source must be demodata, stand or demo_lathe")
			return
		}
		query += " AND source = $" + strconv.Itoa(next)
		args = append(args, source)
		next++
	}
	if raw := r.URL.Query().Get("stand"); raw != "" {
		standID, err := parseStandID(raw)
		if err != nil {
			writeBadRequest(w, err.Error())
			return
		}
		query += " AND stand_id = $" + strconv.Itoa(next)
		args = append(args, standID)
		next++
	}
	if metric := r.URL.Query().Get("metric"); metric != "" {
		if metric != "temp" && metric != "humidity" {
			writeBadRequest(w, "metric must be temp or humidity")
			return
		}
		query += " AND metric = $" + strconv.Itoa(next)
		args = append(args, metric)
		next++
	}
	query += " ORDER BY received_at LIMIT $" + strconv.Itoa(next)
	args = append(args, historyLimit+1)

	ctx, cancel := queryContext(r)
	defer cancel()
	items, err := s.querySensors(ctx, query, args...)
	if err != nil {
		writeError(w, err)
		return
	}
	writeHistory(w, span, items)
}

func (s *server) querySensors(ctx context.Context, query string, args ...any) ([]sensorPoint, error) {
	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]sensorPoint, 0)
	for rows.Next() {
		var item sensorPoint
		if err := rows.Scan(&item.ReceivedAt, &item.Source, &item.StandID, &item.Metric, &item.Value); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}
