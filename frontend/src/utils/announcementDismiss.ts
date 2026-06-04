const STORAGE_PREFIX = 'fixmykit:announcement-dismiss:';

function storageKey(slot: number): string {
    return `${STORAGE_PREFIX}${slot}`;
}

export function isAnnouncementDismissed(slot: number, dismissVersion: number): boolean {
    try {
        const raw = localStorage.getItem(storageKey(slot));
        if (!raw) {
            return false;
        }
        const stored = Number.parseInt(raw, 10);
        if (Number.isNaN(stored)) {
            return raw === '1';
        }
        return stored >= dismissVersion;
    } catch {
        return false;
    }
}

export function dismissAnnouncement(slot: number, dismissVersion: number): void {
    try {
        localStorage.setItem(storageKey(slot), String(dismissVersion));
    } catch {
        /* private mode */
    }
}

export function clearAnnouncementDismiss(slot: number): void {
    try {
        localStorage.removeItem(storageKey(slot));
    } catch {
        /* ignore */
    }
}
