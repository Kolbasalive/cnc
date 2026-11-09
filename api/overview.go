package main

import "net/http"

type overview struct {
	Sensors   []sensorPoint `json:"sensors"`
	DemoLathe []lathePoint  `json:"demo_lathe"`
	Stands    []snapshot    `json:"stands"`
}

func (s *server) overview(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := queryContext(r)
	defer cancel()

	sensors, err := s.querySensors(ctx, `
		SELECT DISTINCT ON (source, stand_id, metric)
			received_at, source, stand_id, metric, value
		FROM sensor_readings
		ORDER BY source, stand_id, metric, received_at DESC
	`)
	if err != nil {
		writeError(w, err)
		return
	}

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

	lathe := make([]lathePoint, 0)
	for rows.Next() {
		var item lathePoint
		if err := rows.Scan(&item.ReceivedAt, &item.Signal, &item.ValueNum, &item.ValueText); err != nil {
			writeError(w, err)
			return
		}
		lathe = append(lathe, item)
	}
	if err := rows.Err(); err != nil {
		writeError(w, err)
		return
	}

	stands := make([]snapshot, 0, 2)
	for _, standID := range []int{3, 5} {
		item, ok, err := s.loadLatestSnapshot(ctx, standID)
		if err != nil {
			writeError(w, err)
			return
		}
		if ok {
			stands = append(stands, item)
		}
	}

	writeJSON(w, http.StatusOK, overview{
		Sensors:   sensors,
		DemoLathe: lathe,
		Stands:    stands,
	})
}
