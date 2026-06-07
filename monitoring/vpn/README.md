# VPN для Telegram-алертов

VPN нужен только **`fmk-alertserver`**. Alertmanager остаётся во внутренней сети Docker.

## Быстрый старт (sing-box + VLESS / Hysteria2)

1. Скопируйте конфиг:

   ```bash
   cp monitoring/vpn/sing-box.example.json monitoring/vpn/sing-box.json
   ```

   Подставьте параметры из подписки (VLESS+REALITY — в example; для Hysteria2 замените outbound на `"type": "hysteria2"`).

2. В `.env.monitoring`:

   ```env
   TELEGRAM_HTTP_PROXY=http://sing-box:1080
   ```

3. Поднимите мониторинг **с профилем** `telegram-vpn`:

   ```bash
   docker compose -p fmk-monitoring \
     -f docker-compose.monitoring.yml \
     -f docker-compose.monitoring.prod-link.yml \
     --env-file .env.monitoring \
     --profile telegram-vpn \
     up -d --build alertserver sing-box
   ```

4. Проверка из alertserver:

   ```bash
   docker exec fmk-alertserver wget -qO- --proxy=on \
     -e use_proxy=yes -e https_proxy=http://sing-box:1080 \
     https://api.telegram.org || true
   ```

   Или тестовый алерт в Grafana / `amtool`.

## Файлы

| Файл | В git |
|------|-------|
| `sing-box.example.json` | да (шаблон) |
| `sing-box.json` | **нет** — секреты, добавьте в `.gitignore` |

## Hysteria2 outbound (пример)

```json
{
  "type": "hysteria2",
  "tag": "proxy",
  "server": "VPN_SERVER_HOST",
  "server_port": 443,
  "password": "YOUR_PASSWORD",
  "tls": {
    "enabled": true,
    "server_name": "SNI_OR_DOMAIN"
  }
}
```

## Без VPN

Не передавайте `--profile telegram-vpn` и оставьте `TELEGRAM_HTTP_PROXY` пустым — alertserver шлёт в Telegram напрямую.
