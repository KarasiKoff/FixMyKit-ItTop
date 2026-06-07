# Мониторинг Fix My Kit

Запуск **из корня репозитория**. Конфиги — в каталоге `monitoring/`, переменные — в `.env.monitoring`.

## Три сценария (локалка + prod)

| # | Сценарий | Когда использовать |
|---|----------|-------------------|
| **1** | **Локалка** | Dev-стек (`docker-compose.yml`) + мониторинг в отдельном проекте `fmk-monitoring` |
| **2** | **Prod A — bundle** | Один VPS: prod + мониторинг **одной** командой → [`PRODUCTION.md`](PRODUCTION.md#a-всё-на-одном-сервере-bundle) |
| **3** | **Prod B — link** | Один VPS: prod и мониторинг **разными** compose → [`PRODUCTION.md`](PRODUCTION.md#b-prod-и-мониторинг-раздельно-один-vps-два-compose) |
| **4** | **Prod C — remote** | **Два VPS**: prod и monitoring на разных машинах → [`PRODUCTION.md`](PRODUCTION.md#c-prod-и-мониторинг-на-разных-vps) |

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

### 2. Prod и мониторинг вместе (сценарий A — один сервер)

Один VPS, один `docker compose`. Подробно: [`monitoring/PRODUCTION.md`](PRODUCTION.md#a-всё-на-одном-сервере-bundle).

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

### 3. Prod отдельно, мониторинг отдельно (сценарий B — один VPS, два compose)

Prod уже работает; мониторинг добавляется вторым проектом. Подробно: [`monitoring/PRODUCTION.md`](PRODUCTION.md#b-prod-и-мониторинг-раздельно-один-vps-два-compose).

```bash
cp .env.monitoring.prod-standalone.example .env.monitoring

# Сначала prod
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# Потом мониторинг (проект fmk-monitoring, сеть fixmykit-prod)
docker compose -p fmk-monitoring \
  -f docker-compose.monitoring.yml \
  -f docker-compose.monitoring.prod-link.yml \
  --env-file .env.monitoring up -d --build
```

Остановка только мониторинга: `docker compose -p fmk-monitoring -f docker-compose.monitoring.yml down` — prod не трогается.

---

### 4. Prod и мониторинг на разных VPS (сценарий C)

Prod на одной машине, Grafana/Prometheus на другой. Env: `.env.monitoring.prod-remote.example`.  
Подробно: [`monitoring/PRODUCTION.md`](PRODUCTION.md#c-prod-и-мониторинг-на-разных-vps).

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
| **Fix My Kit — Backend** | Prometheus (`fixmykit-backend.json`) — HTTP, latency, логи (встроенная панель) |
| **Fix My Kit — Операции** | PostgreSQL (`fixmykit-operations.json`) — заявки, категории, аудитории |
| **Fix My Kit — Трекер** | PostgreSQL (`fixmykit-tracker.json`) — задачи Яндекс Трекера, sync вложений |
| **Fix My Kit — SLA заявок** | PostgreSQL (`fixmykit-sla.json`) — время закрытия, застрявшие заявки, динамика |
| **Fix My Kit — Инфраструктура** | Prometheus (`fixmykit-infra.json`) — API/БД up, postgres-exporter, cAdvisor |
| **Fix My Kit — Логи** | Loki (`fixmykit-logs.json`) — ERROR/WARNING, Трекер, HTTP 4xx/5xx |
| **Fix My Kit — Оборудование** | PostgreSQL (`fixmykit-equipment.json`) — хроники, % в ремонте, неполный каталог |
| **Fix My Kit — Качество закрытия** | PostgreSQL (`fixmykit-quality.json`) — «Решен» / «Не будет исправлено», NEEDS_INFO |
| **Fix My Kit — Алерты и SLO** | Prometheus (`fixmykit-alerts.json`) — uptime, firing alerts, HTTP error rate |
| **Fix My Kit — Пользователи** | PostgreSQL + Loki (`fixmykit-users.json`) — роли, закрытия, комментарии, входы |
| **Fix My Kit — API детализация** | Prometheus (`fixmykit-api-detail.json`) — latency/RPS/ошибки по handler |
| **Fix My Kit — Трекер (техн.)** | PostgreSQL + Loki (`fixmykit-tracker-tech.json`) — sync, вложения, webhook |
| **Fix My Kit — Админ-статистика** | PostgreSQL (`fixmykit-admin-stats.json`) — как `/api/admin/stats` с периодом |
| **Fix My Kit — Объявления** | PostgreSQL (`fixmykit-announcements.json`) — слоты, severity, активность |
| **Fix My Kit — Еженедельный отчёт** | PostgreSQL + Prometheus + Loki (`fixmykit-weekly.json`) — сводка за 7 дней |

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

**Лимит Loki:** хранение логов **7 дней** (`retention_period: 168h`). Stat-панели с Loki используют окно `[7d]`, не `$__range` — иначе при широком периоде Grafana ошибка `query time range exceeds the limit (30d)`.

На дашборде **Backend**: **Log service** = `backend`, **Log filter** — подстрока.  
Отдельный дашборд **Логи** — агрегаты по `level`, потоки ERROR / Трекер / HTTP.

## Инфраструктура (cAdvisor)

В стеке есть **cAdvisor** (`fmk-cadvisor`, порт `CADVISOR_PORT`, по умолчанию **8089**). Prometheus job `fmk-cadvisor` — метрики CPU/RAM контейнеров `fixmykit-*` и `fmk-*` на дашборде **Инфраструктура**.

На **Docker Desktop (Windows)** cAdvisor часто **не видит отдельные контейнеры** (в логах `fmk-cadvisor`: `failed to identify the read-write layer ID`). Это ограничение Docker Desktop, не баг приложения.

На **Linux prod** дашборд **Инфраструктура** фильтрует контейнеры по `container_label_com_docker_compose_project` (`fixmykit-prod`, `fmk-monitoring`). Если панели CPU/RAM пустые — см. раздел ниже.

### cAdvisor на prod: «Нет данных»

1. **Панель «cAdvisor» (up)** на дашборде Инфраструктура — должна быть **1**. Если **0**:
   ```bash
   docker ps --filter name=fmk-cadvisor
   docker logs fmk-cadvisor --tail 30
   ```
   Пересоздайте с `privileged: true` (в `docker-compose.monitoring.yml` уже так):
   ```bash
   docker compose -p fmk-monitoring -f docker-compose.monitoring.yml \
     -f docker-compose.monitoring.prod-link.yml \
     --env-file .env.monitoring up -d --force-recreate cadvisor prometheus
   ```

2. **Prometheus → Targets → `fmk-cadvisor`** — State **UP**.

3. **Есть ли метрики** (на VPS):
   ```bash
   curl -s 'http://127.0.0.1:9090/api/v1/query?query=container_cpu_usage_seconds_total' | head -c 500
   ```
   Пусто → cAdvisor не видит контейнеры (права, cgroup v2).

4. **Проверка labels** в Prometheus UI → Graph:
   ```promql
   count by (container_label_com_docker_compose_project) (container_memory_usage_bytes{image!=""})
   ```
   Должны быть `fixmykit-prod` и/или `fmk-monitoring`.

## Устранение неполадок

### Prometheus: API «лежит», хотя бэкенд работает

В **Targets** ошибка `lookup backend: no such host` — контейнер `fmk-prometheus` **не в сети** `fixmykit-dev`.

Частая причина: мониторинг пересоздали **без** overlay для локалки:

```bash
# неверно (только базовый compose)
docker compose -p fmk-monitoring -f docker-compose.monitoring.yml ...

# верно для сценария 1
docker compose -p fmk-monitoring \
  -f docker-compose.monitoring.yml \
  -f docker-compose.monitoring.local.yml \
  --env-file .env.monitoring up -d
```

Проверка: http://localhost:9090/targets → job `fmk-backend` должен быть **UP**.

**Альтернатива без общей Docker-сети** (если API проброшен на хост `:8000`):

```env
BACKEND_METRICS_TARGET=host.docker.internal:8000
```

## Безопасность

Не выставляйте порты 9090/3000/9093 в интернет без защиты.

**Production:** пошаговый выкат с поддоменом Grafana, закрытым `/metrics` и localhost-портами — [`PRODUCTION.md`](PRODUCTION.md).  
Примеры nginx: [`deploy/nginx-fixmykit-monitoring.example.conf`](../deploy/nginx-fixmykit-monitoring.example.conf), блок `/metrics` в [`deploy/nginx-fixmykit.example.conf`](../deploy/nginx-fixmykit.example.conf).

## Алерты в Telegram

Цепочка: **Prometheus** → **Alertmanager** → **alertserver** → Telegram Bot API.

В `.env.monitoring`:

```env
TG_BOT_ALERT_TOKEN=123456:ABC...   # @BotFather
TG_ALERT_CHAT_ID=-100...           # chat id или @channel
```

Alertmanager шлёт POST на `http://alertserver:8080/alert` (сервис `fmk-alertserver` в compose).  
Правила алертов — [`prometheus/alerts.yml`](prometheus/alerts.yml).

Проверка вручную (из сети мониторинга):

```bash
curl -X POST http://localhost:9093/api/v2/alerts -H 'Content-Type: application/json' -d '[]'
# или дождаться firing rule в Prometheus → Alertmanager → Telegram
```

Если бот получает **429 Too Many Requests** — уменьшите частоту правил или добавьте `group_wait` / `repeat_interval` в [`alertmanager/alertmanager.yml`](alertmanager/alertmanager.yml).

**Telegram через VPN (VLESS / Hysteria2):** VPN нужен **`alertserver`**, не Alertmanager. Профиль `telegram-vpn` + sing-box — [`vpn/README.md`](vpn/README.md).
