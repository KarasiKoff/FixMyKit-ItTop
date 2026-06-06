# Загрузка файлов на проде (nginx 413)

## Симптомы

- В интерфейсе: «Нет связи с сервером»
- В консоли браузера: `413`, `CORS Missing Allow Origin`
- Ответ от `nginx/1.24.0`, не от FastAPI

## Причина

Запрос с файлами (~60 МБ и больше) **отклоняет nginx** до бэкенда (`client_max_body_size` по умолчанию 1 МБ). На ответе 413 nginx не добавляет CORS-заголовки — браузер маскирует это как ошибку сети/CORS.

Приложение: до **10 файлов** (`ATTACHMENT_MAX_PER_REQUEST`). Размер одного файла в Трекер — **~128 МБ** (лимит API Tracker); в `.env` можно задать меньше через `ATTACHMENT_MAX_BYTES`.

Для загрузки в Tracker задайте `TRACKER_ATTACHMENT_TIMEOUT_SECONDS=600` (по умолчанию), иначе большие файлы обрываются по таймауту 15 с.

## Исправление на сервере

В конфиге nginx для **api.*** (прокси на `127.0.0.1:8001`) в блоке `server` для API добавьте:

```nginx
client_max_body_size 12g;
```

В `location /` для API желательно также:

```nginx
proxy_send_timeout 600s;
```

Пример целиком: `deploy/nginx-fixmykit.example.conf`.  
Runbook деплоя и backup: [`deploy/README.md`](README.md).

Проверка и перезагрузка:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## Проверка

Повторите отправку заявки с теми же файлами. В Network должен быть статус **201** или **400** от API (JSON), а не **413** от nginx.
