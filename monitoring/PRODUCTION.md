# Мониторинг на production

Два основных способа выката на prod + вариант с **двумя VPS**.

| Документ | Содержание |
|----------|------------|
| [`README.md`](README.md) | Локалка, дашборды, troubleshooting |
| Здесь | Prod: один сервер / раздельно / два VPS, nginx, безопасность |

---

## Какой способ выбрать

| | **A. Всё на одном сервере** | **B. Prod и мониторинг раздельно (один VPS)** | **C. Два VPS** |
|---|---------------------------|-----------------------------------------------|----------------|
| **Compose** | Один проект `fixmykit-prod` | Два проекта: prod + `fmk-monitoring` | Prod на VPS-1, monitoring на VPS-2 |
| **Overlay** | `prod-bundle.yml` | `prod-link.yml` | Без `prod-link` (нет общей Docker-сети) |
| **Env-шаблон** | [`.env.monitoring.prod.example`](../.env.monitoring.prod.example) | [`.env.monitoring.prod-standalone.example`](../.env.monitoring.prod-standalone.example) | [`.env.monitoring.prod-remote.example`](../.env.monitoring.prod-remote.example) |
| **Когда** | Новый VPS, поднимаете всё с нуля | Prod **уже работает**, мониторинг добавляете позже | Изоляция, отдельная машина под Grafana/Prometheus |
| **Scrape `/metrics`** | `backend:8000` (Docker-сеть) | `backend:8000` через сеть `fixmykit-prod` | IP prod + nginx allowlist или VPN |
| **PostgreSQL в Grafana** | `postgres:5432` | `postgres:5432` | IP prod + firewall + `grafana_ro` |
| **Loki / promtail** | Volume логов prod | Volume `fixmykit-logs-prod` | ⚠️ promtail на monitoring-VPS **не видит** логи prod |
| **cAdvisor** | Метрики **этого** хоста | То же | Только monitoring-VPS (не контейнеры prod) |
| **Обновление** | Одна команда, всё вместе | `up -d` мониторинга **не трогает** prod | Независимо на каждом VPS |

**Практика:** один VPS → **B** (если prod уже есть) или **A** (с нуля). Два VPS → **C** + VPN или жёсткий firewall.

---

## Общее для всех prod-сценариев

### Поддомен Grafana

```
grafana.fixmykit.example.com  →  127.0.0.1:3000  (на том VPS, где крутится Grafana)
```

