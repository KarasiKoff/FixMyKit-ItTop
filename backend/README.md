# Backend scaffold

Каркас backend-слоя на FastAPI.

## Структура

- `app/core` — конфигурация (`Settings`) и подключение к БД.
- `app/api` — роуты и зависимости API (тонкие делегаты).
- `app/schemas` — Pydantic-схемы.
- `app/models` — SQLAlchemy-модели.
- `app/repositories` — CRUD и простые выборки по сущностям.
- `app/queries` — сложные списки (join, фильтры, suggest).
- `app/clients` — HTTP-клиенты (Yandex Tracker).
- `app/services` — бизнес-логика.

### Репозитории (`app/repositories/`)

| Модуль | Сущность |
|--------|----------|
| `repair_request_repository` | заявки |
| `device_repository` | устройства |
| `user_repository` | пользователи |
| `repair_request_comment_repository` | комментарии к заявке |
| `audience_repository` | кабинеты |
| `category_repository` / `SubcategoryRepository` | категории |
| `repair_history_repository` | история ремонта |
| `room_map_repository` | позиции на карте кабинета |
| `site_announcement_repository` | баннеры объявлений |

### Tracker

- HTTP — `clients/tracker_client.py`
- Домен — `services/tracker_issue_service.py` + `tracker_types.py`
- Фасад импортов — `services/tracker_service.py`

### Query-слой

- `queries/device_list_query.py` — список и suggest устройств
- `queries/repair_request_list_query.py` — список и suggest заявок
- `queries/admin_stats_query.py` — агрегаты админ-статистики

## Тесты

```bash
uv sync --group dev
uv run pytest
```

Описание слоёв (unit / API / что именно проверяется) — в корневом [README.md](../README.md#тесты), раздел **Тесты**.

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
