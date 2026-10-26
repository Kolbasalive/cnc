#!/usr/bin/env bash

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PID_DIR="$ROOT_DIR/.pids"

stop_service() {
    local name="$1"
    local pid_file="$PID_DIR/$name.pid"

    if [[ ! -f "$pid_file" ]]; then
        echo "$name: PID-файл не найден, пропускаю."
        return
    fi

    local pid
    pid="$(cat "$pid_file")"

    if kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null || true
        echo "$name: отправлен сигнал остановки (PID $pid)."
    else
        echo "$name: процесс уже остановлен."
    fi

    rm -f "$pid_file"
}

stop_service "mqtt-reader"
stop_service "api"