- Конфиг: [`deploy/nginx-fixmykit-monitoring.example.conf`](../deploy/nginx-fixmykit-monitoring.example.conf)
- HTTPS (Let's Encrypt) + **basic auth** nginx + логин Grafana
- В env: `GRAFANA_ROOT_URL=https://grafana.fixmykit.example.com`

### Порты мониторинга — только localhost

```env
GRAFANA_PORT=127.0.0.1:3000:3000
PROMETHEUS_PORT=127.0.0.1:9090:9090
ALERTMANAGER_PORT=127.0.0.1:9093:9093
LOKI_PORT=127.0.0.1:3100:3100
CADVISOR_PORT=127.0.0.1:8089:8080
POSTGRES_EXPORTER_PORT=127.0.0.1:9187:9187
```

Prometheus / Alertmanager / Loki **не** выставляются в интернет — только Grafana через nginx.

### Закрыть `/metrics` с интернета (на prod / api nginx)

Prometheus **в сценариях A и B** ходит на `backend:8000` **внутри Docker**, не через публичный `api.*`.

Снаружи:

```nginx
location = /metrics {
    deny all;
    return 404;
}
```

Полный пример — [`deploy/nginx-fixmykit.example.conf`](../deploy/nginx-fixmykit.example.conf).

### Read-only пользователь PostgreSQL для Grafana

```sql
CREATE ROLE grafana_ro WITH LOGIN PASSWORD '...' NOSUPERUSER NOCREATEDB NOCREATEROLE;
GRANT CONNECT ON DATABASE fixmykit TO grafana_ro;
GRANT USAGE ON SCHEMA public TO grafana_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO grafana_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO grafana_ro;
```

В `.env.monitoring`: `POSTGRES_USER=grafana_ro`.

### Telegram

`TG_BOT_ALERT_TOKEN`, `TG_ALERT_CHAT_ID` в `.env.monitoring`.  
`JSM_OPS_API_KEY`, `JSM_OPS_TEAM` — алерты **critical** в Jira Service Management (см. [`README.md`](README.md#алерты-в-jira-service-management)).  
При 429 — увеличить `repeat_interval` в [`alertmanager/alertmanager.yml.template`](alertmanager/alertmanager.yml.template).

---

## A. Всё на одном сервере (bundle)

Один VPS, один `docker compose`: приложение + Postgres + Redis + Grafana + Prometheus + …

### Схема

```
VPS (один)
├── nginx: app.*, api.*, grafana.*
├── docker project fixmykit-prod
│   ├── fixmykit-backend-prod, postgres, redis, frontend
│   └── fmk-grafana, fmk-prometheus, fmk-loki, …
└── сеть fixmykit-prod: prometheus → backend:8000/metrics
```

### Env

```bash
cp .env.production.example .env.production
cp .env.monitoring.prod.example .env.monitoring
# POSTGRES_PASSWORD, GRAFANA_*, TG_*, GRAFANA_ROOT_URL=https://grafana...
```

### Запуск

```bash
docker compose \
  -f docker-compose.prod.yml \
  -f docker-compose.monitoring.yml \
  -f docker-compose.monitoring.prod-bundle.yml \
  --env-file .env.production \
  --env-file .env.monitoring up -d --build
```

### Nginx

На **этом же** сервере три vhost (или один cert на три имени):

- `app.*` → `127.0.0.1:8080`
- `api.*` → `127.0.0.1:8001` (+ блок `/metrics`)
- `grafana.*` → `127.0.0.1:3000`

### Обновление

```bash
git pull
docker compose \
  -f docker-compose.prod.yml \
  -f docker-compose.monitoring.yml \
  -f docker-compose.monitoring.prod-bundle.yml \
  --env-file .env.production \
  --env-file .env.monitoring up -d --build
```

### Плюсы / минусы

- ✅ Проще всего: одна сеть Docker, Loki видит логи, cAdvisor — все контейнеры
- ❌ Перезапуск/обновление мониторинга в одном проекте с prod
- ❌ Нагрузка Grafana/Prometheus на тот же CPU/RAM, что и приложение

---

## B. Prod и мониторинг раздельно (один VPS, два compose)

Prod уже работает. Мониторинг — **отдельный** проект `fmk-monitoring`, подключается к Docker-сети `fixmykit-prod`.

### Схема

```
VPS (один)
├── nginx: app.*, api.*, grafana.*
├── docker compose fixmykit-prod     → backend, postgres, …
└── docker compose fmk-monitoring   → grafana, prometheus, …
         └── networks: fixmykit-prod (external) + fmk-monitoring
```

### Env

```bash
cp .env.monitoring.prod-standalone.example .env.monitoring
```

Ключевое:

```env
BACKEND_METRICS_TARGET=backend:8000
GRAFANA_POSTGRES_URL=postgres:5432
POSTGRES_PASSWORD=<как в .env.production>
```

### Запуск

```bash
# 1) Prod (если ещё не поднят)
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# 2) Мониторинг
docker compose -p fmk-monitoring \
  -f docker-compose.monitoring.yml \
  -f docker-compose.monitoring.prod-link.yml \
  --env-file .env.monitoring up -d --build
```

### Nginx

Как в сценарии A — Grafana на этом VPS, `127.0.0.1:3000`.

### Обновление

**Только мониторинг** (prod не трогаем):

```bash
docker compose -p fmk-monitoring \
  -f docker-compose.monitoring.yml \
  -f docker-compose.monitoring.prod-link.yml \
  --env-file .env.monitoring up -d --build
```

**Только prod:**

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build backend frontend
```

### Остановка мониторинга

```bash
docker compose -p fmk-monitoring \
  -f docker-compose.monitoring.yml \
  -f docker-compose.monitoring.prod-link.yml down
```

Prod продолжит работать.

### Плюсы / минусы

- ✅ Prod можно обновлять отдельно; мониторинг — отдельно
- ✅ Полный Loki + cAdvisor по prod-контейнерам
- ❌ Два compose на одном сервере — чуть сложнее, чем A

**Рекомендуется**, если prod на `app.fixmykit.karasikoff.ru` уже в бою.

---

## C. Prod и мониторинг на разных VPS

Prod на **VPS-1**, Grafana/Prometheus на **VPS-2**. Общей Docker-сети нет — связь по IP/VPN.

### Схема

```
VPS-1 (prod)                         VPS-2 (monitoring)
├── app.*, api.*                     ├── grafana.*
├── backend :127.0.0.1:8001          ├── prometheus, grafana, loki, …
├── postgres                         └── scrape → VPS-1 /metrics (allowlist)
└── nginx: /metrics только с IP VPS-2
```

### Что работает из коробки

| Компонент | Статус |
|-----------|--------|
| Prometheus → HTTP metrics API | ✅ если настроить доступ (ниже) |
| postgres-exporter / Grafana SQL | ✅ если Postgres принимает VPS-2 |
| Дашборды PostgreSQL | ✅ |
| Telegram-алерты | ✅ |
| Loki (логи backend) | ⚠️ нужен promtail **на VPS-1** → Loki на VPS-2 |
| cAdvisor контейнеров prod | ❌ на VPS-2 виден только monitoring-хост |

### 1. Env на VPS-2 (monitoring)

```bash
cp .env.monitoring.prod-remote.example .env.monitoring
```

```env
BACKEND_METRICS_TARGET=<IP_VPS1>:8001
POSTGRES_EXPORTER_HOST=<IP_VPS1>
GRAFANA_POSTGRES_URL=<IP_VPS1>:5432
POSTGRES_USER=grafana_ro
GRAFANA_ROOT_URL=https://grafana.fixmykit.example.com
```

### 2. Запуск на VPS-2

```bash
docker compose -p fmk-monitoring \
  -f docker-compose.monitoring.yml \
  --env-file .env.monitoring up -d --build
```

**Без** `prod-link.yml` — нет сети `fixmykit-prod`.

### 3. Scrape `/metrics` с VPS-2

`backend` на prod слушает `127.0.0.1:8001` — с другой машины напрямую **не достучаться**.

Выберите один вариант:

**Вариант C1 — nginx allowlist (проще)**

На **VPS-1** в `api.*`:

```nginx
location = /metrics {
    allow <IP_VPS2_monitoring>;
    deny all;
    proxy_pass http://127.0.0.1:8001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
}
```

На **VPS-2**:

```env
BACKEND_METRICS_TARGET=<публичный_IP_VPS1>:443
```

⚠️ Scrape по HTTPS на `:443` в текущем [`prometheus.yml`](prometheus/prometheus.yml) — только `host:port` без TLS. Практичнее:

**Вариант C2 — приватная сеть / VPN (рекомендуется)**

WireGuard / Tailscale между VPS. На prod пробросить API только в туннель:

```yaml
# docker-compose.prod.yml — ports (пример, только если осознанно)
# "10.0.0.1:8001:8000"  — IP VPN на VPS-1
```

```env
BACKEND_METRICS_TARGET=10.0.0.1:8001
```

С публичного интернета `/metrics` остаётся закрыт.

### 4. PostgreSQL с VPS-2

На **VPS-1**:

- `listen_addresses` / Docker: Postgres **не** публикуйте в интернет без нужды
- Firewall: `5432` только с IP VPS-2 (или VPN)
- `pg_hba.conf`: `host fixmykit grafana_ro <IP_VPS2>/32 scram-sha-256`

### 5. Loki (опционально)

Promtail в compose на VPS-2 **не прочитает** volume логов prod.

Варианты:

- Promtail на **VPS-1** с `clients.url: http://<VPS2_Loki_IP>:3100/loki/api/v1/push` (правка [`promtail-config.yaml`](promtail/promtail-config.yaml) на prod)
- Или жить без Loki на двух VPS — останутся Prometheus + SQL-дашборды

### 6. Nginx Grafana

Только на **VPS-2**: `grafana.*` → `127.0.0.1:3000` ([`nginx-fixmykit-monitoring.example.conf`](../deploy/nginx-fixmykit-monitoring.example.conf)).

На VPS-1 — только `app.*` и `api.*`.

### Плюсы / минусы

- ✅ Изоляция: падение Grafana не трогает prod stack
- ✅ Можно дать monitoring-доступ без SSH на prod
- ❌ Сложнее сеть, Loki/cAdvisor prod — отдельная настройка
- ❌ Задержка и firewall между VPS

---

## Nginx: Grafana (A, B, C)

```bash
sudo cp deploy/nginx-fixmykit-monitoring.example.conf /etc/nginx/sites-available/fixmykit-monitoring
sudo htpasswd -c /etc/nginx/.htpasswd-fixmykit-grafana admin
sudo ln -sf /etc/nginx/sites-available/fixmykit-monitoring /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

DNS `grafana.*` → IP **того VPS, где Grafana** (для C — VPS-2).

---

## Чеклист после выката

| Проверка | A / B | C |
|----------|-------|---|
| `https://grafana.*/login` | ✅ | ✅ (VPS-2) |
| Prometheus → `fmk-backend` UP | ✅ | ✅ |
| Prometheus → `fmk-db` UP | ✅ | ✅ (если PG доступен) |
| Grafana → PostgreSQL Save & test | ✅ | ✅ |
| Loki `{service="backend"}` | ✅ | ⚠️ если promtail на prod |
| `curl https://api.*/metrics` с ноутбука | 404 | 404 |
| Telegram тестовый алерт | ✅ | ✅ |

---

## SSH-туннель (запасной доступ)

На VPS с Grafana:

```bash
ssh -L 3000:127.0.0.1:3000 -L 9090:127.0.0.1:9090 user@<monitoring-vps>
```

---

## Файлы по сценариям

| Сценарий | Compose |
|----------|---------|
| **A** | `docker-compose.prod.yml` + `docker-compose.monitoring.yml` + `docker-compose.monitoring.prod-bundle.yml` |
| **B** | prod: `docker-compose.prod.yml`; monitoring: `docker-compose.monitoring.yml` + `docker-compose.monitoring.prod-link.yml` |
| **C** | prod: `docker-compose.prod.yml` на VPS-1; monitoring: только `docker-compose.monitoring.yml` на VPS-2 |
