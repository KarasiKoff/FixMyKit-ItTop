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
├── Dockerfile              # Dev-образы
├── Dockerfile.prod         # Prod-образы
├── .env.example            # Шаблон переменных (разработка)
├── .env.production.example # Шаблон для продакшена
├── backend/
│   ├── alembic/            # Миграции БД
│   └── app/
│       ├── api/routes/     # REST-эндпоинты
│       ├── core/           # config, database, security
│       ├── models/         # SQLAlchemy-модели
│       ├── schemas/        # Pydantic-схемы
│       └── services/       # Бизнес-логика, Tracker, вложения
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
   | Health | http://localhost:8000/health |

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

### Проверка API

- `GET /health` — liveness
- `GET /api/health/ready` — проверка подключения к PostgreSQL

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

---

## Переменные окружения

| Переменная | Описание |
|------------|----------|
| `APP_NAME` | Название API в OpenAPI |
| `API_DOCS_ENABLED` | Swagger/ReDoc (`true` в dev, `false` в prod) |
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

Полный список — в [`.env.example`](.env.example) и [`.env.production.example`](.env.production.example).

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

**Логи backend на проде** (имя контейнера из `docker-compose.prod.yml`):

```bash
docker logs -f fixmykit-backend-prod
docker logs --tail 200 fixmykit-backend-prod
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
