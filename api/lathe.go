package main

import (
	"net/http"
	"time"
)

type lathePoint struct {
	ReceivedAt time.Time `json:"received_at"`
	Signal     string    `json:"signal"`
	ValueNum   *float64  `json:"value_num"`
	ValueText  string    `json:"value_text"`
}

func (s *server) latestLathe(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := queryContext(r)
	defer cancel()

	rows, err := s.pool.Query(ctx, `
		SELECT DISTINCT ON (signal)
			received_at, signal, value_num, value_text
		FROM demo_lathe_signals
		ORDER BY signal, received_at DESC
	`)
	if err != nil {
		writeError(w, err)
		return
	}
	defer rows.Close()

	items := make([]lathePoint, 0)
	for rows.Next() {
		var item lathePoint
		if err := rows.Scan(&item.ReceivedAt, &item.Signal, &item.ValueNum, &item.ValueText); err != nil {
			writeError(w, err)
			return
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (s *server) historyLathe(w http.ResponseWriter, r *http.Request) {
	signal := r.URL.Query().Get("signal")
	if signal == "" {
		writeBadRequest(w, "signal is required")
		return
	}
	switch signal {
	case "x", "z", "program", "program_percent":
	default:
		writeBadRequest(w, "signal must be x, z, program or program_percent")
		return
	}
	span, err := parseRange(r)
	if err != nil {
		writeBadRequest(w, err.Error())
		return
	}

	ctx, cancel := queryContext(r)
	defer cancel()

	rows, err := s.pool.Query(ctx, `
		SELECT received_at, value_num, value_text
		FROM demo_lathe_signals
		WHERE signal = $1 AND received_at >= $2 AND received_at < $3
		ORDER BY received_at
		LIMIT $4
	`, signal, span.From, span.To, historyLimit+1)
	if err != nil {
		writeError(w, err)
		return
	}
	defer rows.Close()

	items := make([]lathePoint, 0)
	for rows.Next() {
		item := lathePoint{Signal: signal}
		if err := rows.Scan(&item.ReceivedAt, &item.ValueNum, &item.ValueText); err != nil {
			writeError(w, err)
			return
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		writeError(w, err)
		return
	}
	writeHistory(w, span, items)
}
