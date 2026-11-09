CREATE TABLE IF NOT EXISTS cnc_status_snapshots (
    id                       bigserial PRIMARY KEY,
    stand_id                 integer NOT NULL CHECK (stand_id IN (3, 5)),
    received_at              timestamptz NOT NULL,
    core_runtime_total       text,
    core_runtime_current     text,
    core_restarts            integer,
    channel_count            integer,
    channel_runtime_total    text,
    channel_runtime_current  text,
    status                   text,
    mode                     text,
    program_time             text,
    program_percent          integer,
    program_name             text,
    sections                 jsonb NOT NULL,
    payload                  jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS cnc_status_stand_time_idx
    ON cnc_status_snapshots (stand_id, received_at DESC);
