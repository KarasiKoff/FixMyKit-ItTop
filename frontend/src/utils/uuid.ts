const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): boolean {
    if (!value) {
        return false;
    }
    const t = value.trim();
    if (!t || t === 'undefined' || t === 'null') {
        return false;
    }
    return UUID_RE.test(t);
}
