# Backend scaffold

Каркас backend-слоя на FastAPI без реализации таблиц и миграций.

## Структура

- `app/core` — конфигурация и подключение к БД.
- `app/api` — роуты и зависимости API.
- `app/schemas` — Pydantic-схемы.
- `app/services` — бизнес-слой (пока пусто).
- `app/models` — SQLAlchemy-модели (пока пусто).

## Запуск через Docker Compose

1. Скопируйте `.env.example` в `.env` в корне проекта.
2. Запустите:

```bash
docker compose up --build
```

Используется корневой **`Dockerfile`** (dev) с target-стадиями:

- `backend` — Python/FastAPI
- `frontend` — Node/Vite

Продакшен-сборка: **`Dockerfile.prod`** и `docker-compose.prod.yml` (стадии `backend`, `frontend-prod`).

## Проверка

- `GET /health` — liveness.
- `GET /health/ready` — проверка подключения к PostgreSQL (`SELECT 1`).

## Локальный запуск через uv

Из корня репозитория:

```bash
uv sync
uv run uvicorn main:app --reload
```

Python entrypoint находится в корневом `main.py`, а `pyproject.toml` и `uv.lock` должны храниться в корне проекта.

## Alembic (каркас готов)

В репозитории уже подготовлены:
- `alembic.ini`
- `alembic/env.py`
- `alembic/versions/`

Остаётся только создавать миграции.

Из **корня репозитория** (рядом с `.env`):

```bash
alembic -c backend/alembic.ini revision --autogenerate -m "init"
alembic -c backend/alembic.ini upgrade head
```

Или через `uv`:

```bash
uv run alembic -c backend/alembic.ini upgrade head
```

Из каталога `backend/`:

```bash
alembic revision --autogenerate -m "init"
alembic upgrade head
```

Как это работает:

- `alembic.ini` указывает на `backend/alembic/` (через `%(here)s`), поэтому команды одинаково работают из корня и из `backend`.
- `alembic/env.py` берёт `settings.database_url` из `app/core/config.py`.
- `Settings` читает `.env` из корня проекта (и как fallback — `backend/.env`), поэтому пропадает ошибка `POSTGRES_* Field required` из-за "не той папки запуска".

Структура конфига выполнена в стиле `ServerConfig` + `DbConfig` + общий `Settings` (аналогично старому проекту с разделением server/database блоков).

## Зависимости (текущий базовый набор)

- `fastapi`
- `uvicorn[standard]`
- `sqlalchemy`
- `psycopg[binary]`
- `pydantic-settings`
- `PyJWT`
- `python-multipart`
- `alembic`

## SSE (live-обновления заявок)

`GET /api/events/stream?access_token=<JWT>` — поток Server-Sent Events для admin/sysadmin.

- Событие `repair_request` с JSON: `repair_request_id`, `device_id`, `status`, `source`.
- Опционально `repair_request_id=<uuid>` — только события по одной заявке.
- Публикация: после изменений в API и вебхуках Трекера (in-memory hub, **один процесс** uvicorn).

На проде в nginx для API: `proxy_buffering off;` и увеличенный `proxy_read_timeout` (см. `deploy/nginx-fixmykit.example.conf`).
