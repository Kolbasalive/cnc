-- Демо-данные для локального просмотра дашборда.
-- Запуск: psql -p 55432 -U cnc -d cnc -f seed-demo.sql

DO $$
DECLARE
    v_stand integer;
    v_i integer;
    v_id bigint;
    v_received timestamptz;
    v_status text;
    v_mode text;
    v_program text;
    v_percent integer;
    v_kernel text;
BEGIN
    FOREACH v_stand IN ARRAY ARRAY[3, 5] LOOP
        FOR v_i IN 0..1439 LOOP
            v_received := now() - make_interval(mins => 1439 - v_i);
            v_status := CASE
                WHEN (v_i % 720) BETWEEN 710 AND 719 THEN 'Ошибка'
                WHEN (v_i % 180) BETWEEN 170 AND 179 THEN 'Готов'
                ELSE 'Работа'
            END;
            v_mode := CASE WHEN (v_i % 300) BETWEEN 290 AND 299 THEN 'Ручной' ELSE 'Авто' END;
            v_program := CASE WHEN (v_i % 480) < 240 THEN 'O1000.NC' ELSE 'O2000.NC' END;
            v_percent := (v_i * 7) % 101;
            v_kernel := format('%s:%s:00', 700 + (v_i / 60), lpad((v_i % 60)::text, 2, '0'));

            INSERT INTO cnc_status_snapshots (
                stand_id, received_at,
                core_runtime_total, core_runtime_current, core_restarts, channel_count,
                channel_runtime_total, channel_runtime_current,
                status, mode, program_time, program_percent, program_name,
                sections, payload
            ) VALUES (
                v_stand, v_received,
                '721:47:42', v_kernel, 2, 1,
                '1200:00:00', format('%s:%s:00', 1200 + (v_i / 60), lpad((v_i % 60)::text, 2, '0')),
                v_status, v_mode, format('%s:%s:00', (v_i / 60) % 24, lpad((v_i % 60)::text, 2, '0')),
                v_percent, v_program, '{}'::jsonb, '{}'::jsonb
            ) RETURNING id INTO v_id;

            INSERT INTO cnc_axes (snapshot_id, channel, axis, position_mm) VALUES
                (v_id, 1, 'X', round((sin(v_i / 30.0) * 40 + v_stand * 10)::numeric, 3)),
                (v_id, 1, 'Z', round((cos(v_i / 45.0) * 80 - v_stand * 5)::numeric, 3));

            IF v_i % 180 = 0 THEN
                INSERT INTO cnc_errors (snapshot_id, channel, code, reported_at, message, description, action)
                VALUES (
                    v_id, 1, 'E' || (100 + (v_i % 5)), v_received - interval '15 seconds',
                    'Перегрев привода', 'Температура привода выше нормы',
                    'Остановить цикл и проверить охлаждение'
                );
            END IF;
        END LOOP;
    END LOOP;
END $$;

INSERT INTO sensor_readings (received_at, source, stand_id, metric, value)
SELECT now() - make_interval(mins => 1439 - i), 'demodata', NULL, 'temp',
       round((22 + 3 * sin(i / 60.0))::numeric, 2)
FROM generate_series(0, 1439) AS i;

INSERT INTO sensor_readings (received_at, source, stand_id, metric, value)
SELECT now() - make_interval(mins => 1439 - i), 'demodata', NULL, 'humidity',
       round((45 + 10 * sin(i / 80.0))::numeric, 2)
FROM generate_series(0, 1439) AS i;

INSERT INTO sensor_readings (received_at, source, stand_id, metric, value)
SELECT now() - make_interval(mins => 1439 - i), 'stand', s.id, 'temp',
       round((24 + 2 * sin(i / 50.0) + s.id / 10.0)::numeric, 2)
FROM generate_series(0, 1439) AS i
CROSS JOIN stands s;

INSERT INTO sensor_readings (received_at, source, stand_id, metric, value)
SELECT now() - make_interval(mins => 1439 - i), 'stand', s.id, 'humidity',
       round((50 + 8 * sin(i / 70.0) + s.id / 20.0)::numeric, 2)
FROM generate_series(0, 1439) AS i
CROSS JOIN stands s;

INSERT INTO sensor_readings (received_at, source, stand_id, metric, value)
SELECT now() - make_interval(mins => 1439 - i), 'demo_lathe', NULL, 'temp',
       round((20 + 6 * sin(i / 30.0))::numeric, 2)
FROM generate_series(0, 1439) AS i;

