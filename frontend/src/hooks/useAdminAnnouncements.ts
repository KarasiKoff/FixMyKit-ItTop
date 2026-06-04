import { useCallback, useEffect, useState } from 'react';
import {
    fetchAdminAnnouncements,
    resetAnnouncementDismissals,
    saveAdminAnnouncements,
    toAnnouncementSavePayload,
    type SiteAnnouncementSlot,
} from '../api/announcements';
import { useToast } from './useToast';
import { formatApiError } from '../utils/formatApiError';
import {
    ANNOUNCEMENT_EMPTY_SLOT,
    normalizeAnnouncementSlots,
    validateAnnouncementSlots,
} from '../utils/announcementSlotUtils';

export function useAdminAnnouncements(enabled: boolean) {
    const { showSuccess, showError } = useToast();
    const [slots, setSlots] = useState<SiteAnnouncementSlot[]>([
        ANNOUNCEMENT_EMPTY_SLOT(1),
        ANNOUNCEMENT_EMPTY_SLOT(2),
    ]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [clock, setClock] = useState(() => Date.now());

    const load = useCallback(async () => {
        try {
            const res = await fetchAdminAnnouncements();
            setSlots(normalizeAnnouncementSlots(res.slots));
        } catch (err) {
            showError(formatApiError(err));
        } finally {
            setLoading(false);
        }
    }, [showError]);

    useEffect(() => {
        if (!enabled) {
            return;
        }
        setLoading(true);
        void load();
    }, [enabled, load]);

    useEffect(() => {
        const timer = window.setInterval(() => setClock(Date.now()), 30_000);
        return () => window.clearInterval(timer);
    }, []);

    function updateSlot(slot: 1 | 2, next: SiteAnnouncementSlot) {
        setSlots((prev) => prev.map((s) => (s.slot === slot ? next : s)));
    }

    async function handleSave() {
        const validation = validateAnnouncementSlots(slots);
        if (!validation.ok) {
            showError(validation.message);
            return;
        }
        setSaving(true);
        try {
            const payload = slots.map((s) => {
                const base = toAnnouncementSavePayload(s);
                return {
                    ...base,
                    message: base.message.trim(),
                    link_url: base.link_url?.trim() || null,
                    emoji: base.emoji?.trim() || null,
                };
            });
            const res = await saveAdminAnnouncements(payload);
            setSlots(normalizeAnnouncementSlots(res.slots));
            showSuccess('Объявления сохранены');
        } catch (err) {
            showError(formatApiError(err));
        } finally {
            setSaving(false);
        }
    }

    async function handleResetDismissals() {
        if (
            !window.confirm(
                'Сбросить «закрыто» у всех пользователей? Скрытые плашки снова появятся у тех, кто нажимал ×.',
            )
        ) {
            return;
        }
        setResetting(true);
        try {
            await resetAnnouncementDismissals();
            showSuccess('Скрытия сброшены — плашки снова видны всем');
            await load();
        } catch (err) {
            showError(formatApiError(err));
        } finally {
            setResetting(false);
        }
    }

    return {
        slots,
        loading,
        saving,
        resetting,
        clock,
        busy: saving || resetting,
        updateSlot,
        handleSave,
        handleResetDismissals,
    };
}
