package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

const pollInterval = 5 * time.Second

type CNCResponse struct {
	Data []json.RawMessage `json:"data"`
}

type CNCSections map[string]map[string]string

type axisRow struct {
	channel  int
	axis     string
	position float64
}

type errorRow struct {
	channel     int
	code        string
	reportedAt  *time.Time
	message     string
	description string
	action      string
}

func pollCNC(ctx context.Context, pool *pgxpool.Pool) {
	client := &http.Client{Timeout: 5 * time.Second}
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

	poll()

	for {
		select {
		case <-ctx.Done():
			logger.Println("HTTP polling stopped")
			return
		case <-ticker.C:
			poll()
		}
	}
}

func fetchCNC(ctx context.Context, client *http.Client, pool *pgxpool.Pool, standID int) {
	url := fmt.Sprintf("https://cnc.kovalev.team/get/%d", standID)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		logger.Printf("HTTP request error: stand=%d error=%v\n", standID, err)
		return
	}

	resp, err := client.Do(req)
	if err != nil {
		if ctx.Err() == nil {
			logger.Printf("HTTP ERROR: stand=%d error=%v\n", standID, err)
		}
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		logger.Printf("HTTP STATUS ERROR: stand=%d status=%s\n", standID, resp.Status)
		return
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 2*1024*1024+1))
	if err != nil {
		logger.Printf("HTTP BODY ERROR: stand=%d error=%v\n", standID, err)
		return
	}
	if len(body) > 2*1024*1024 {
		logger.Printf("HTTP BODY TOO LARGE: stand=%d\n", standID)
		return
	}

	sections, err := parseCNCResponse(body)
	if err != nil {
		logger.Printf("JSON ERROR: stand=%d error=%v\n", standID, err)
		return
	}

	if err := saveCNC(ctx, pool, standID, sections, body); err != nil && ctx.Err() == nil {
		logger.Printf("DB INSERT ERROR: stand=%d error=%v\n", standID, err)
	}
}

func saveCNC(ctx context.Context, pool *pgxpool.Pool, standID int, sections CNCSections, body []byte) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	core := sections["Моточасы"]
	channel := sections["Канал 1"]
	axes := collectAxes(sections)
	errors := collectErrors(sections)

	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var snapshotID int64
	err = tx.QueryRow(ctx, `
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
		RETURNING id
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
		parsePercent(channel["Процент выполнения программы"]),
		channel["Программа"],
		mustJSON(sections),
		json.RawMessage(body),
	).Scan(&snapshotID)
	if err != nil {
		return err
	}

	for _, axis := range axes {
		_, err = tx.Exec(ctx, `
			INSERT INTO cnc_axes (snapshot_id, channel, axis, position_mm)
			VALUES ($1, $2, $3, $4)
		`, snapshotID, axis.channel, axis.axis, axis.position)
		if err != nil {
			return err
		}
	}

	for _, item := range errors {
		_, err = tx.Exec(ctx, `
			INSERT INTO cnc_errors (
				snapshot_id, channel, code, reported_at, message, description, action
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`, snapshotID, item.channel, item.code, item.reportedAt, item.message, item.description, item.action)
		if err != nil {
			return err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	logger.Printf(
		"CNC SAVED: stand=%d | status=%s | mode=%s | program=%s | progress=%s | axes=%d | errors=%d\n",
		standID,
		channel["Статус канала"],
		channel["Режим канала"],
		channel["Программа"],
		channel["Процент выполнения программы"],
		len(axes),
		len(errors),
	)
	return nil
}

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

func collectAxes(sections CNCSections) []axisRow {
	rows := make([]axisRow, 0)
	for name, values := range sections {
		channel, ok := channelFromSection(name, "Оси Канала ")
		if !ok {
			continue
		}
		for field, raw := range values {
			axis, ok := strings.CutPrefix(field, "Перемещение по оси ")
			if !ok || strings.TrimSpace(axis) == "" {
				continue
			}
			position, ok := parseMillimetres(raw)
			if !ok {
				logger.Printf("AXIS SKIP: section=%s field=%s value=%q\n", name, field, raw)
				continue
			}
			rows = append(rows, axisRow{
				channel:  channel,
				axis:     strings.TrimSpace(axis),
				position: position,
			})
		}
	}
	return rows
}

func collectErrors(sections CNCSections) []errorRow {
	rows := make([]errorRow, 0)
	for name, values := range sections {
		if name != "Ошибка" && !strings.HasPrefix(name, "Ошибка_") {
			continue
		}
		channel, err := strconv.Atoi(strings.TrimSpace(values["Ошибка на канале"]))
		if err != nil {
			logger.Printf("ERROR SKIP: section=%s channel=%q\n", name, values["Ошибка на канале"])
			continue
		}
		rows = append(rows, errorRow{
			channel:     channel,
			code:        values["Номер ошибки"],
			reportedAt:  parseMachineTime(values["Время"]),
			message:     values["Текст"],
			description: values["Описание"],
			action:      values["Что сделать"],
		})
	}
	return rows
}

func channelFromSection(name, prefix string) (int, bool) {
	rest, ok := strings.CutPrefix(name, prefix)
	if !ok {
		return 0, false
	}
	channel, err := strconv.Atoi(strings.TrimSpace(rest))
	if err != nil {
		return 0, false
	}
	return channel, true
}

func parseMillimetres(value string) (float64, bool) {
	value = strings.TrimSpace(value)
	value = strings.TrimSuffix(value, "мм")
	value = strings.TrimSpace(value)
	value = strings.ReplaceAll(value, ",", ".")
	if value == "" {
		return 0, false
	}
	position, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return 0, false
	}
	return position, true
}

func parseMachineTime(value string) *time.Time {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	layouts := []string{
		"2.1.2006 15:04:05",
		"2.1.2006 15:04",
		"2006-01-02 15:04:05",
		time.RFC3339,
	}
	for _, layout := range layouts {
		parsed, err := time.ParseInLocation(layout, value, time.Local)
		if err == nil {
			return &parsed
		}
	}
	logger.Printf("ERROR TIME SKIP: value=%q\n", value)
	return nil
}

func parsePercent(value string) *int {
	value = strings.TrimSpace(strings.TrimSuffix(value, "%"))
	return parseIntPointer(value)
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
		panic(err)
	}
	return data
}
