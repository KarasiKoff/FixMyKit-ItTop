# Мониторинг Fix My Kit

Запуск **из корня репозитория**. Конфиги — в каталоге `monitoring/`, переменные — в `.env.monitoring`.

## Три сценария

| # | Сценарий | Когда использовать |
|---|----------|-------------------|
| **1** | **Локалка** | Dev-стек (`docker-compose.yml`) + мониторинг в отдельном проекте `fmk-monitoring` |
| **2** | **Prod = prod** | Продакшен и мониторинг **одной** командой, общая сеть `fixmykit-prod` |
| **3** | **Prod отдельно** | Сначала только prod, потом мониторинг отдельно (подключается к сети prod) |

### 1. Локалка

```bash
cp .env.monitoring.local.example .env.monitoring

# Приложение (dev)
docker compose --env-file .env up -d

# Мониторинг (отдельный проект, сеть fixmykit-dev)
docker compose -p fmk-monitoring \
  -f docker-compose.monitoring.yml \
  -f docker-compose.monitoring.local.yml \
  --env-file .env.monitoring up -d --build
```

Scrape: `backend:8000`, PostgreSQL: `postgres:5432` (сеть `fixmykit-dev`).

Без Docker dev-стека можно поднять только мониторинг с `BACKEND_METRICS_TARGET=host.docker.internal:8000` (базовый `docker-compose.monitoring.yml` без overlay).

---

### 2. Prod и мониторинг вместе

```bash
cp .env.monitoring.prod.example .env.monitoring
# POSTGRES_PASSWORD и секреты — как в .env.production

docker compose \
  -f docker-compose.prod.yml \
  -f docker-compose.monitoring.yml \
  -f docker-compose.monitoring.prod-bundle.yml \
  --env-file .env.production \
  --env-file .env.monitoring up -d --build
```

Один проект `fixmykit-prod`: API, БД, Grafana, Prometheus и т.д.

---

### 3. Prod отдельно, мониторинг отдельно

```bash
cp .env.monitoring.prod-standalone.example .env.monitoring

# Сначала prod
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# Потом мониторинг (проект fmk-monitoring, внешняя сеть fixmykit-prod)
docker compose -p fmk-monitoring \
  -f docker-compose.monitoring.yml \
  -f docker-compose.monitoring.prod-link.yml \
  --env-file .env.monitoring up -d --build
```

Остановка только мониторинга: `docker compose -p fmk-monitoring -f docker-compose.monitoring.yml down` — prod не трогается.

---

## Файлы

| Файл | Назначение |
|------|------------|
| `docker-compose.monitoring.yml` | Базовый стек (Loki, Prometheus, Grafana, …) |
| `docker-compose.monitoring.local.yml` | Overlay для сценария 1 |
| `docker-compose.monitoring.prod-bundle.yml` | Overlay для сценария 2 |
| `docker-compose.monitoring.prod-link.yml` | Overlay для сценария 3 |
| `.env.monitoring.*.example` | Шаблоны переменных по сценарию |

## UI

| Сервис | URL |
|--------|-----|
| Grafana | http://localhost:3000 |
| Prometheus | http://localhost:9090 |
| Alertmanager | http://localhost:9093 |

В Grafana (папка **Fix My Kit**):

| Дашборд | Источник |
|---------|----------|
| **Fix My Kit — Backend** | Prometheus (`fixmykit-backend.json`) |
| **Fix My Kit — Операции** | PostgreSQL (`fixmykit-operations.json`) — заявки, категории, аудитории, «в ремонте» |

Для дашборда **Операции** в `.env.monitoring`:

```env
GRAFANA_POSTGRES_URL=postgres:5432
POSTGRES_USER=fixmykit
POSTGRES_PASSWORD=...   # как в .env / .env.production
POSTGRES_DB=fixmykit
```

Важно: **одна строка `хост:порт`**, не `POSTGRES_HOST=postgres:5432` + отдельный порт (иначе URL ломается).  
Grafana должна быть в сети БД — используйте overlay `monitoring.local.yml` или `monitoring.prod-link.yml` (там это уже настроено).

Проверка: Grafana → **Connections** → **PostgreSQL** → **Save & test**.  
Если «No data» на дашборде, но тест OK — в БД пусто; если тест FAIL — сеть или пароль.

API: `GET /metrics` на бэкенде.

### Проверка 4xx / 5xx в Prometheus

Метки статуса — **`4xx`** / **`5xx`**, не `400`/`500`. Запросы с `/health/*` в метрики не попадают (`should_ignore_untemplated`).

```bash
# dev, API_DOCS_ENABLED=true
curl http://127.0.0.1:8000/api/debug/test-400
curl http://127.0.0.1:8000/api/debug/test-500
```

В Grafana Explore:

```promql
sum(rate(http_requests_total{job="fmk-backend", status="4xx"}[5m]))
sum(rate(http_requests_total{job="fmk-backend", status="5xx"}[5m]))
```

Для быстрой проверки без `rate` (мало scrape):  
`sum(increase(http_requests_total{job="fmk-backend", status="4xx"}[15m]))`

## Логи в Loki

**Promtail** (`fmk-promtail`) читает `fixmykit.log` / `fixmykit-error.log` и отправляет в Loki с меткой **`service=backend`**.

| Сценарий | Источник файлов |
|----------|-----------------|
| Локалка | `./data/logs` → `PROMTAIL_LOG_DIR` в `.env.monitoring` |
| Prod (link / bundle) | volume `fixmykit-logs-prod` (тот же, что у бэкенда) |

Проверка: Grafana → **Explore** → Loki → `{service="backend"}`.

На дашборде: **Log service** = `backend`, **Log filter** — подстрока (пустое поле = все строки).

## Безопасность

Не выставляйте порты 9090/3000/9093 в интернет без защиты.
