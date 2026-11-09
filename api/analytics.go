package main

import (
	"context"
	"fmt"
	"math"
	"net/http"
	"time"
)

type shareItem struct {
	Label   string  `json:"label"`
	Seconds float64 `json:"seconds"`
	Percent float64 `json:"percent"`
}

type shareReport struct {
	StandID      int         `json:"stand_id,omitempty"`
	From         time.Time   `json:"from"`
	To           time.Time   `json:"to"`
	TotalSeconds float64     `json:"total_seconds"`
	Items        []shareItem `json:"items"`
	Longest      *segment    `json:"longest,omitempty"`
}

type segment struct {
	Label     string    `json:"label"`
	Seconds   float64   `json:"seconds"`
	StartedAt time.Time `json:"started_at"`
	EndedAt   time.Time `json:"ended_at"`
}

type availabilityReport struct {
	StandID        int       `json:"stand_id"`
	From           time.Time `json:"from"`
	To             time.Time `json:"to"`
	OnlineSeconds  float64   `json:"online_seconds"`
	OfflineSeconds float64   `json:"offline_seconds"`
	OnlinePercent  float64   `json:"online_percent"`
	OfflinePercent float64   `json:"offline_percent"`
}

type errorReportItem struct {
	ReceivedAt  time.Time  `json:"received_at"`
	ReportedAt  *time.Time `json:"reported_at"`
	Channel     int        `json:"channel"`
	Code        string     `json:"code"`
	Message     string     `json:"message"`
	Description string     `json:"description"`
	Action      string     `json:"action"`
	ProgramName string     `json:"program_name"`
	Temperature *float64   `json:"temperature"`
	Humidity    *float64   `json:"humidity"`
}

type climateMatch struct {
	ReceivedAt time.Time `json:"received_at"`
	Value      float64   `json:"value"`
}

func (s *server) standStatus(w http.ResponseWriter, r *http.Request) {
	s.standShare(w, r, "status")
}

func (s *server) standModes(w http.ResponseWriter, r *http.Request) {
	s.standShare(w, r, "mode")
}

func (s *server) standPrograms(w http.ResponseWriter, r *http.Request) {
	s.standShare(w, r, "program_name")
}

func (s *server) standShare(w http.ResponseWriter, r *http.Request, column string) {
	standID, span, ok := s.standSpan(w, r)
	if !ok {
		return
	}
	ctx, cancel := queryContext(r)
	defer cancel()

	report, err := s.snapshotShare(ctx, standID, column, span)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, report)
}

func (s *server) standAvailability(w http.ResponseWriter, r *http.Request) {
	standID, span, ok := s.standSpan(w, r)
	if !ok {
		return
	}
	ctx, cancel := queryContext(r)
	defer cancel()

	rows, err := s.pool.Query(ctx, `
		SELECT received_at, core_runtime_current
		FROM cnc_status_snapshots
		WHERE stand_id = $1 AND received_at >= $2 AND received_at < $3
		ORDER BY received_at
	`, standID, span.From, span.To)
	if err != nil {
		writeError(w, err)
		return
	}
	defer rows.Close()

	type point struct {
		at     time.Time
		kernel string
	}
	points := make([]point, 0)
	for rows.Next() {
		var item point
		if err := rows.Scan(&item.at, &item.kernel); err != nil {
			writeError(w, err)
			return
		}
		points = append(points, item)
	}
	if err := rows.Err(); err != nil {
		writeError(w, err)
		return
	}

	var online, offline float64
	if len(points) > 0 {
		lastChange := points[0].at
		prev := points[0]
		for _, cur := range points[1:] {
			addAvailability(&online, &offline, prev.at, cur.at, lastChange, prev.kernel == cur.kernel)
			if prev.kernel != cur.kernel {
				lastChange = cur.at
			}
			prev = cur
		}
		addAvailability(&online, &offline, prev.at, span.To, lastChange, true)
	}

	total := online + offline
	writeJSON(w, http.StatusOK, availabilityReport{
		StandID:        standID,
		From:           span.From,
		To:             span.To,
		OnlineSeconds:  round1(online),
		OfflineSeconds: round1(offline),
		OnlinePercent:  percent(online, total),
		OfflinePercent: percent(offline, total),
	})
}

