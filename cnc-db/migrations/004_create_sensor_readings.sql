-- Измерения температуры и влажности из MQTT.

CREATE TABLE sensor_readings (
    id          bigserial PRIMARY KEY,
    received_at timestamptz NOT NULL,
    source      text NOT NULL,
    stand_id    integer REFERENCES stands (id),
    metric      text NOT NULL,
    value       double precision NOT NULL
);

CREATE INDEX sensor_readings_stand_time_idx
    ON sensor_readings (stand_id, received_at DESC);

CREATE INDEX sensor_readings_source_metric_time_idx
    ON sensor_readings (source, metric, received_at DESC);
