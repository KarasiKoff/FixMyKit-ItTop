import type { AnnouncementSeverity, SiteAnnouncementSlot } from '../api/announcements';

export const ANNOUNCEMENT_EMPTY_SLOT = (slot: 1 | 2): SiteAnnouncementSlot => ({
    slot,
    is_enabled: false,
    message: '',
    audience: 'all',
    severity: 'info',
    link_url: null,
    emoji: null,
    starts_at: null,
    ends_at: null,
});

export const ANNOUNCEMENT_SEVERITY_OPTIONS: { value: AnnouncementSeverity; label: string }[] = [
    { value: 'info', label: 'Инфо' },
    { value: 'warning', label: 'Внимание' },
    { value: 'danger', label: 'Важно' },
];

export function normalizeAnnouncementSlots(slots: SiteAnnouncementSlot[]): SiteAnnouncementSlot[] {
    const bySlot = new Map(slots.map((s) => [s.slot, s]));
    return [ANNOUNCEMENT_EMPTY_SLOT(1), ANNOUNCEMENT_EMPTY_SLOT(2)].map((fallback) => {
        const found = bySlot.get(fallback.slot);
        if (!found) {
            return fallback;
        }
        return {
            ...fallback,
            ...found,
            emoji: found.emoji?.trim() ? found.emoji.trim() : null,
        };
    });
}

export function computeAnnouncementActiveNow(slot: SiteAnnouncementSlot, nowMs = Date.now()): boolean {
    if (!slot.is_enabled || !slot.message.trim()) {
        return false;
    }
    if (slot.starts_at && new Date(slot.starts_at).getTime() > nowMs) {
        return false;
    }
    if (slot.ends_at && new Date(slot.ends_at).getTime() < nowMs) {
        return false;
    }
    return true;
}

export function formatAnnouncementUpdatedAt(iso: string | null | undefined): string {
    if (!iso) {
        return 'ещё не сохранялось';
    }
    try {
        return new Date(iso).toLocaleString('ru-RU');
    } catch {
        return iso;
    }
}

export function announcementSlotToPreview(slot: SiteAnnouncementSlot) {
    return {
        message: slot.message.trim() || 'Текст объявления появится здесь',
        severity: slot.severity,
        audience: slot.audience,
        link_url: slot.link_url,
        emoji: slot.emoji,
    };
}

export function validateAnnouncementSlots(
    slots: SiteAnnouncementSlot[],
): { ok: true } | { ok: false; message: string } {
    for (const s of slots) {
        if (s.is_enabled && !s.message.trim()) {
            return { ok: false, message: `Плашка ${s.slot}: укажите текст или отключите показ` };
        }
        if (s.starts_at && s.ends_at && new Date(s.starts_at) > new Date(s.ends_at)) {
            return { ok: false, message: `Плашка ${s.slot}: дата «с» позже даты «до»` };
        }
        const link = s.link_url?.trim();
        if (link && !link.startsWith('http://') && !link.startsWith('https://')) {
            return { ok: false, message: `Плашка ${s.slot}: ссылка должна начинаться с http:// или https://` };
        }
    }
    return { ok: true };
}