func addAvailability(online, offline *float64, from, to, lastChange time.Time, sameKernel bool) {
	if !to.After(from) {
		return
	}
	if !sameKernel {
		*online += to.Sub(from).Seconds()
		return
	}
	offlineStart := lastChange.Add(time.Minute)
	switch {
	case !to.After(offlineStart):
		*online += to.Sub(from).Seconds()
	case !from.Before(offlineStart):
		*offline += to.Sub(from).Seconds()
	default:
		*online += offlineStart.Sub(from).Seconds()
		*offline += to.Sub(offlineStart).Seconds()
	}
}

func (s *server) standErrors(w http.ResponseWriter, r *http.Request) {
	standID, span, ok := s.standSpan(w, r)
	if !ok {
		return
	}
	ctx, cancel := queryContext(r)
	defer cancel()

	rows, err := s.pool.Query(ctx, `
		SELECT
			s.received_at, e.reported_at, e.channel, e.code, e.message, e.description, e.action,
			s.program_name,
			(
				SELECT value FROM sensor_readings
				WHERE source = 'stand' AND stand_id = s.stand_id AND metric = 'temp'
				  AND received_at <= s.received_at
				ORDER BY received_at DESC
				LIMIT 1
			),
			(
				SELECT value FROM sensor_readings
				WHERE source = 'stand' AND stand_id = s.stand_id AND metric = 'humidity'
				  AND received_at <= s.received_at
				ORDER BY received_at DESC
				LIMIT 1
			)
		FROM cnc_errors e
		JOIN cnc_status_snapshots s ON s.id = e.snapshot_id
		WHERE s.stand_id = $1 AND s.received_at >= $2 AND s.received_at < $3
		ORDER BY s.received_at, e.id
	`, standID, span.From, span.To)
	if err != nil {
		writeError(w, err)
		return
	}
	defer rows.Close()

	items := make([]errorReportItem, 0)
	for rows.Next() {
		var item errorReportItem
		if err := rows.Scan(
			&item.ReceivedAt, &item.ReportedAt, &item.Channel, &item.Code,
			&item.Message, &item.Description, &item.Action, &item.ProgramName,
			&item.Temperature, &item.Humidity,
		); err != nil {
			writeError(w, err)
			return
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"stand_id": standID,
		"from":     span.From,
		"to":       span.To,
		"items":    items,
	})
}

func (s *server) demoPrograms(w http.ResponseWriter, r *http.Request) {
	span, err := parseRange(r)
	if err != nil {
		writeBadRequest(w, err.Error())
		return
	}
	ctx, cancel := queryContext(r)
	defer cancel()

	rows, err := s.pool.Query(ctx, `
		WITH samples AS (
			SELECT received_at, COALESCE(NULLIF(value_text, ''), '—') AS label,
			       lead(received_at) OVER (ORDER BY received_at) AS next_at
			FROM demo_lathe_signals
			WHERE signal = 'program' AND received_at >= $1 AND received_at < $2
		),
		segments AS (
			SELECT label, received_at AS started_at,
			       LEAST(COALESCE(next_at, $2::timestamptz), received_at + interval '2 minutes') AS ended_at
			FROM samples
		)
		SELECT label, started_at, ended_at,
		       EXTRACT(EPOCH FROM (ended_at - started_at))
		FROM segments
		WHERE ended_at > started_at
		ORDER BY started_at
	`, span.From, span.To)
	if err != nil {
		writeError(w, err)
		return
	}
	defer rows.Close()

	totals := map[string]float64{}
	var order []string
	var longest *segment
	var total float64
	for rows.Next() {
		var item segment
		if err := rows.Scan(&item.Label, &item.StartedAt, &item.EndedAt, &item.Seconds); err != nil {
			writeError(w, err)
			return
		}
		if _, ok := totals[item.Label]; !ok {
			order = append(order, item.Label)
		}
		totals[item.Label] += item.Seconds
		total += item.Seconds
		if longest == nil || item.Seconds > longest.Seconds {
			copy := item
			longest = &copy
		}
	}
	if err := rows.Err(); err != nil {
		writeError(w, err)
		return
	}

	items := make([]shareItem, 0, len(order))
	for _, label := range order {
		items = append(items, shareItem{
			Label:   label,
			Seconds: round1(totals[label]),
			Percent: percent(totals[label], total),
		})
	}
	if longest != nil {
		longest.Seconds = round1(longest.Seconds)
	}
	writeJSON(w, http.StatusOK, shareReport{
		From:         span.From,
		To:           span.To,
		TotalSeconds: round1(total),
		Items:        items,
		Longest:      longest,
	})
}

