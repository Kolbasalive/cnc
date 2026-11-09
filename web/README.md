# CNC Web

Фронтенд для CNC API: обзор стендов, телеметрия, MQTT-топики и аналитика.

## Стек

- React 19 + TypeScript + Vite
- Tailwind CSS 4
- TanStack Query (polling каждые 5 секунд)
- ECharts
- Типы API генерируются из `api/openapi.yaml` через `openapi-typescript`

## Запуск

Бэкенд должен быть доступен на `http://127.0.0.1:8080`:

```bash
cd api
go run .
```

Фронтенд:

```bash
cd web
npm install
npm run dev
```

Открой `http://localhost:5173`. Vite проксирует `/api` на `127.0.0.1:8080`,
поэтому CORS и отдельный base URL не нужны.

Если API живёт по другому адресу:

```bash
VITE_API_PROXY=http://192.168.1.10:8080 npm run dev
```

Если фронт и API на разных origin и прокси не используется:

```bash
VITE_API_BASE_URL=https://cnc.example.com npm run build
```

PowerShell:

```powershell
$env:VITE_API_PROXY = "http://192.168.1.10:8080"
npm run dev
```

## Скрипты

| Команда           | Что делает                                     |
| ----------------- | ---------------------------------------------- |
| `npm run dev`     | dev-сервер с HMR                               |
| `npm run build`   | проверка типов и production-сборка в `dist/`   |
| `npm run preview` | локальный просмотр собранной версии            |
| `npm run gen:api` | перегенерировать типы из `../api/openapi.yaml` |
| `npm run check`   | Biome lint/format                              |

## Структура

```
src/
  api/          клиент openapi-fetch, типы и React Query-хуки
  components/   UI-примитивы, карточки стендов, графики
  lib/          форматирование времени, диапазоны, статусы
  pages/        обзор, стенд, MQTT, аналитика
```

## Что дальше

- nginx: отдавать `dist/` и проксировать `/api` на Go-бэкенд.
- Добавить graphana-подобный kiosk-режим для цеха.
- Экспорт журнала ошибок в CSV.
