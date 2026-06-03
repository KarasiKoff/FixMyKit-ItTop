/** Справочник имён логгеров и типовых message с бэкенда (см. logging.getLogger). */

export type LogLoggerRef = {
    id: string;
    title: string;
    description: string;
    typicalMessages?: string[];
};

export type LogMessageRef = {
    /** Точное совпадение или префикс message в JSON-логе */
    match: string;
    description: string;
    loggerHint?: string;
};

export const LOG_LOGGER_GROUPS: { title: string; items: LogLoggerRef[] }[] = [
    {
        title: 'HTTP и приложение',
        items: [
            {
                id: 'fixmykit.http',
                title: 'HTTP-запросы',
                description:
                    'Каждый запрос к API: метод, путь, код ответа, время (duration_ms), IP клиента. Поле request_id связывает цепочку событий одного запроса.',
                typicalMessages: ['http_request', 'http_request_failed'],
            },
            {
                id: 'main',
                title: 'Старт приложения',
                description: 'Жизненный цикл FastAPI: очистка вложений при старте и по расписанию, необработанные исключения.',
                typicalMessages: [
                    'attachment_cleanup',
                    'attachment_cleanup_failed',
                    'unhandled_exception',
                    'http_exception',
                ],
            },
            {
                id: 'backend.app.core.logging_config',
                title: 'Инициализация логов',
                description: 'Один раз при запуске: каталог LOG_DIR, уровень LOG_LEVEL, формат JSON.',
                typicalMessages: ['logging_initialized'],
            },
        ],
    },
    {
        title: 'Авторизация',
        items: [
            {
                id: 'fixmykit.auth',
                title: 'Вход и JWT',
                description:
                    'Логин/пароль, проверка Bearer-токена и токена в query (SSE). Пароли в лог не пишутся.',
                typicalMessages: [
                    'auth_login_success',
                    'auth_login_failed',
                    'auth_token_invalid',
                    'auth_token_missing_sub',
                    'auth_token_invalid_sub',
                    'auth_user_not_found_or_inactive',
                    'auth_token_ok',
                ],
            },
        ],
    },
    {
        title: 'PostgreSQL',
        items: [
            {
                id: 'fixmykit.db',
                title: 'База данных',
                description:
                    'Пул соединений SQLAlchemy: checkout/checkin (DEBUG), ошибки запросов и сбои драйвера.',
                typicalMessages: ['db_connect', 'db_pool_checkout', 'db_pool_checkin', 'db_error', 'db_unexpected_error'],
            },
        ],
    },
    {
        title: 'Yandex Tracker (исходящие)',
        items: [
            {
                id: 'fixmykit.tracker',
                title: 'API Трекера',
                description:
                    'HTTP-вызовы к api.tracker.yandex.net: создание/чтение задач, статусы, вложения, комментарии. URL без секретов.',
                typicalMessages: [
                    'tracker_api_ok',
                    'tracker_api_http_error',
                    'tracker_api_network_error',
                    'tracker_api_invalid_json',
                    'tracker_api_bytes_ok',
                    'tracker_api_bytes_http_error',
                    'tracker_api_bytes_network_error',
                ],
            },
            {
                id: 'backend.app.services.repair_request_tracker_outbound',
                title: 'Синхронизация с сайта → Трекер',
                description: 'Смена статуса/комментарии с карточки заявки, когда Трекер недоступен.',
                typicalMessages: ['tracker_outbound_failed'],
            },
            {
                id: 'backend.app.services.repair_request_attachment_service',
                title: 'Вложения → Трекер',
                description: 'Загрузка файлов заявки в задачу Трекера после публикации или ручной синхронизации.',
                typicalMessages: ['tracker_attachment_upload_failed'],
            },
        ],
    },
    {
        title: 'Yandex Tracker (входящие вебхуки)',
        items: [
            {
                id: 'backend.app.api.routes.webhooks',
                title: 'Вебхуки Трекера',
                description:
                    'POST /api/webhooks/yandex-tracker*: смена статуса, публикация, комментарии, «сисадмин забрал». Сверяйте с настройкой триггеров в очереди FIXMYKIT.',
                typicalMessages: [
                    'tracker_webhook_status',
                    'tracker_webhook_unmapped_status',
                    'tracker_webhook_noop',
                    'tracker_webhook_label_updated',
                    'tracker_*_comment_failed',
                ],
            },
        ],
    },
    {
        title: 'Прочее',
        items: [
            {
                id: 'backend.app.services.url_shortener',
                title: 'Сокращение ссылок (clck.ru)',
                description: 'POST /api/public/shorten-url для QR и страницы /scan.',
                typicalMessages: ['clck shorten failed', 'clck shorten request failed'],
            },
            {
                id: 'backend.app.services.realtime_hub',
                title: 'SSE (live-обновления)',
                description: 'Поток /api/events/stream: переполнение очереди подписчика, недоступный event loop.',
                typicalMessages: ['sse subscriber queue full', 'sse publish skipped'],
            },
        ],
    },
];

