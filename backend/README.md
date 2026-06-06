# Backend

FastAPI-приложение Fix My Kit. Точка входа — корневой [`main.py`](../main.py), зависимости — [`pyproject.toml`](../pyproject.toml) (менеджер [uv](https://docs.astral.sh/uv/)).

Полная документация: [README.md](../README.md) (запуск, тесты, env, Tracker, auth).

---

## Структура `app/`

| Каталог | Назначение |
|---------|------------|
| `core/` | `config` (`settings.server` / `settings.database`), БД, security, auth cookies, логи |
| `api/routes/` | REST-роуты (тонкие делегаты в services) |
| `api/deps.py` | JWT из cookie или `Authorization`, роли, SSE-токен |
| `schemas/` | Pydantic-схемы |
| `models/` | SQLAlchemy-модели и enums |
| `repositories/` | CRUD и простые выборки |
| `queries/` | Сложные списки (join, фильтры, suggest, admin stats) |
| `clients/` | HTTP-клиент Yandex Tracker (`TrackerHttpClient`) |
| `services/` | Бизнес-логика, workflow заявок, Tracker, SSE hub |

### Репозитории

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

- HTTP — `clients/tracker_client.py`, протокол — `clients/tracker_protocol.py`
- Домен — `services/tracker_issue_service.py` + `tracker_types.py`
- Фасад — `services/tracker_service.py`
- В тестах: `FakeTrackerClient` через `set_tracker_issue_service()`

### Query-слой

- `queries/device_list_query.py` — список и suggest устройств
- `queries/repair_request_list_query.py` — список и suggest заявок
- `queries/admin_stats_query.py` — агрегаты админ-статистики

---

## Авторизация

- Login: `POST /api/auth/login` → httpOnly cookie (`backend/app/core/auth_cookies.py`)
- Запросы UI: cookie; Swagger: `POST /api/auth/token` + Bearer
- `get_current_user` в `deps.py`: cookie, затем заголовок `Authorization`

---

## Realtime (SSE)

- `services/realtime_hub.py` — подписки клиентов
- `services/sse_ticket_service.py` — одноразовые токены для `EventSource`
- Redis pub/sub при `REDIS_URL` и `REALTIME_BACKEND=redis`

---

## Миграции (Alembic)

```bash
# из корня репозитория
uv run alembic -c backend/alembic.ini upgrade head
uv run alembic -c backend/alembic.ini revision --autogenerate -m "описание"
```

При старте Docker backend автоматически выполняет `upgrade head`.

---

## Тесты

```bash
uv sync --group dev
uv run pytest tests/ --ignore=tests/api    # unit, без PostgreSQL
uv run pytest tests/api -m integration     # API + PostgreSQL
uv run ruff check backend/app main.py tests backend/alembic
```

Описание слоёв — [README.md § Тесты](../README.md#тесты).

---

## Запуск

### Docker Compose (dev)

```bash
cp .env.example .env
docker compose up --build
```

Образы: корневой `Dockerfile` (targets `backend`, `frontend`). Prod: `Dockerfile.prod` + `docker-compose.prod.yml`.

### Локально (uv)

```bash
uv sync
uv run alembic -c backend/alembic.ini upgrade head
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

---

## Health и метрики

| Путь | Назначение |
|------|------------|
| `GET /health` | Liveness |
| `GET /health/ready` | Readiness (PostgreSQL) |
| `GET /metrics` | Prometheus |

Debug (только `API_DOCS_ENABLED=true`):

- `GET /api/debug/test-400` — счётчик `4xx`
- `GET /api/debug/test-500` — счётчик `5xx`
