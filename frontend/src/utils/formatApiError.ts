import { ApiError } from '../api/client';

/** Коды и строки detail с бэкенда (FastAPI) и частые англ. формулировки */
const DETAIL_RU: Record<string, string> = {
    invalid_token: 'Сессия недействительна. Войдите снова',
    forbidden: 'Недостаточно прав для этого действия',
    'Incorrect login or password': 'Неверный логин или пароль',
    'Invalid login payload': 'Неверные данные для входа',
    invalid_current_password: 'Неверный текущий пароль',
    device_not_found: 'Устройство не найдено',
    repair_request_not_found: 'Заявка не найдена',
    user_not_found: 'Пользователь не найден',
    login_exists: 'Пользователь с таким логином уже есть',
    cannot_deactivate_self: 'Нельзя отключить свою учётную запись',
    cannot_change_own_role: 'Нельзя изменить свою роль',
    inventory_number_exists: 'Устройство с таким инвентарным номером уже есть',
    active_request_exists: 'По этому устройству уже есть активная заявка',
    invalid_status_transition: 'Такое изменение статуса недопустимо',
    tracker_unavailable: 'Трекер временно недоступен. Попробуйте позже',
    tracker_ticket_required: 'Сначала синхронизируйте заявку с Трекером',
    comment_required_for_needs_info: 'Добавьте комментарий для статуса «Требуется информация»',
    resolution_required_for_close: 'Выберите резолюцию при закрытии',
    attachment_limit_reached: 'Превышен лимит числа файлов на заявку',
    attachment_too_large: 'Файл слишком большой (лимит приложения или Трекера ~128 МБ)',
    attachment_type_not_allowed: 'Допустимы только фото и видео',
    files_required: 'Выберите хотя бы один файл',
    category_exists: 'Такая категория уже существует',
    category_not_found: 'Категория не найдена',
    audience_exists: 'Такая аудитория уже существует',
    audience_not_found: 'Аудитория не найдена',
};

const VALIDATION_MSG_RU: Record<string, string> = {
    'Field required': 'Заполните обязательное поле',
    'value is not a valid uuid': 'Укажите корректный идентификатор',
    'String should have at least 8 characters': 'Минимум 8 символов',
    'String too short': 'Минимум 8 символов',
    'ensure this value has at least 8 characters': 'Минимум 8 символов',
};

function translateHeuristic(s: string): string | null {
    const t = s.trim();
    if (!t) {
        return null;
    }
    if (DETAIL_RU[t]) {
        return DETAIL_RU[t];
    }
    const low = t.toLowerCase();
    if (low.includes('network') || low === 'failed to fetch') {
        return 'Нет связи с сервером. Проверьте подключение';
    }
    return null;
}

function formatValidationIssues(detail: unknown): string {
    if (!Array.isArray(detail)) {
        return 'Проверьте корректность введённых данных';
    }
    const parts: string[] = [];
    for (const item of detail) {
        if (item && typeof item === 'object') {
            const row = item as { msg?: unknown; type?: unknown };
            if (typeof row.msg === 'string') {
                parts.push(VALIDATION_MSG_RU[row.msg] ?? translateHeuristic(row.msg) ?? row.msg);
            } else if (row.type === 'string_too_short') {
                parts.push('Минимум 8 символов');
            }
        }
    }
    if (parts.length > 0) {
        return [...new Set(parts)].join(' ');
    }
    return 'Проверьте корректность введённых данных';
}

function formatDetail(detail: unknown, status: number): string {
    if (typeof detail === 'string') {
        return translateHeuristic(detail) ?? DETAIL_RU[detail] ?? detail;
    }
    if (Array.isArray(detail)) {
        return formatValidationIssues(detail);
    }
    if (detail !== null && typeof detail === 'object') {
        try {
            const asJson = JSON.stringify(detail);
            if (asJson.length <= 200) {
                return translateHeuristic(asJson) ?? 'Не удалось выполнить операцию';
            }
        } catch {
            /* noop */
        }
    }
    if (status === 401) {
        return 'Требуется вход в систему';
    }
    if (status === 403) {
        return 'Доступ запрещён';
    }
    if (status === 404) {
        return 'Не найдено';
    }
    if (status === 413) {
        return 'Запрос слишком большой для сервера. Уменьшите размер файлов или обратитесь к администратору';
    }
    if (status >= 500) {
        return 'Ошибка сервера. Попробуйте позже';
    }
    return 'Не удалось выполнить запрос';
}

export function formatApiError(err: unknown): string {
    if (err instanceof ApiError) {
        return formatDetail(err.detail, err.status);
    }
    if (typeof err === 'object' && err !== null && 'name' in err && (err as Error).name === 'TypeError') {
        const msg = String((err as Error).message ?? '');
        if (msg === 'Failed to fetch' || msg.includes('fetch')) {
            return 'Нет связи с сервером. Проверьте подключение';
        }
    }
    if (err instanceof Error) {
        return translateHeuristic(err.message) ?? err.message;
    }
    return 'Ошибка запроса';
}
