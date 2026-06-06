# Деплой и эксплуатация

Материалы для продакшена Fix My Kit: nginx, вебхуки Трекера, загрузка файлов, runbook.

---

## Файлы в каталоге

| Файл | Назначение |
|------|------------|
| [`nginx-fixmykit.example.conf`](nginx-fixmykit.example.conf) | Reverse proxy: `app.*` → `:8080`, `api.*` → `:8001`, SSE, `client_max_body_size` |
| [`frontend/nginx.conf`](frontend/nginx.conf) | SPA внутри prod-контейнера frontend (`try_files` → `index.html`) |
| [`PRODUCTION_UPLOADS.md`](PRODUCTION_UPLOADS.md) | Ошибка nginx **413** и «Нет связи с сервером» при больших вложениях |
| `yandex-tracker-webhook*.body.example.json` | Примеры тел вебхуков для настройки триггеров в Tracker |

Общая документация: [README.md](../README.md) (разделы **Продакшен**, **Авторизация**, **Интеграция с Яндекс Трекером**).

---

## Первый деплой на VPS

### 1. Подготовка

```bash
git clone <repo-url> fixmykit && cd fixmykit
cp .env.production.example .env.production
# Заполните секреты (см. чеклист ниже)
```

### 2. Запуск Docker

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml ps
curl -sf http://127.0.0.1:8001/health/ready
```

Контейнеры: `fixmykit-postgres-prod`, `fixmykit-redis-prod`, `fixmykit-backend-prod`, `fixmykit-frontend-prod`.

### 3. Nginx на хосте

```bash
sudo cp deploy/nginx-fixmykit.example.conf /etc/nginx/sites-available/fixmykit
# Подставьте домены, при необходимости HTTPS (блок в конце файла)
sudo ln -sf /etc/nginx/sites-available/fixmykit /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Для **api.*** в сертификате Let's Encrypt убедитесь, что SAN включает `api.<домен>` (отдельный cert или wildcard).

### 4. Проверка

| Проверка | Ожидание |
|----------|----------|
| `https://app.<домен>/` | SPA, редирект на login |
| `POST /api/auth/login` | 200 + Set-Cookie |
| `GET /api/auth/me` с cookie | 200 |
| `POST /api/auth/logout` | 204, cookie сброшен |
| Загрузка вложений | не 413 (см. PRODUCTION_UPLOADS.md) |

---

## Обновление версии

```bash
cd fixmykit
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build backend frontend
```

Backend при старте выполняет `alembic upgrade head`. Логи:

```bash
docker logs -f fixmykit-backend-prod --tail 100
```

Пересборка только backend (без frontend):

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build backend
```

---

## Чеклист `.env.production`

| Переменная | Заметка |
|------------|---------|
| `POSTGRES_PASSWORD` | Обязательно |
| `JWT_SECRET_KEY` | `python -c "import secrets; print(secrets.token_urlsafe(32))"` |
| `ADMIN_LOGIN` / `ADMIN_PASSWORD` | Только при первом bootstrap |
| `CORS_ORIGINS` | `https://app.<домен>` — без `/` в конце |
| `PUBLIC_FRONTEND_BASE_URL` | Тот же URL, что у фронта |
| `VITE_API_BASE_URL` | `https://api.<домен>` — **пересборка frontend** при смене |
| `AUTH_COOKIE_SECURE=true` | HTTPS обязателен |
| `AUTH_COOKIE_SAMESITE=none` | Cross-subdomain app ↔ api |
| `AUTH_COOKIE_DOMAIN=.<домен>` | С ведущей точкой |
| `REDIS_URL=redis://redis:6379/0` | Сервис из compose |
| `REALTIME_BACKEND=redis` | SSE между воркерами |
| `TRACKER_*` | Токен, org, queue, webhook secret |
| `API_DOCS_ENABLED=false` | На prod |

---

## Backup PostgreSQL

```bash
# Разовый дамп в каталог на хосте
docker exec fixmykit-postgres-prod pg_dump -U fixmykit -Fc fixmykit \
  > "fixmykit-$(date +%Y%m%d-%H%M).dump"

# Восстановление (осторожно: перезапишет БД)
cat backup.dump | docker exec -i fixmykit-postgres-prod \
  pg_restore -U fixmykit -d fixmykit --clean --if-exists
```

Рекомендуется cron на хосте и выгрузка дампов off-site.

Volumes Docker: `fixmykit-postgres-data-prod`, `fixmykit-uploads-prod`, `fixmykit-logs-prod`.

---

## Мониторинг на prod

Три сценария — [`monitoring/README.md`](../monitoring/README.md). Порты Grafana/Prometheus **не** публикуйте в интернет без VPN или basic auth.

---

## Вебхуки Яндекс Трекера

Базовый URL API: `https://api.<домен>/api/webhooks/yandex-tracker`  
Заголовок: `X-Tracker-Webhook-Secret: <TRACKER_WEBHOOK_SECRET>`

| Путь | Событие |
|------|---------|
| `/api/webhooks/yandex-tracker` | Смена статуса задачи |
| `/api/webhooks/yandex-tracker/publish` | Публикация / снятие |
| `/api/webhooks/yandex-tracker/sysadmin-taken` | Забрал / вернул сисадмин |
| `/api/webhooks/yandex-tracker/comment` | Комментарий → лента на сайте |

Примеры JSON — файлы `yandex-tracker-webhook*.body.example.json` в этом каталоге.

---

## Устранение неполадок

| Симптом | Что проверить |
|---------|----------------|
| CORS / «Нет связи» после login | `CORS_ORIGINS`, cookie `Domain`, HTTPS + `Secure` |
| 401 на `/me` до входа | Нормальное поведение |
| Logout 500 | Обновите backend (фикс `clear_auth_cookie`) |
| 413 при файлах | [`PRODUCTION_UPLOADS.md`](PRODUCTION_UPLOADS.md), nginx `client_max_body_size` |
| SSE обрывается | nginx: `proxy_buffering off`, `proxy_read_timeout` |
| npm ETIMEDOUT при build | Сеть VPS → registry.npmjs.org; повтор `--build` |
| Контейнер backend unhealthy | `docker logs fixmykit-backend-prod`, Postgres/Redis up |
