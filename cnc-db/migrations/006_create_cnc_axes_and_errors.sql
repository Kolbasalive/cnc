-- Оси и ошибки, относящиеся к конкретному снимку состояния ЧПУ.

CREATE TABLE cnc_axes (
    id          bigserial PRIMARY KEY,
    snapshot_id bigint NOT NULL
                REFERENCES cnc_status_snapshots (id),
    channel     integer NOT NULL,
    axis        text NOT NULL,
    position_mm double precision NOT NULL
);

CREATE INDEX cnc_axes_snapshot_id_idx
    ON cnc_axes (snapshot_id);

CREATE INDEX cnc_axes_axis_snapshot_idx
    ON cnc_axes (axis, snapshot_id);


CREATE TABLE cnc_errors (
    id          bigserial PRIMARY KEY,
    snapshot_id bigint NOT NULL
                REFERENCES cnc_status_snapshots (id),
    channel     integer NOT NULL,
    code        text,
    reported_at timestamptz,
    message     text,
    description text,
    action      text
);

CREATE INDEX cnc_errors_snapshot_id_idx
    ON cnc_errors (snapshot_id);

CREATE INDEX cnc_errors_code_reported_at_idx
    ON cnc_errors (code, reported_at DESC);
