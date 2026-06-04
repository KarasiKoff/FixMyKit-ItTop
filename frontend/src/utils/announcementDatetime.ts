/** ISO UTC → значение для input[type=datetime-local] в локальной зоне. */
export function isoToDatetimeLocal(iso: string | null | undefined): string {
    if (!iso) {
        return '';
    }
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
        return '';
    }
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local → ISO UTC для API. */
export function datetimeLocalToIso(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }
    const d = new Date(trimmed);
    if (Number.isNaN(d.getTime())) {
        return null;
    }
    return d.toISOString();
}
