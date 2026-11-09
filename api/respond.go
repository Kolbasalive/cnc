package main

import (
	"context"
	"net/http"
	"time"
)

type historyResponse[T any] struct {
	From      time.Time `json:"from"`
	To        time.Time `json:"to"`
	Truncated bool      `json:"truncated"`
	Items     []T       `json:"items"`
}

func queryContext(r *http.Request) (context.Context, context.CancelFunc) {
	return context.WithTimeout(r.Context(), 15*time.Second)
}

func writeHistory[T any](w http.ResponseWriter, span timeRange, items []T) {
	truncated := len(items) > historyLimit
	if truncated {
		items = items[:historyLimit]
	}
	writeJSON(w, http.StatusOK, historyResponse[T]{
		From:      span.From,
		To:        span.To,
		Truncated: truncated,
		Items:     items,
	})
}
