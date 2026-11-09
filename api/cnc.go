package main

import (
	"context"
	"encoding/json"
	"net/http"
	"time"
)

type axisPoint struct {
	Channel    int     `json:"channel"`
	Axis       string  `json:"axis"`
	PositionMM float64 `json:"position_mm"`
}

type errorPoint struct {
	Channel     int        `json:"channel"`
	Code        string     `json:"code"`
	ReportedAt  *time.Time `json:"reported_at"`
	Message     string     `json:"message"`
	Description string     `json:"description"`
	Action      string     `json:"action"`
}

type snapshot struct {
	ID                     int64       `json:"id"`
	StandID                int         `json:"stand_id"`
	ReceivedAt             time.Time   `json:"received_at"`
	CoreRuntimeTotal       string      `json:"core_runtime_total"`
	CoreRuntimeCurrent     string      `json:"core_runtime_current"`
	CoreRestarts           *int        `json:"core_restarts"`
	ChannelCount           *int        `json:"channel_count"`
	ChannelRuntimeTotal    string      `json:"channel_runtime_total"`
	ChannelRuntimeCurrent  string      `json:"channel_runtime_current"`
	Status                 string      `json:"status"`
	Mode                   string      `json:"mode"`
	ProgramTime            string      `json:"program_time"`
	ProgramPercent         *int        `json:"program_percent"`
	ProgramName            string      `json:"program_name"`
	Online                 bool        `json:"online"`
	Axes                   []axisPoint `json:"axes"`
	Errors                 []errorPoint `json:"errors"`
}

func (s *server) latestCNC(w http.ResponseWriter, r *http.Request) {
	stands, err := requestedStands(r, false)
	if err != nil {
		writeBadRequest(w, err.Error())
		return
	}

	ctx, cancel := queryContext(r)
	defer cancel()

	items := make([]snapshot, 0, len(stands))
	for _, standID := range stands {
		item, ok, err := s.loadLatestSnapshot(ctx, standID)
		if err != nil {
			writeError(w, err)
			return
		}
		if ok {
			items = append(items, item)
		}
	}
	writeJSON(w, http.StatusOK, items)
}

func (s *server) historyCNC(w http.ResponseWriter, r *http.Request) {
	stands, err := requestedStands(r, true)
	if err != nil {
		writeBadRequest(w, err.Error())
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
		SELECT
			s.id, s.stand_id, s.received_at,
			s.core_runtime_total, s.core_runtime_current, s.core_restarts, s.channel_count,
			s.channel_runtime_total, s.channel_runtime_current,
			s.status, s.mode, s.program_time, s.program_percent, s.program_name,
			COALESCE((
				SELECT json_agg(json_build_object(
					'channel', a.channel, 'axis', a.axis, 'position_mm', a.position_mm
				) ORDER BY a.channel, a.axis)
				FROM cnc_axes a WHERE a.snapshot_id = s.id
			), '[]'::json),
			COALESCE((
				SELECT json_agg(json_build_object(
					'channel', e.channel, 'code', e.code, 'reported_at', e.reported_at,
					'message', e.message, 'description', e.description, 'action', e.action
				) ORDER BY e.id)
				FROM cnc_errors e WHERE e.snapshot_id = s.id
			), '[]'::json)
		FROM cnc_status_snapshots s
		WHERE s.stand_id = $1 AND s.received_at >= $2 AND s.received_at < $3
		ORDER BY s.received_at
		LIMIT $4
	`, stands[0], span.From, span.To, historyLimit+1)
	if err != nil {
		writeError(w, err)
		return
	}
	defer rows.Close()

	items := make([]snapshot, 0)
	for rows.Next() {
		item, err := scanSnapshot(rows.Scan)
		if err != nil {
			writeError(w, err)
			return
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		writeError(w, err)
		return
	}
	markOnline(items)
	writeHistory(w, span, items)
}

func (s *server) loadLatestSnapshot(ctx context.Context, standID int) (snapshot, bool, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT
			s.id, s.stand_id, s.received_at,
			s.core_runtime_total, s.core_runtime_current, s.core_restarts, s.channel_count,
			s.channel_runtime_total, s.channel_runtime_current,
			s.status, s.mode, s.program_time, s.program_percent, s.program_name,
			COALESCE((
				SELECT json_agg(json_build_object(
					'channel', a.channel, 'axis', a.axis, 'position_mm', a.position_mm
				) ORDER BY a.channel, a.axis)
				FROM cnc_axes a WHERE a.snapshot_id = s.id
			), '[]'::json),
			COALESCE((
				SELECT json_agg(json_build_object(
					'channel', e.channel, 'code', e.code, 'reported_at', e.reported_at,
					'message', e.message, 'description', e.description, 'action', e.action
				) ORDER BY e.id)
				FROM cnc_errors e WHERE e.snapshot_id = s.id
			), '[]'::json)
		FROM cnc_status_snapshots s
		WHERE s.stand_id = $1
		ORDER BY s.received_at DESC
		LIMIT 1
	`, standID)
	if err != nil {
		return snapshot{}, false, err
	}
	defer rows.Close()
	if !rows.Next() {
		return snapshot{}, false, rows.Err()
	}
	item, err := scanSnapshot(rows.Scan)
	if err != nil {
		return snapshot{}, false, err
	}
	online, err := s.standIsOnline(ctx, standID, item.ReceivedAt, item.CoreRuntimeCurrent)
	if err != nil {
		return snapshot{}, false, err
	}
	item.Online = online
	return item, true, nil
}