/** Типовые значения поля message (событие внутри логгера). */
export const LOG_MESSAGE_HINTS: LogMessageRef[] = [
    { match: 'http_request', description: 'Запрос обработан (смотрите status, path, duration_ms).' },
    { match: 'http_request_failed', description: 'Исключение до формирования ответа (500).' },
    { match: 'auth_login_success', description: 'Успешный вход (login, role в extra).' },
    { match: 'auth_login_failed', description: 'Неверный логин или пароль.' },
    { match: 'auth_token_invalid', description: 'JWT не подписан, просрочен или повреждён.' },
    { match: 'auth_user_not_found_or_inactive', description: 'Пользователь удалён/отключён, токен ещё в браузере.' },
    { match: 'tracker_webhook_status', description: 'Вебхук статуса: что пришло из Трекера (raw_status, db_status).' },
    { match: 'tracker_webhook_unmapped_status', description: 'Статус из Трекера не в TRACKER_STATUS_ALIASES — правьте макрос или алиасы.' },
    { match: 'tracker_webhook_noop', description: 'Статус уже такой же — изменений в БД не было.' },
    { match: 'tracker_webhook_label_updated', description: 'Обновлена только подпись tracker_status_label при том же enum-статусе.' },
    { match: 'tracker_api_http_error', description: 'Трекер ответил 4xx/5xx (status, body_preview в extra).' },
    { match: 'tracker_api_network_error', description: 'Нет сети до api.tracker.yandex.net или таймаут.' },
    { match: 'tracker_outbound_failed', description: 'С сайта не удалось отправить статус/комментарий в Трекер.' },
    { match: 'db_error', description: 'Ошибка SQL (фрагмент statement в extra).' },
    { match: 'unhandled_exception', description: 'Не пойманное исключение — смотрите exception в записи.' },
    { match: 'logging_initialized', description: 'Логирование включено, путь к файлам логов.' },
];

const ALL_LOGGERS = LOG_LOGGER_GROUPS.flatMap((g) => g.items);

export function findLoggerRef(logger: string | null | undefined): LogLoggerRef | undefined {
    if (!logger?.trim()) {
        return undefined;
    }
    const exact = ALL_LOGGERS.find((r) => r.id === logger);
    if (exact) {
        return exact;
    }
    return ALL_LOGGERS.find((r) => logger.startsWith(r.id) || logger.includes(r.id));
}

export function findMessageHint(
    message: string | null | undefined,
    logger?: string | null,
): LogMessageRef | undefined {
    if (!message?.trim()) {
        return undefined;
    }
    const msg = message.trim();
    for (const hint of LOG_MESSAGE_HINTS) {
        if (msg === hint.match || msg.startsWith(hint.match.replace('*', ''))) {
            if (hint.loggerHint && logger && !logger.includes(hint.loggerHint)) {
                continue;
            }
            return hint;
        }
    }
    if (msg.includes('tracker_webhook')) {
        return {
            match: msg,
            description: 'Событие вебхука Трекера — см. backend.app.api.routes.webhooks.',
        };
    }
    if (msg.startsWith('tracker_api')) {
        return { match: msg, description: 'Вызов REST API Yandex Tracker.' };
    }
    if (msg.startsWith('auth_')) {
        return { match: msg, description: 'Событие авторизации — см. fixmykit.auth.' };
    }
    return undefined;
}
