package main

import (
	"net/http"
	"time"
)

type mqttPoint struct {
	Topic      string    `json:"topic"`
	ReceivedAt time.Time `json:"received_at"`
	ValueNum   *float64  `json:"value_num"`
	ValueText  string    `json:"value_text"`
}

func (s *server) latestMQTT(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := queryContext(r)
	defer cancel()

	rows, err := s.pool.Query(ctx, `
		SELECT DISTINCT ON (topic)
			topic, received_at, value_num, value_text
		FROM mqtt_messages
		ORDER BY topic, received_at DESC
	`)
	if err != nil {
		writeError(w, err)
		return
	}
	defer rows.Close()

	items := make([]mqttPoint, 0)
	for rows.Next() {
		var item mqttPoint
		if err := rows.Scan(&item.Topic, &item.ReceivedAt, &item.ValueNum, &item.ValueText); err != nil {
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

func (s *server) historyMQTT(w http.ResponseWriter, r *http.Request) {
	topic := r.URL.Query().Get("topic")
	if topic == "" {
		writeBadRequest(w, "topic is required")
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
		FROM mqtt_messages
		WHERE topic = $1 AND received_at >= $2 AND received_at < $3
		ORDER BY received_at
		LIMIT $4
	`, topic, span.From, span.To, historyLimit+1)
	if err != nil {
		writeError(w, err)
		return
	}
	defer rows.Close()

	items := make([]mqttPoint, 0)
	for rows.Next() {
		item := mqttPoint{Topic: topic}
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
