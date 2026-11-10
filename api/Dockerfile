# Этап сборки
FROM golang:1.26.8-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o /api-server .

# Этап запуска
FROM alpine:3.22

WORKDIR /app

COPY --from=builder /api-server ./api-server

EXPOSE 8080

CMD ["./api-server"]