INSERT INTO sensor_readings (received_at, source, stand_id, metric, value)
SELECT now() - make_interval(mins => 1439 - i), 'demo_lathe', NULL, 'humidity',
       CASE
           WHEN i % 97 = 0 THEN round((20 + 6 * sin(i / 30.0))::numeric, 2)
           ELSE round((30 + 10 * sin(i / 40.0))::numeric, 2)
       END
FROM generate_series(0, 1439) AS i;

INSERT INTO demo_lathe_signals (received_at, signal, value_num, value_text)
SELECT now() - make_interval(mins => 1439 - i), 'x',
       round((sin(i / 25.0) * 30)::numeric, 3),
       round((sin(i / 25.0) * 30)::numeric, 3)::text
FROM generate_series(0, 1439) AS i;

INSERT INTO demo_lathe_signals (received_at, signal, value_num, value_text)
SELECT now() - make_interval(mins => 1439 - i), 'z',
       round((cos(i / 35.0) * 55)::numeric, 3),
       round((cos(i / 35.0) * 55)::numeric, 3)::text
FROM generate_series(0, 1439) AS i;

INSERT INTO demo_lathe_signals (received_at, signal, value_num, value_text)
SELECT now() - make_interval(mins => 1439 - i), 'program', NULL,
       CASE WHEN i % 480 < 240 THEN 'DEMO-1.NC' ELSE 'DEMO-2.NC' END
FROM generate_series(0, 1439) AS i;

INSERT INTO demo_lathe_signals (received_at, signal, value_num, value_text)
SELECT now() - make_interval(mins => 1439 - i), 'program_percent',
       round(((i * 9) % 101)::numeric, 0),
       ((i * 9) % 101)::text
FROM generate_series(0, 1439) AS i;

INSERT INTO mqtt_messages (received_at, topic, value_num, value_text)
SELECT now() - make_interval(mins => 1439 - i), 'sensor/t3',
       round((24 + 2 * sin(i / 50.0))::numeric, 2),
       round((24 + 2 * sin(i / 50.0))::numeric, 2)::text
FROM generate_series(0, 1439) AS i;

INSERT INTO mqtt_messages (received_at, topic, value_num, value_text)
SELECT now() - make_interval(mins => 1439 - i), 'sensor/t5',
       round((25 + 2 * sin(i / 60.0))::numeric, 2),
       round((25 + 2 * sin(i / 60.0))::numeric, 2)::text
FROM generate_series(0, 1439) AS i;

INSERT INTO mqtt_messages (received_at, topic, value_num, value_text)
SELECT now() - make_interval(mins => 1439 - i), 'demodata/temp',
       round((22 + 3 * sin(i / 60.0))::numeric, 2),
       round((22 + 3 * sin(i / 60.0))::numeric, 2)::text
FROM generate_series(0, 1439) AS i;

INSERT INTO mqtt_messages (received_at, topic, value_num, value_text)
SELECT now() - make_interval(mins => 1439 - i), 'demodata/humidity',
       round((45 + 10 * sin(i / 80.0))::numeric, 2),
       round((45 + 10 * sin(i / 80.0))::numeric, 2)::text
FROM generate_series(0, 1439) AS i;

INSERT INTO mqtt_messages (received_at, topic, value_num, value_text)
SELECT now() - make_interval(mins => 1439 - i), 'demo_lathe/x',
       round((sin(i / 25.0) * 30)::numeric, 3),
       round((sin(i / 25.0) * 30)::numeric, 3)::text
FROM generate_series(0, 1439) AS i;

INSERT INTO mqtt_messages (received_at, topic, value_num, value_text)
SELECT now() - make_interval(mins => 1439 - i), 'demo_lathe/z',
       round((cos(i / 35.0) * 55)::numeric, 3),
       round((cos(i / 35.0) * 55)::numeric, 3)::text
FROM generate_series(0, 1439) AS i;

INSERT INTO mqtt_messages (received_at, topic, value_num, value_text)
SELECT now() - make_interval(mins => 1439 - i), 'demo_lathe/program', NULL,
       CASE WHEN i % 480 < 240 THEN 'DEMO-1.NC' ELSE 'DEMO-2.NC' END
FROM generate_series(0, 1439) AS i;

INSERT INTO mqtt_messages (received_at, topic, value_num, value_text)
SELECT now() - make_interval(mins => 1439 - i), 'status/t3', NULL,
       CASE WHEN i % 180 < 170 THEN 'Работа' ELSE 'Готов' END
FROM generate_series(0, 1439) AS i;
