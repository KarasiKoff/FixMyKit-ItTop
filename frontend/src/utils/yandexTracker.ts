const YANDEX_TRACKER_WEB = 'https://tracker.yandex.ru';

/**
 * Ссылка на тикет в веб-интерфейсе Яндекс Tracker (не URL из поля self API).
 */
export function yandexTrackerIssueWebHref(ticketKey?: string | null, ticketUrl?: string | null): string | undefined {
    const key = ticketKey?.trim();
    if (key) {
        return `${YANDEX_TRACKER_WEB}/${encodeURIComponent(key)}`;
    }
    const url = ticketUrl?.trim();
    if (!url) {
        return undefined;
    }
    const fromApiPath = url.match(/\/issues\/([^/?#]+)/i);
    if (fromApiPath?.[1]) {
        return `${YANDEX_TRACKER_WEB}/${encodeURIComponent(fromApiPath[1])}`;
    }
    if (url.includes('tracker.yandex.ru') && !url.includes('api.tracker.yandex.net')) {
        return url;
    }
    return undefined;
}
