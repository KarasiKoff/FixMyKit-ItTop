# Fix My Kit

Веб-приложение для учёта IT-оборудования, быстрого доступа к карточкам устройств через QR-коды, оформления заявок на ремонт и синхронизации с **Яндекс Трекером**.

---

## Содержание

- [О проекте](#о-проекте)
- [Возможности](#возможности)
- [Роли пользователей](#роли-пользователей)
- [Технологический стек](#технологический-стек)
- [Структура репозитория](#структура-репозитория)
- [Модель данных](#модель-данных)
- [Запуск для разработки](#запуск-для-разработки)
- [Локальный запуск без Docker](#локальный-запуск-без-docker)
- [Продакшен](#продакшен)
- [Мониторинг](#мониторинг)
- [Конфигурация приложения](#конфигурация-приложения)
- [Переменные окружения](#переменные-окружения)
- [Интеграция с Яндекс Трекером](#интеграция-с-яндекс-трекером)
- [API и документация](#api-и-документация)
- [Маршруты фронтенда](#маршруты-фронтенда)
- [Диаграммы](#диаграммы)
- [Планы развития](#планы-развития)
- [Лицензия](#лицензия)

---

## О проекте

**Fix My Kit** помогает организации вести единый реестр техники, отслеживать ремонтный статус каждого устройства и принимать заявки от сотрудников — в том числе без входа в систему (по QR-коду или инвентарному номеру).

Типичный сценарий:

1. На устройство наклеен QR-код с ссылкой на публичную страницу `/device/{id}/public`.
2. Пользователь сканирует код, видит краткую информацию и может создать заявку на ремонт.
3. Заявка сохраняется в PostgreSQL; при публикации создаётся задача в Яндекс Трекере.
4. Системный администратор ведёт заявку в интерфейсе или в Трекере; изменения статусов синхронизируются через вебхуки и SSE.

---

## Возможности

### Учёт оборудования

- Реестр устройств: инвентарный номер, название, категория, серийный номер, кабинет, ответственный.
- Ремонтный статус устройства: `not_in_repair` / `in_repair`.
- Поиск, фильтрация, сортировка и постраничный вывод.
- CRUD через админку; карточка устройства с историей ремонтов.

### QR-коды

- Генерация QR для одного или нескольких устройств (листы PDF через `jspdf` + `html2canvas`).
- Настройка макета листа (размер, отступы, подписи).
- Сканирование через камеру (`html5-qrcode`) на странице `/scan`.
- QR ведёт на публичную страницу устройства (`PUBLIC_FRONTEND_BASE_URL` + `/device/{id}/public`).

### Заявки на ремонт

- Создание **авторизованным** пользователем (admin/sysadmin) или **гостем** (ФИО + описание + вложения).
- Привязка к устройству по ID, QR или инвентарному номеру.
- Статусы заявки: `open`, `in_progress`, `closed`.
- Операции: смена статуса, «забрал сисадмин», закрытие с комментарием, публикация в Трекер.
- Запрет второй активной заявки на одно устройство.
- История изменений (`repair_history`).

### Вложения

- До 10 файлов на заявку (лимиты в `.env`: `ATTACHMENT_MAX_PER_REQUEST`, `ATTACHMENT_MAX_BYTES`).
- Файлы временно хранятся на диске (`UPLOAD_DIR`), затем загружаются в Трекер.
- Статус синхронизации: `none` / `partial` / `complete`.
- Ручная и фоновая очистка «осиротевших» файлов (раз в сутки + кнопка в админке).

### Яндекс Трекер

- Создание задачи при публикации заявки (`tracker_ticket_id`, `tracker_ticket_key`, `tracker_ticket_url`).
- Загрузка вложений в задачу.
- Входящие вебхуки: синхронизация статуса, публикация/снятие с публикации, отметка «забрал/вернул сисадмин».
- Ручная синхронизация с карточки заявки.

### Карты кабинетов

- Сетка расположения устройств в кабинете (редактор для admin).
- Просмотр карт всех кабинетов (`/room-maps`).
- Отображение статуса ремонта на чипах устройств, иконки категорий, метка двери.

### Администрирование

- Справочники: пользователи, категории (с иконками), кабинеты, устройства.
- Дашборд со статистикой (открытые заявки, устройства в ремонте и т.д.).
- Смена пароля, управление ролями.
- SSE-поток для live-обновления списка заявок без перезагрузки страницы.

### Публичный доступ

- Страница устройства без авторизации: краткая информация и история ремонтов.
- Форма заявки `/repair` доступна гостям и авторизованным пользователям.
- Политика конфиденциальности `/privacy`.

---

## Роли пользователей

| Роль | Описание |
|------|----------|
| **admin** | Полный доступ: справочники категорий и кабинетов, пользователи, карты, статистика, очистка вложений. |
| **sysadmin** | Работа с устройствами, заявками, картами; без управления категориями/кабинетами (только admin). |

При первом запуске создаётся учётная запись из `ADMIN_LOGIN` / `ADMIN_PASSWORD` (см. `.env.example`).

---

## Технологический стек

| Слой | Технологии |
|------|------------|
| **Frontend** | React 18, TypeScript, Vite, React Router |
| **QR** | html5-qrcode, qr-code-styling, qrcode, jspdf, html2canvas |
| **Backend** | Python 3.14, FastAPI, SQLAlchemy, Pydantic |
| **БД** | PostgreSQL 18 |
| **Миграции** | Alembic |
| **Авторизация** | JWT (Bearer), bcrypt |
| **Интеграции** | Яндекс Tracker API v3, вебхуки |
| **Realtime** | Server-Sent Events (in-memory hub) |
| **Инфраструктура** | Docker Compose, uv, nginx (prod) |

---

## Структура репозитория

```
fix-my-kit/
├── main.py                 # Точка входа FastAPI
├── pyproject.toml          # Зависимости Python (uv)
├── docker-compose.yml      # Dev: Postgres + backend + Vite
├── docker-compose.prod.yml # Prod: Postgres + API + nginx-фронт
├── docker-compose.monitoring.yml # Prometheus, Grafana, Loki, алерты
├── .env.monitoring.example # Указатель на шаблоны мониторинга по сценарию
├── docker-compose.monitoring.local.yml      # overlay: локалка
├── docker-compose.monitoring.prod-bundle.yml # overlay: prod+мониторинг
├── docker-compose.monitoring.prod-link.yml   # overlay: prod отдельно
├── Dockerfile              # Dev-образы
├── Dockerfile.prod         # Prod-образы
├── .env.example            # Шаблон переменных (разработка)
├── .env.production.example # Шаблон для продакшена
├── backend/
│   ├── alembic/            # Миграции БД
│   └── app/
│       ├── api/routes/     # Тонкие REST-роуты (repair_requests/ — пакет по зонам)
│       ├── core/           # config (settings.server / settings.database), database, security
│       ├── models/         # SQLAlchemy-модели
│       ├── repositories/   # Доступ к БД
│       ├── schemas/        # Pydantic-схемы
│       └── services/       # Бизнес-логика, Tracker, *\_route_service для CRUD
├── frontend/
│   └── src/
│       ├── api/            # HTTP-клиент к API
│       ├── components/     # UI-компоненты
│       ├── pages/          # Страницы и админка
│       ├── hooks/          # React-хуки
│       └── styles/         # CSS-модули по разделам
├── deploy/                 # nginx, примеры вебхуков, заметки по продакшену
└── data/uploads/           # Вложения заявок (dev, монтируется в Docker)
```

---

## Модель данных

Основные сущности:

| Таблица | Назначение |
|---------|------------|
| `users` | Пользователи (admin / sysadmin), JWT-авторизация |
| `devices` | Оборудование, ремонтный статус, связи с категорией, кабинетом, ответственным |
| `categories` | Типы оборудования, опциональная иконка (binary) |
| `audience` | Кабинеты, параметры сетки карты (`map_grid_cols/rows`, `map_door_edge`) |
| `room_device_positions` | Координаты устройств на карте кабинета |
| `repair_requests` | Заявки, статус, Трекер, вложения, публикация |
| `repair_history` | Журнал изменений статусов и событий |

---

## Запуск для разработки

### Требования

- [Docker](https://docs.docker.com/get-docker/) и Docker Compose **или**
- Python ≥ 3.14, [uv](https://docs.astral.sh/uv/), Node.js ≥ 20, PostgreSQL 18

### Быстрый старт (Docker)

1. Скопируйте шаблон окружения:

   ```bash
   cp .env.example .env
   ```

2. Задайте надёжные значения как минимум для:

   - `POSTGRES_PASSWORD`
   - `JWT_SECRET_KEY` (можно сгенерировать: `python -c "import secrets; print(secrets.token_urlsafe(32))"`)
   - `ADMIN_LOGIN` / `ADMIN_PASSWORD`

3. Запустите стек:

   ```bash
   docker compose up --build
   ```

4. Откройте в браузере:

   | Сервис | URL |
   |--------|-----|
   | Фронтенд (Vite) | http://localhost:5173 |
   | API | http://localhost:8000 |
   | Swagger (если `API_DOCS_ENABLED=true`) | http://localhost:8000/docs |
   | Health (liveness) | http://localhost:8000/health |
   | Health (readiness) | http://localhost:8000/health/ready |

При старте контейнера backend автоматически выполняет `alembic upgrade head` и создаёт admin-пользователя из `.env`.

Vite проксирует `/api` на backend (`VITE_PROXY_TARGET` в `docker-compose.yml`).

---

## Локальный запуск без Docker

### 1. PostgreSQL

Поднимите БД и создайте базу `fixmykit` (или как в `.env`). В `.env` укажите `POSTGRES_HOST=localhost`.

### 2. Backend

Из **корня репозитория**:

```bash
uv sync
uv run alembic -c backend/alembic.ini upgrade head
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Фронт: http://localhost:5173 (прокси `/api` → `http://localhost:8000`).

### Тесты

Автотесты разбиты на четыре слоя: быстрые unit-тесты backend без БД, интеграционные API-тесты с PostgreSQL, unit-тесты фронта (Vitest) и опциональные E2E (Playwright) против уже запущенного стека.

#### Backend — unit (`tests/test_*.py`)

Запускаются без PostgreSQL. Проверяют бизнес-логику и сериализацию в изоляции от HTTP и Tracker.

| Файл | Что проверяет |
|------|----------------|
| `test_tracker_issue_service.py` | Сопоставление меток Tracker (`_labels_match`): регистр, **«Требуется информация» ≠ «В работе»** (регрессия ложного совпадения при push в Tracker). |
| `test_repair_request_transitions.py` | Матрица переходов статусов: с сайта (API) `needs_info` → `in_progress`, закрытую заявку API не открывает; из вебхука Tracker закрытую можно открыть, `in_progress` → `open`. |
| `test_repair_request_presenters.py` | Ответы API: поле `audience_name` из связи с кабинетом, `device_name` из устройства, отсутствие имени без связи. |
| `test_repair_request_webhook_mapping.py` | Маппинг `tracker_status` → `RequestStatus` по `TRACKER_STATUS_ALIASES`, пустые и неизвестные строки. |
| `test_comment_body_normalize.py` | Очистка HTML/сущностей в тексте комментариев из Tracker, legacy-префикс `**Автор**:`. |
| `test_repair_request_workflow_service.py` | Валидация `apply_workflow_change`: комментарий для `needs_info`, резолюция для `closed`. |
| `test_repair_request_tracker_outbound.py` | `require_tracker_ticket` (409), `sync_tracker_label_with_pending`: сброс/установка `tracker_status_sync_pending`, 502 при недоступном Tracker. |

#### Backend — API (`tests/api/`, маркер `integration`)

`TestClient` + реальная PostgreSQL (по умолчанию БД `fixmykit_test`). Схема поднимается через `Base.metadata.create_all`. Исходящие вызовы в Tracker по умолчанию **замоканы** (workflow labels, комментарии). Тесты с маркером `tracker_http` используют `FakeTrackerClient` и реальный путь создания задачи (`POST .../tracker/sync`, create с `sync_to_tracker`).

| Файл | Эндпоинты | Что проверяет |
|------|-----------|----------------|
| `test_repair_request_create.py` | `POST /api/repair-requests`, `GET .../{id}`, `POST /api/public/repair-requests` | Создание по `audience_id` / `device_id`; публичное создание + FakeTracker (`tracker_http`). |
| `test_repair_request_workflow.py` | `PATCH .../workflow` | `needs_info` (комментарий), `needs_info` → `in_progress`, закрытие (`resolution`, `closed`, метка «Закрыт»). |
| `test_webhooks.py` | `POST /api/webhooks/yandex-tracker*` | Статус, закрытие, publish, comment (created / skipped_echo), sysadmin-taken; secret 401; noop; неизвестный статус 400. |
| `test_repair_request_tracker.py` | `POST .../tracker/push-status`, `POST .../tracker/sync` | Push только при pending; sync через FakeTracker (`tracker_http`); create staff с sync в фоне; 502 при failing fake. |
| `test_auth_permissions.py` | `GET /api/repair-requests`, `POST /api/audiences` | 401 без токена; 403 для sysadmin на создание кабинета (только admin). |

#### Frontend — Vitest (`frontend/src/**/*.test.ts(x)`)

Проверяют утилиты и UI-компоненты без браузера (jsdom).

| Файл | Что проверяет |
|------|----------------|
| `utils/repairWorkflow.test.ts` | Вкладка workflow на карточке заявки берётся из `status` API, а не из `trackerStatusLabel` (чтобы «Требуется информация» в Tracker не показывалась как «В работе»). |
| `utils/formatApiError.test.ts` | Распознавание ошибки Tracker (`502` / `tracker_unavailable`), текст тоста при `tracker_status_sync_pending`. |
| `components/RepairTrackerSyncBanner.test.tsx` | Баннер при pending; клик «Синхронизировать» → `pushRepairRequestStatusToTracker`, `onUpdated`, success-тост. |
| `components/RepairRequestStatusPanel.test.tsx` | После workflow: тост pending при `trackerStatusSyncPending`; при 502 + pending — тот же тост; иначе `formatApiError`. |

#### E2E — Playwright (`e2e/tests/`)

Требуют **уже запущенные** backend и (для UI) frontend. Без сервера тесты пропускаются (`test.skip`).

| Спека | Условие | Что проверяет |
|-------|---------|----------------|
| `health.api.spec.ts` | API на `PLAYWRIGHT_API_BASE_URL` | `GET /health`, `GET /health/ready` (readiness пропускается, если БД недоступна). |
| `repair-workflow.api.spec.ts` | `PLAYWRIGHT_E2E_FULL=1` | Полный сценарий через HTTP: логин, список кабинетов, create, workflow `needs_info` → `in_progress`. |
| `login.ui.spec.ts` | `PLAYWRIGHT_E2E_UI=1` | Страница `/login`: заголовок «Вход в систему». |

В **CI** четыре параллельных job (на PR/push в `main`/`master`):

| Job | Что делает |
|-----|------------|
| `frontend` | lint, format, build, Vitest |
| `backend-unit` | `compileall`, `pytest` без `tests/api` (без PostgreSQL) |
| `backend-integration` | `pytest tests/api` + service PostgreSQL |
| `e2e-api-smoke` | после integration: `uvicorn` + Playwright `--project=api` |

`backend-unit` и `backend-integration` стартуют одновременно; E2E — только если API-тесты прошли.

#### Запуск локально

```bash
# Backend: unit (без PostgreSQL)
uv sync --group dev
uv run pytest tests/ --ignore=tests/api

# Backend: API (нужен PostgreSQL; создайте БД fixmykit_test при необходимости)
docker compose up -d postgres
uv run pytest tests/api -m integration

# Все backend-тесты сразу
uv run pytest

# Frontend (Vitest)
cd frontend
npm run test

# E2E: smoke health (запущенный API на :8000)
cd e2e && npm ci && npx playwright install chromium
PLAYWRIGHT_API_BASE_URL=http://127.0.0.1:8000 npm test -- --project=api

# E2E: полный workflow API
PLAYWRIGHT_E2E_FULL=1 PLAYWRIGHT_API_BASE_URL=http://127.0.0.1:8000 npm test -- repair-workflow.api.spec.ts

# E2E: UI (запущенный фронт на :5173)
PLAYWRIGHT_E2E_UI=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 npm test -- --project=ui
```

Переменные для API-тестов (значения по умолчанию в `tests/conftest.py`): `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB` (`fixmykit_test`), `POSTGRES_USER`, `POSTGRES_PASSWORD`, `JWT_SECRET_KEY`, `TRACKER_WEBHOOK_SECRET`.

### Проверка API

- `GET /health` — liveness (`{"status":"ok"}`)
- `GET /health/ready` — readiness: `SELECT 1` к PostgreSQL (503, если БД недоступна)

### Kubernetes (probes)

Для backend-контейнера (порт API, обычно `8000`):

| Probe | HTTP | Успех |
|-------|------|--------|
| **Liveness** | `GET /health` | 200 |
| **Readiness** | `GET /health/ready` | 200 при доступной БД |

Пример фрагмента манифеста:

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8000
  initialDelaySeconds: 10
  periodSeconds: 10
readinessProbe:
  httpGet:
    path: /health/ready
    port: 8000
  initialDelaySeconds: 5
  periodSeconds: 5
```

Пути **без** префикса `/api` — readiness зарегистрирован на корневом роутере приложения.

---

## Продакшен

### Подготовка

1. Скопируйте `.env.production.example` → `.env.production` и заполните секреты.
2. Обязательно задайте:
   - `POSTGRES_PASSWORD`
   - `JWT_SECRET_KEY`, `ADMIN_LOGIN`, `ADMIN_PASSWORD`
   - `CORS_ORIGINS` — публичный URL фронта
   - `PUBLIC_FRONTEND_BASE_URL` — для QR-ссылок
   - `VITE_API_BASE_URL` — полный URL API (подставляется при сборке фронта)
   - `TRACKER_*` — токен, org id, очередь

### Запуск

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

| Сервис | Порт на хосте |
|--------|----------------|
| API (uvicorn) | `127.0.0.1:8001` |
| Фронт (nginx, статика) | `127.0.0.1:8080` |
| PostgreSQL | только внутри Docker-сети |

### Nginx на хосте

Настройте reverse proxy по примеру [`deploy/nginx-fixmykit.example.conf`](deploy/nginx-fixmykit.example.conf):

- фронт → `127.0.0.1:8080`
- API → `127.0.0.1:8001`
- для API: `client_max_body_size` (большие вложения), `proxy_buffering off` (SSE)

Подробнее про ошибку **413** при загрузке файлов: [`deploy/PRODUCTION_UPLOADS.md`](deploy/PRODUCTION_UPLOADS.md).

### CORS

Если `CORS_ORIGINS` не пустой, FastAPI подключает `CORSMiddleware` с перечисленными origin (без cookies; заголовок `Authorization` разрешён).

### Вложения на проде

Каталог `UPLOAD_DIR` монтируется в volume `uploads_data_prod`, чтобы файлы переживали перезапуск контейнера.

### Мониторинг

Три режима (команды и env-шаблоны): [`monitoring/README.md`](monitoring/README.md).

| Режим | Шаблон env | Суть |
|-------|------------|------|
| Локалка | `.env.monitoring.local.example` | Dev compose + мониторинг (`-p fmk-monitoring` + `monitoring.local.yml`) |
| Prod вместе | `.env.monitoring.prod.example` | `prod.yml` + `monitoring.yml` + `prod-bundle.yml` |
| Prod отдельно | `.env.monitoring.prod-standalone.example` | Сначала prod, потом мониторинг + `prod-link.yml` |

API отдаёт `GET /metrics`. Grafana: **Backend** (Prometheus) и **Операции** (PostgreSQL — заявки, категории, ремонт по аудиториям). Конфиги — в [`monitoring/`](monitoring/).

---

## Конфигурация приложения

Настройки читаются из `.env` в корне репозитория и `backend/.env` (см. `backend/app/core/config.py`). В коде используется единая точка входа:

```python
from backend.app.core.config import settings

settings.server.jwt_secret_key      # API, JWT, Tracker, вложения, CORS, логи
settings.database.database_url      # PostgreSQL (SQLAlchemy + Alembic)
```

| Блок | Класс | Назначение |
|------|--------|------------|
| `settings.server` | `ServerConfig` | HTTP API, JWT, bootstrap admin, Yandex Tracker, `UPLOAD_DIR`, лимиты вложений, `PUBLIC_FRONTEND_BASE_URL`, CORS, ротация логов |
| `settings.database` | `DbConfig` | `POSTGRES_*` → свойство `database_url` |

Прямых полей на корневом `settings` (типа `settings.jwt_secret_key`) **нет** — только `server` и `database`. Это упрощает группировку env и тестов.

**Примеры в коде:**

- `main.py`, `security.py` — `settings.server`
- `database.py`, `alembic/env.py` — `settings.database.database_url`
- `tests/api/conftest.py` — та же схема для integration-тестов

Полный перечень переменных — в таблице ниже и в [`.env.example`](.env.example).

**Yandex Tracker (DI для тестов):** HTTP-контракт `TrackerHttpClient` (`backend/app/clients/tracker_protocol.py`), реализация `TrackerClient`, подмена `FakeTrackerClient` в pytest через `set_tracker_issue_service(TrackerIssueService(fake))` / `reset_tracker_issue_service()`.

---

## Переменные окружения

| Переменная | Описание |
|------------|----------|
| `APP_NAME` | Название API в OpenAPI |
| `API_DOCS_ENABLED` | Swagger/ReDoc (`true` в dev, `false` в prod) |
| `LOG_LEVEL` | Уровень логов (`INFO`, `WARNING`, `ERROR`…) |
| `LOG_DIR` | Каталог файлов `fixmykit.log` / `fixmykit-error.log` |
| `LOG_JSON` | JSON-строки в логах (`true` рекомендуется) |
| `JWT_SECRET_KEY` | Секрет подписи JWT |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Время жизни токена |
| `ADMIN_LOGIN` / `ADMIN_PASSWORD` | Bootstrap admin при старте |
| `POSTGRES_*` | Подключение к БД |
| `PUBLIC_FRONTEND_BASE_URL` | Базовый URL для QR (`/device/{id}/public`) |
| `CORS_ORIGINS` | Разрешённые origin через запятую (prod) |
| `VITE_API_BASE_URL` | URL API при prod-сборке фронта |
| `TRACKER_BASE_URL` | API Трекера (по умолчанию v3) |
| `TRACKER_TOKEN` | OAuth-токен |
| `TRACKER_ORG_ID` | ID организации |
| `TRACKER_QUEUE` | Ключ очереди задач |
| `TRACKER_WEBHOOK_SECRET` | Секрет заголовка `X-Tracker-Webhook-Secret` |
| `TRACKER_WEBHOOK_ACTOR_LOGIN` | Технический пользователь для вебхуков |
| `UPLOAD_DIR` | Каталог временных вложений |
| `ATTACHMENT_MAX_BYTES` | Макс. размер одного файла |
| `ATTACHMENT_MAX_PER_REQUEST` | Макс. число файлов на заявку |
| `ATTACHMENT_ORPHAN_MAX_AGE_DAYS` | Возраст «сирот» для автоочистки |
| `TRACKER_ATTACHMENT_TIMEOUT_SECONDS` | Таймаут загрузки в Трекер (большие файлы) |

Полный список — в [`.env.example`](.env.example), [`.env.production.example`](.env.production.example), [`.env.monitoring.example`](.env.monitoring.example) и шаблонах `.env.monitoring.*.example` по сценарию.

---

## Интеграция с Яндекс Трекером

### Исходящие запросы (приложение → Трекер)

- Создание задачи при **публикации** заявки.
- Загрузка вложений в задачу.
- Комментарии при смене статуса, «забрал/вернул», публикации.

### Входящие вебхуки (Трекер → приложение)

Базовый URL: `POST /api/webhooks/yandex-tracker`  
Заголовок: `X-Tracker-Webhook-Secret: <TRACKER_WEBHOOK_SECRET>`

| Эндпоинт | Назначение |
|----------|------------|
| `POST /api/webhooks/yandex-tracker` | Синхронизация статуса задачи с заявкой |
| `POST /api/webhooks/yandex-tracker/publish` | Публикация / снятие с публикации |
| `POST /api/webhooks/yandex-tracker/sysadmin-taken` | Отметка «сисадмин забрал / вернул» |
| `POST /api/webhooks/yandex-tracker/comment` | Комментарий из Трекера → лента на сайте |

Пример тела для комментария: [`deploy/yandex-tracker-webhook-comment.body.example.json`](deploy/yandex-tracker-webhook-comment.body.example.json). В очереди FIXMYKIT нужен триггер: условие «добавлен комментарий» (тип `userComment`), действие HTTP POST на `/api/webhooks/yandex-tracker/comment`.

Пример тела для publish/unpublish: [`deploy/yandex-tracker-webhook-publish-unpublish.body.example.json`](deploy/yandex-tracker-webhook-publish-unpublish.body.example.json).

### Логирование и трассировка

- **Консоль** (stdout Docker): все события от `LOG_LEVEL`.
- **Файлы** в `LOG_DIR`: `fixmykit.log` (INFO и выше), `fixmykit-error.log` (только ERROR/CRITICAL), ротация по `LOG_MAX_BYTES` / `LOG_BACKUP_COUNT`.
- Формат: JSON-строки с полями `ts`, `level`, `logger`, `message`, `request_id` и контекстом события.
- В каждый HTTP-запрос добавляется `X-Request-ID` (сквозная трассировка).
- Логируются: HTTP, PostgreSQL (ошибки пула), вход/валидация JWT, логин, вызовы Yandex Tracker API.

**Просмотр в UI:** Админка → **Логи** (`/admin/logs`, только роль `admin`), API `GET /api/admin/logs`.

**Docker на проде:**

```bash
docker logs -f fixmykit-backend-prod
docker logs --tail 200 fixmykit-backend-prod 2>&1 | grep tracker_webhook
# файлы на volume fixmykit-logs-prod (в контейнере /data/logs)
```

### Live-обновления (SSE)

```
GET /api/events/stream?access_token=<JWT>
```

Опционально: `repair_request_id=<uuid>` — только события по одной заявке.  
Доступ: **admin** и **sysadmin**. EventSource не передаёт `Authorization`, поэтому токен передаётся в query.

> SSE работает в рамках **одного процесса** uvicorn (in-memory hub). Для нескольких воркеров потребуется внешний брокер (Redis и т.п.).

---

## API и документация

Префикс REST API: `/api`.

| Группа | Префикс / путь | Описание |
|--------|----------------|----------|
| Auth | `/api/auth` | login, `/me`, смена пароля |
| Devices | `/api/devices` | CRUD, список, история, QR-данные |
| Categories | `/api/categories` | Справочник + иконки |
| Audiences | `/api/audiences` | Кабинеты |
| Room map | `/api/audiences/{id}/map` | Карта кабинета |
| Repair requests | `/api/repair-requests` | Заявки, вложения, Tracker sync |
| Public | `/api/public` | Устройства и лимиты для гостей |
| Users | `/api/users` | Управление пользователями |
| Admin stats | `/api/admin/stats` | Статистика дашборда |
| Admin logs | `/api/admin/logs` | Хвост файлов логов (только admin) |
| Events | `/api/events/stream` | SSE |
| Webhooks | `/api/webhooks` | Входящие вызовы Трекера |

При `API_DOCS_ENABLED=true`: Swagger `/docs`, ReDoc `/redoc`.

---

## Маршруты фронтенда

| Путь | Доступ | Описание |
|------|--------|----------|
| `/repair` | Все | Создание заявки (гость / авторизованный) |
| `/login` | Гости | Вход |
| `/scan` | Auth | Сканер QR |
| `/devices`, `/devices/:id` | Auth | Список и карточка устройства |
| `/room-maps` | Auth | Карты кабинетов |
| `/requests`, `/requests/:id` | Auth | Список и детали заявок |
| `/admin/*` | Auth | Админ-панель, редактор карт |
| `/device/:id/public` | Все | Публичная карточка (QR) |
| `/privacy` | Все | Политика конфиденциальности |

---

## Диаграммы

### Схема БД

<img width="613" height="1119" alt="Схема базы данных" src="https://github.com/user-attachments/assets/91928e2b-615f-4fa7-8f18-7aa99d6de1e9" />

### Use Case

<img width="858" height="1290" alt="Диаграмма Use Case" src="https://github.com/user-attachments/assets/45750f56-bdf1-4ddd-a293-f80265ae0e04" />

---

## Планы развития

- Антиспам и rate limiting для публичных форм
- Email / мессенджер-уведомления
- Импорт оборудования из Excel
- Расширенная аналитика и отчёты
- SLA и дополнительные статусы ремонта
- Redis для SSE при горизонтальном масштабировании

---

## Лицензия

[MIT](LICENSE) © KarasiKoff
