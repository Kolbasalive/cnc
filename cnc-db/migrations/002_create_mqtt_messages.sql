CREATE TABLE mqtt_messages (
    id          bigserial PRIMARY KEY,
    received_at timestamptz      NOT NULL,
    topic       text             NOT NULL,
    value_num   double precision,
    value_text  text             NOT NULL
);

CREATE INDEX mqtt_messages_topic_time_idx
    ON mqtt_messages (topic, received_at);