func (s *server) demoTempHumidity(w http.ResponseWriter, r *http.Request) {
	span, err := parseRange(r)
	if err != nil {
		writeBadRequest(w, err.Error())
		return
	}
	ctx, cancel := queryContext(r)
	defer cancel()

	rows, err := s.pool.Query(ctx, `
		SELECT t.received_at, t.value
		FROM sensor_readings t
		JOIN LATERAL (
			SELECT value
			FROM sensor_readings h
			WHERE h.source = 'demo_lathe' AND h.metric = 'humidity'
			  AND h.received_at BETWEEN t.received_at - interval '2 seconds'
			                        AND t.received_at + interval '2 seconds'
			ORDER BY abs(EXTRACT(EPOCH FROM (h.received_at - t.received_at)))
			LIMIT 1
		) h ON h.value = t.value
		WHERE t.source = 'demo_lathe' AND t.metric = 'temp'
		  AND t.received_at >= $1 AND t.received_at < $2
		ORDER BY t.received_at
		LIMIT 500
	`, span.From, span.To)
	if err != nil {
		writeError(w, err)
		return
	}
	defer rows.Close()

	items := make([]climateMatch, 0)
	for rows.Next() {
		var item climateMatch
		if err := rows.Scan(&item.ReceivedAt, &item.Value); err != nil {
			writeError(w, err)
			return
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"from":  span.From,
		"to":    span.To,
		"items": items,
	})
}

func (s *server) snapshotShare(ctx context.Context, standID int, column string, span timeRange) (shareReport, error) {
	query := fmt.Sprintf(`
		WITH samples AS (
			SELECT received_at, COALESCE(NULLIF(%s, ''), '—') AS label,
			       lead(received_at) OVER (ORDER BY received_at) AS next_at
			FROM cnc_status_snapshots
			WHERE stand_id = $1 AND received_at >= $2 AND received_at < $3
		)
		SELECT label, SUM(EXTRACT(EPOCH FROM (
			LEAST(COALESCE(next_at, $3::timestamptz), received_at + interval '2 minutes') - received_at
		)))
		FROM samples
		GROUP BY label
		ORDER BY 2 DESC
	`, column)

	rows, err := s.pool.Query(ctx, query, standID, span.From, span.To)
	if err != nil {
		return shareReport{}, err
	}
	defer rows.Close()

	items := make([]shareItem, 0)
	var total float64
	for rows.Next() {
		var item shareItem
		if err := rows.Scan(&item.Label, &item.Seconds); err != nil {
			return shareReport{}, err
		}
		total += item.Seconds
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return shareReport{}, err
	}
	for i := range items {
		items[i].Percent = percent(items[i].Seconds, total)
		items[i].Seconds = round1(items[i].Seconds)
	}
	return shareReport{
		StandID:      standID,
		From:         span.From,
		To:           span.To,
		TotalSeconds: round1(total),
		Items:        items,
	}, nil
}

func (s *server) standSpan(w http.ResponseWriter, r *http.Request) (int, timeRange, bool) {
	standID, err := parseStandID(r.PathValue("id"))
	if err != nil {
		writeBadRequest(w, err.Error())
		return 0, timeRange{}, false
	}
	span, err := parseRange(r)
	if err != nil {
		writeBadRequest(w, err.Error())
		return 0, timeRange{}, false
	}
	return standID, span, true
}

func percent(part, total float64) float64 {
	if total == 0 {
		return 0
	}
	return round1(part / total * 100)
}

func round1(value float64) float64 {
	return math.Round(value*10) / 10
}
