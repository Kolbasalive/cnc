package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

const historyLimit = 5000

type server struct {
	pool *pgxpool.Pool
}

type timeRange struct {
	From time.Time `json:"from"`
	To   time.Time `json:"to"`
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(value); err != nil {
		fmt.Println("encode:", err)
	}
}

func writeError(w http.ResponseWriter, err error) {
	fmt.Println("query:", err)
	writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "database error"})
}

func writeBadRequest(w http.ResponseWriter, message string) {
	writeJSON(w, http.StatusBadRequest, map[string]string{"error": message})
}

func parseRange(r *http.Request) (timeRange, error) {
	now := time.Now()
	span := timeRange{From: now.Add(-24 * time.Hour), To: now}

	if raw := r.URL.Query().Get("from"); raw != "" {
		parsed, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			return timeRange{}, fmt.Errorf("from must be RFC3339")
		}
		span.From = parsed
	}
	if raw := r.URL.Query().Get("to"); raw != "" {
		parsed, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			return timeRange{}, fmt.Errorf("to must be RFC3339")
		}
		span.To = parsed
	}
	if !span.From.Before(span.To) {
		return timeRange{}, fmt.Errorf("from must be earlier than to")
	}
	return span, nil
}

func parseStandID(raw string) (int, error) {
	id, err := strconv.Atoi(raw)
	if err != nil || (id != 3 && id != 5) {
		return 0, fmt.Errorf("stand must be 3 or 5")
	}
	return id, nil
}