func (s *server) standIsOnline(ctx context.Context, standID int, latestAt time.Time, kernel string) (bool, error) {
	if time.Since(latestAt) > time.Minute {
		return false, nil
	}
	var changedAt *time.Time
	err := s.pool.QueryRow(ctx, `
		SELECT max(received_at)
		FROM cnc_status_snapshots
		WHERE stand_id = $1
		  AND received_at <= $2
		  AND core_runtime_current IS DISTINCT FROM $3
	`, standID, latestAt, kernel).Scan(&changedAt)
	if err != nil {
		return false, err
	}
	if changedAt == nil {
		var firstAt time.Time
		if err := s.pool.QueryRow(ctx, `
			SELECT min(received_at)
			FROM cnc_status_snapshots
			WHERE stand_id = $1 AND received_at <= $2
		`, standID, latestAt).Scan(&firstAt); err != nil {
			return false, err
		}
		return latestAt.Sub(firstAt) <= time.Minute, nil
	}
	return latestAt.Sub(*changedAt) <= time.Minute, nil
}

func scanSnapshot(scan func(dest ...any) error) (snapshot, error) {
	var item snapshot
	var axesJSON, errorsJSON []byte
	err := scan(
		&item.ID, &item.StandID, &item.ReceivedAt,
		&item.CoreRuntimeTotal, &item.CoreRuntimeCurrent, &item.CoreRestarts, &item.ChannelCount,
		&item.ChannelRuntimeTotal, &item.ChannelRuntimeCurrent,
		&item.Status, &item.Mode, &item.ProgramTime, &item.ProgramPercent, &item.ProgramName,
		&axesJSON, &errorsJSON,
	)
	if err != nil {
		return snapshot{}, err
	}
	item.Axes = make([]axisPoint, 0)
	item.Errors = make([]errorPoint, 0)
	if err := json.Unmarshal(axesJSON, &item.Axes); err != nil {
		return snapshot{}, err
	}
	if err := json.Unmarshal(errorsJSON, &item.Errors); err != nil {
		return snapshot{}, err
	}
	return item, nil
}

func markOnline(items []snapshot) {
	lastChange := map[int]time.Time{}
	lastKernel := map[int]string{}
	for i := range items {
		standID := items[i].StandID
		kernel := items[i].CoreRuntimeCurrent
		if prev, ok := lastKernel[standID]; !ok || prev != kernel {
			lastChange[standID] = items[i].ReceivedAt
			lastKernel[standID] = kernel
		}
		items[i].Online = items[i].ReceivedAt.Sub(lastChange[standID]) <= time.Minute
	}
}

func requestedStands(r *http.Request, required bool) ([]int, error) {
	raw := r.URL.Query().Get("stand")
	if raw == "" {
		if required {
			return nil, errStandRequired
		}
		return []int{3, 5}, nil
	}
	id, err := parseStandID(raw)
	if err != nil {
		return nil, err
	}
	return []int{id}, nil
}

var errStandRequired = badRequest("stand is required")

type badRequest string

func (e badRequest) Error() string { return string(e) }
