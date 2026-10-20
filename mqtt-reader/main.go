
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/jackc/pgx/v5/pgxpool"
)

const pollInterval = 5 * time.Second

type CNCResponse struct {
	Data []json.RawMessage `json:"data"`
}

type CNCSections map[string]map[string]string

func parseCNCResponse(body []byte) (CNCSections, error) {
	var response CNCResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("parse JSON: %w", err)
	}

	sections := make(CNCSections)

	for _, rawSection := range response.Data {
		var section []json.RawMessage
		if err := json.Unmarshal(rawSection, &section); err != nil {
			return nil, fmt.Errorf("parse section: %w", err)
		}
		if len(section) < 2 {
			continue
		}

		var sectionName string
		if err := json.Unmarshal(section[0], &sectionName); err != nil {
			continue
		}

		var rows [][]string
		if err := json.Unmarshal(section[1], &rows); err != nil {
			continue
		}

		values := make(map[string]string)
		for _, row := range rows {
			if len(row) >= 2 {
				values[row[0]] = row[1]
			}
		}

		sections[sectionName] = values
	}

	return sections, nil
}

func getValue(sections CNCSections, section, key string) string {
	if values, ok := sections[section]; ok {
		return values[key]
	}
	return ""
}

func parsePercent(value string) *int {
	value = strings.TrimSpace(strings.TrimSuffix(value, "%"))
	if value == "" {
		return nil
	}

	n, err := strconv.Atoi(value)
	if err != nil {
		return nil
	}
	return &n
}

func fetchCNC(
	ctx context.Context,
	client *http.Client,
	pool *pgxpool.Pool,
	standID int,
) {
	url := fmt.Sprintf("https://cnc.kovalev.team/get/%d", standID)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		fmt.Printf("HTTP request error: stand=%d error=%v\n", standID, err)
		return
	}

	resp, err := client.Do(req)
	if err != nil {
		if ctx.Err() == nil {
			fmt.Printf("HTTP ERROR: stand=%d error=%v\n", standID, err)
		}
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		fmt.Printf("HTTP STATUS ERROR: stand=%d status=%s\n",
			standID, resp.Status)
		return
	}

	// Ограничиваем размер ответа, чтобы не читать бесконечный поток.
	body, err := io.ReadAll(io.LimitReader(resp.Body, 2*1024*1024+1))
	if err != nil {
		fmt.Printf("HTTP BODY ERROR: stand=%d error=%v\n", standID, err)
		return
	}
	if len(body) > 2*1024*1024 {
		fmt.Printf("HTTP BODY TOO LARGE: stand=%d\n", standID)
		return
	}

	sections, err := parseCNCResponse(body)
	if err != nil {
		fmt.Printf("JSON ERROR: stand=%d error=%v\n", standID, err)
		return
	}

	var payload json.RawMessage = body
	var programPercent *int

	core := sections["Моточасы"]
	channel := sections["Канал 1"]

	programPercent = parsePercent(
		channel["Процент выполнения программы"],
	)

	_, err = pool.Exec(ctx, `
		INSERT INTO cnc_status_snapshots (
			stand_id,
			received_at,
			core_runtime_total,
			core_runtime_current,
			core_restarts,
			channel_count,
			channel_runtime_total,
			channel_runtime_current,
			status,
			mode,
			program_time,
			program_percent,
			program_name,
			sections,
			payload
		)
		VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8,
			$9, $10, $11, $12, $13, $14, $15
		)
	`,
		standID,
		time.Now(),
		core["Время работы ядра (всего)"],
		core["Время работы ядра (текущее)"],
		parseIntPointer(core["Количество перезапусков ядра"]),
		parseIntPointer(core["Количество каналов"]),
		channel["Время работы канала (всего)"],
		channel["Время работы канала (текущее)"],
		channel["Статус канала"],
		channel["Режим канала"],
		channel["Время работы программы"],
		programPercent,
		channel["Программа"],
		mustJSON(sections),
		payload,
	)
	if err != nil {
		if ctx.Err() == nil {
			fmt.Printf("DB INSERT ERROR: stand=%d error=%v\n", standID, err)
		}
		return
	}

	fmt.Printf(
		"CNC SAVED: stand=%d | status=%s | mode=%s | program=%s | progress=%s\n",
		standID,
		channel["Статус канала"],
		channel["Режим канала"],
		channel["Программа"],
		channel["Процент выполнения программы"],
	)
}

