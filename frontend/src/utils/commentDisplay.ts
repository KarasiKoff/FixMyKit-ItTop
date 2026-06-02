export function normalizeCommentBodyForDisplay(body: string): string {
    return body
        .replace(/\u00a0/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/^\*\*([^*]+)\*\*:\s*\n+/, (_m, name: string) => `${name}:\n\n`);
}

export function authorInitials(displayName: string): string {
    const trimmed = displayName.trim();
    if (!trimmed) {
        return '?';
    }
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
        return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
    }
    return trimmed.slice(0, 2).toUpperCase();
}

export function formatCommentTime(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return '';
    }
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs >= 0 && diffMs < 60_000) {
        return 'только что';
    }
    if (diffMs >= 0 && diffMs < 3_600_000) {
        const mins = Math.max(1, Math.floor(diffMs / 60_000));
        return `${mins} мин. назад`;
    }
    const sameDay =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();

    if (sameDay) {
        return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}
