#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PID_DIR="$ROOT_DIR/.pids"

mkdir -p "$PID_DIR"

set -a
source "$ROOT_DIR/.env"
set +a

# Режим отладки: запуск в текущем терминале с логами
if [[ "${1:-}" == "log" ]]; then
    cd "$ROOT_DIR/mqtt-reader"
    go run . &
    MQTT_PID=$!

    cd "$ROOT_DIR/api"
    go run . &
    API_PID=$!

    echo "$MQTT_PID" > "$PID_DIR/mqtt-reader.pid"
    echo "$API_PID" > "$PID_DIR/api.pid"

    wait
    exit 0
fi


cd "$ROOT_DIR/mqtt-reader"
nohup go run . >/dev/null 2>&1 &
MQTT_PID=$!

cd "$ROOT_DIR/api"
nohup go run . >/dev/null 2>&1 &
API_PID=$!

echo "$MQTT_PID" > "$PID_DIR/mqtt-reader.pid"
echo "$API_PID" > "$PID_DIR/api.pid"