func parseIntPointer(value string) *int {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}

	n, err := strconv.Atoi(value)
	if err != nil {
		return nil
	}
	return &n
}

func mustJSON(value any) []byte {
	data, err := json.Marshal(value)
	if err != nil {
		// CNCSections содержит только строки и карты строк,
		// поэтому ошибка здесь практически исключена.
		panic(err)
	}
	return data
}

func pollCNC(ctx context.Context, pool *pgxpool.Pool) {
	client := &http.Client{
		Timeout: 5 * time.Second,
	}

	ticker := time.NewTicker(pollInterval)
	defer ticker.Stop()

	poll := func() {
		for _, standID := range []int{3, 5} {
			if ctx.Err() != nil {
				return
			}
			fetchCNC(ctx, client, pool, standID)
		}
	}

	// Выполняем первый опрос сразу, не ждём 5 секунд.
	poll()

	for {
		select {
		case <-ctx.Done():
			fmt.Println("HTTP polling stopped")
			return
		case <-ticker.C:
			poll()
		}
	}
}

func main() {
	ctx, stop := signal.NotifyContext(
		context.Background(),
		os.Interrupt,
		syscall.SIGTERM,
	)
	defer stop()

	// PostgreSQL
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		fmt.Println("db: DATABASE_URL не задана")
		os.Exit(1)
	}

	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		fmt.Println("db pool:", err)
		os.Exit(1)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		fmt.Println("db ping:", err)
		os.Exit(1)
	}
	fmt.Println("database connected")

	// MQTT
	opts := mqtt.NewClientOptions()
	opts.AddBroker("tcp://91.240.87.171:1883")
	opts.SetUsername(os.Getenv("MQTT_USERNAME"))
	opts.SetPassword(os.Getenv("MQTT_PASSWORD"))
	opts.SetClientID("mqtt-reader-karp")
	opts.SetAutoReconnect(true)

	client := mqtt.NewClient(opts)

	if token := client.Connect(); token.Wait() && token.Error() != nil {
		fmt.Println("connect:", token.Error())
		os.Exit(1)
	}
	fmt.Println("mqtt connected")

	handler := func(_ mqtt.Client, msg mqtt.Message) {
		receivedAt := time.Now()
		topic := msg.Topic()
		valueText := string(msg.Payload())

		var valueNum *float64
		if n, err := strconv.ParseFloat(valueText, 64); err == nil {
			valueNum = &n
		}

		_, err := pool.Exec(ctx, `
			INSERT INTO mqtt_messages
				(received_at, topic, value_num, value_text)
			VALUES ($1, $2, $3, $4)
		`, receivedAt, topic, valueNum, valueText)

		if err != nil {
			fmt.Printf("DB INSERT ERROR: topic=%s error=%v\n", topic, err)
			return
		}

		fmt.Printf("MQTT SAVED: %s | %s | %s\n",
			receivedAt.Format(time.RFC3339),
			topic,
			valueText,
		)
	}

	topics := []string{
		"demodata/#",
		"sensor/#",
		"cncmqtt/#",
		"cnc/lathe/#",
	}

	for _, topic := range topics {
		if token := client.Subscribe(topic, 0, handler); token.Wait() && token.Error() != nil {
			fmt.Println("subscribe:", token.Error())
			client.Disconnect(1000)
			os.Exit(1)
		}
		fmt.Println("subscribed:", topic)
	}

	// HTTP опрос работает независимо от MQTT.
	go pollCNC(ctx, pool)

	fmt.Println("CNC HTTP polling started: interval=5s, stands=3,5")
	fmt.Println("Press Ctrl+C to stop")

	<-ctx.Done()

	fmt.Println("disconnecting...")
	client.Disconnect(1000)
}
