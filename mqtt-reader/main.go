package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	ctx := context.Background()

	//postgreSQL
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		fmt.Println("db: DATABASE_URL не задана")
		os.Exit(1)
	}

	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		fmt.Println("db pool:", err)
		os.Exit(1)
	}
	defer pool.Close()

	//Check db
	if err := pool.Ping(ctx); err != nil {
		fmt.Println("db ping:", err)
		os.Exit(1)
	}
	fmt.Println("database connected")
	
	//MQTT
	opts := mqtt.NewClientOptions()
	opts.AddBroker("tcp://91.240.87.171:1883")
	opts.SetUsername(os.Getenv("MQTT_USERNAME"))
	opts.SetPassword(os.Getenv("MQTT_PASSWORD"))
	opts.SetClientID("mqtt-reader-karp")
	opts.SetAutoReconnect(true)

	client := mqtt.NewClient(opts)

	if token := client.Connect(); token.Wait() && token.Error() != nil {
		fmt.Println("connect:", token.Error())
		os.Exit(1)
	}
	fmt.Println("mqtt connected")

	handler := func(_ mqtt.Client, msg mqtt.Message) {
		receivedAt := time.Now()
		topic := msg.Topic()
		valueText := string(msg.Payload())

		var valueNum *float64
		if n, err := strconv.ParseFloat(valueText, 64); err == nil {
			valueNum = &n
		}

		_, err := pool.Exec(ctx, `
			INSERT INTO mqtt_messages
				(received_at, topic, value_num, value_text)
			VALUES ($1, $2, $3, $4)
		`, receivedAt, topic, valueNum, valueText)

		if err != nil {
			fmt.Printf("DB INSERT ERROR: topic=%s error=%v\n", topic, err)
			return
		}

		fmt.Printf("SAVED: %s | %s | %s\n",
			receivedAt.Format(time.RFC3339),
			topic,
			valueText,
		)
	}
	
	topics := []string{
		"demodata/#",
		"sensor/#",
		"cncmqtt/#",
		"cnc/lathe/#",
	}

	for _, topic := range topics {
		if token := client.Subscribe(topic, 0, handler); token.Wait() && token.Error() != nil {
			fmt.Println("subscribe:", token.Error())
			client.Disconnect(1000)
			os.Exit(1)
		}
		fmt.Println("subscribed:", topic)
	}

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig

	fmt.Println("disconnecting...")
	client.Disconnect(1000)
}

