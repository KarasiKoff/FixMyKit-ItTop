const YANDEX_TRACKER_WEB = 'https://tracker.yandex.ru';

/**
 * Ссылка на задачу во внешнем трекере (Jira browse URL или веб-интерфейс Yandex Tracker).
 * Предпочитает `ticketUrl` из API; для Yandex допускает сборку по ключу.
 */
export function externalIssueBrowseHref(
    ticketKey?: string | null,
    ticketUrl?: string | null,
): string | undefined {
    const url = ticketUrl?.trim();
    if (url) {
        if (url.includes('/browse/') || url.includes('atlassian.net')) {
            return url;
        }
        if (url.includes('tracker.yandex.ru') && !url.includes('api.tracker.yandex.net')) {
            return url;
        }
        const fromApiPath = url.match(/\/issues\/([^/?#]+)/i);
        if (fromApiPath?.[1]) {
            return `${YANDEX_TRACKER_WEB}/${encodeURIComponent(fromApiPath[1])}`;
        }
    }

    const key = ticketKey?.trim();
    if (key) {
        return `${YANDEX_TRACKER_WEB}/${encodeURIComponent(key)}`;
    }

    return undefined;
}
