# Этап сборки
FROM golang:1.26.8-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o /mqtt-reader .

# Этап запуска
FROM alpine:3.22

WORKDIR /app

COPY --from=builder /mqtt-reader ./mqtt-reader

# Порт наружу процесс не открывает.
# DATABASE_URL, MQTT_USERNAME и MQTT_PASSWORD приходят из compose при запуске.

CMD ["./mqtt-reader"]
