/** Сброс React-сессии при 401 без прямой зависимости api/client от AuthProvider. */

let handler: (() => void) | null = null;

export function registerSessionExpiredHandler(next: (() => void) | null): void {
    handler = next;
}

export function notifySessionExpired(): void {
    handler?.();
}
