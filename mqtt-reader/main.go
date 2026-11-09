package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"os/signal"
	"syscall"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/jackc/pgx/v5/pgxpool"
)

var logger = log.New(os.Stdout, "", log.LstdFlags)

func configureLogging() {
	if os.Getenv("LOG_ENABLED") == "false" {
		logger.SetOutput(io.Discard)
	}
}

func main() {
	configureLogging()

	ctx, stop := signal.NotifyContext(
		context.Background(),
		os.Interrupt,
		syscall.SIGTERM,
	)
	defer stop()

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		logger.Println("db: DATABASE_URL не задана")
		os.Exit(1)
	}

	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		logger.Println("db pool:", err)
		os.Exit(1)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		logger.Println("db ping:", err)
		os.Exit(1)
	}
	logger.Println("database connected")

	go pollCNC(ctx, pool)
	logger.Println("CNC HTTP polling started: interval=5s, stands=3,5")

	topics := []string{
		"demodata/#",
		"sensor/#",
		"cncmqtt/#",
		"cnc/lathe/#",
	}
	handler := func(_ mqtt.Client, msg mqtt.Message) {
		if err := saveMQTT(ctx, pool, msg.Topic(), string(msg.Payload())); err != nil && ctx.Err() == nil {
			logger.Printf("DB INSERT ERROR: topic=%s error=%v\n", msg.Topic(), err)
		}
	}

	clientID := fmt.Sprintf("mqtt-reader-karp-%d", os.Getpid())
	opts := mqtt.NewClientOptions()
	opts.AddBroker("tcp://91.240.87.171:1883")
	opts.SetUsername(os.Getenv("MQTT_USERNAME"))
	opts.SetPassword(os.Getenv("MQTT_PASSWORD"))
	opts.SetClientID(clientID)
	opts.SetAutoReconnect(true)
	opts.SetConnectRetry(true)
	opts.SetResumeSubs(true)
	opts.SetConnectionLostHandler(func(_ mqtt.Client, err error) {
		logger.Printf("mqtt connection lost: %v\n", err)
	})
	opts.SetOnConnectHandler(func(c mqtt.Client) {
		logger.Printf("mqtt connected, clientID=%s\n", clientID)
		go func() {
			for _, topic := range topics {
				token := c.Subscribe(topic, 0, handler)
				if token.Wait() && token.Error() != nil {
					logger.Printf("subscribe %s: %v\n", topic, token.Error())
					continue
				}
				logger.Println("subscribed:", topic)
			}
		}()
	})

	client := mqtt.NewClient(opts)
	if token := client.Connect(); token.Wait() && token.Error() != nil {
		logger.Println("connect:", token.Error())
	}

	logger.Println("Press Ctrl+C to stop")

	<-ctx.Done()

	logger.Println("disconnecting...")
	client.Disconnect(1000)
}
