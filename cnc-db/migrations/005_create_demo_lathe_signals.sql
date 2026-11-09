-- Сигналы демонстрационного токарного станка из MQTT.

CREATE TABLE demo_lathe_signals (
    id          bigserial PRIMARY KEY,
    received_at timestamptz NOT NULL,
    signal      text NOT NULL,
    value_num   double precision,
    value_text  text
);

CREATE INDEX demo_lathe_signals_signal_time_idx
    ON demo_lathe_signals (signal, received_at DESC);
