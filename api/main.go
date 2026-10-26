package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type mqttLatest struct {
	Topic      string    `json:"topic"`
	ReceivedAt time.Time `json:"received_at"`
	ValueNum   *float64  `json:"value_num"`
	ValueText  string    `json:"value_text"`
}

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

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

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/mqtt/latest", func(w http.ResponseWriter, r *http.Request) {
		latestMQTT(w, r, pool)
	})

	addr := os.Getenv("ADDR")
	if addr == "" {
		addr = "127.0.0.1:8080"
	}

	server := &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdownCtx)
	}()

	fmt.Printf("API listening on http://%s\n", addr)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		fmt.Println("http:", err)
		os.Exit(1)
	}
}

func latestMQTT(w http.ResponseWriter, r *http.Request, pool *pgxpool.Pool) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	rows, err := pool.Query(ctx, `
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

	items := make([]mqttLatest, 0)
	for rows.Next() {
		var item mqttLatest
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

func writeError(w http.ResponseWriter, err error) {
	fmt.Println("query:", err)
	writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "database error"})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(value); err != nil {
		fmt.Println("encode:", err)
	}
}
