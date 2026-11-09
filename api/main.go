package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
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

	srv := &server{pool: pool}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /openapi.yaml", srv.openAPI)
	mux.HandleFunc("GET /swagger", srv.swaggerUI)
	mux.HandleFunc("GET /swagger/", srv.swaggerUI)

	mux.HandleFunc("GET /api/overview", srv.overview)

	mux.HandleFunc("GET /api/mqtt/latest", srv.latestMQTT)
	mux.HandleFunc("GET /api/mqtt/history", srv.historyMQTT)

	mux.HandleFunc("GET /api/sensors/latest", srv.latestSensors)
	mux.HandleFunc("GET /api/sensors/history", srv.historySensors)

	mux.HandleFunc("GET /api/demo-lathe/latest", srv.latestLathe)
	mux.HandleFunc("GET /api/demo-lathe/history", srv.historyLathe)

	mux.HandleFunc("GET /api/cnc/latest", srv.latestCNC)
	mux.HandleFunc("GET /api/cnc/history", srv.historyCNC)

	mux.HandleFunc("GET /api/analytics/stands/{id}/status", srv.standStatus)
	mux.HandleFunc("GET /api/analytics/stands/{id}/modes", srv.standModes)
	mux.HandleFunc("GET /api/analytics/stands/{id}/programs", srv.standPrograms)
	mux.HandleFunc("GET /api/analytics/stands/{id}/availability", srv.standAvailability)
	mux.HandleFunc("GET /api/analytics/stands/{id}/errors", srv.standErrors)
	mux.HandleFunc("GET /api/analytics/demo/programs", srv.demoPrograms)
	mux.HandleFunc("GET /api/analytics/demo/temp-humidity", srv.demoTempHumidity)

	addr := os.Getenv("ADDR")
	if addr == "" {
		addr = "127.0.0.1:8080"
	}

	httpServer := &http.Server{
		Addr:              addr,
		Handler:           withCORS(mux),
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = httpServer.Shutdown(shutdownCtx)
	}()

	fmt.Printf("API listening on http://%s\n", addr)
	fmt.Printf("Swagger UI: http://%s/swagger\n", addr)
	if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		fmt.Println("http:", err)
		os.Exit(1)
	}
}
