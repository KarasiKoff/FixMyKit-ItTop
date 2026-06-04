import { apiRequest } from './client';

export type AnnouncementAudience = 'all' | 'admins_only';
export type AnnouncementSeverity = 'info' | 'warning' | 'danger';

export const ANNOUNCEMENT_MESSAGE_MAX = 500;
export const ANNOUNCEMENT_POLL_MS = 60_000;

export type SiteAnnouncementSlotInput = {
    slot: 1 | 2;
    is_enabled: boolean;
    message: string;
    audience: AnnouncementAudience;
    severity: AnnouncementSeverity;
    link_url: string | null;
    emoji: string | null;
    starts_at: string | null;
    ends_at: string | null;
};

export type SiteAnnouncementSlot = SiteAnnouncementSlotInput & {
    updated_at?: string | null;
    updated_by_login?: string | null;
    active_now?: boolean;
    dismiss_version?: number;
};

export type ActiveAnnouncement = {
    slot: number;
    message: string;
    severity: AnnouncementSeverity;
    audience: AnnouncementAudience;
    link_url: string | null;
    emoji: string | null;
    dismiss_version: number;
};

export type ActiveAnnouncementsResponse = {
    items: ActiveAnnouncement[];
};

export type AdminAnnouncementsResponse = {
    slots: SiteAnnouncementSlot[];
};

export type ResetDismissalsResponse = {
    dismiss_version: number;
};

export async function fetchActiveAnnouncements(): Promise<ActiveAnnouncementsResponse> {
    return apiRequest<ActiveAnnouncementsResponse>('/api/announcements/active');
}

export async function fetchAdminAnnouncements(): Promise<AdminAnnouncementsResponse> {
    return apiRequest<AdminAnnouncementsResponse>('/api/admin/announcements');
}

export async function saveAdminAnnouncements(
    slots: SiteAnnouncementSlotInput[],
): Promise<AdminAnnouncementsResponse> {
    return apiRequest<AdminAnnouncementsResponse>('/api/admin/announcements', {
        method: 'PUT',
        body: JSON.stringify({ slots }),
    });
}

export async function resetAnnouncementDismissals(): Promise<ResetDismissalsResponse> {
    return apiRequest<ResetDismissalsResponse>('/api/admin/announcements/reset-dismissals', {
        method: 'POST',
    });
}

export function toAnnouncementSavePayload(slot: SiteAnnouncementSlot): SiteAnnouncementSlotInput {
    return {
        slot: slot.slot,
        is_enabled: slot.is_enabled,
        message: slot.message,
        audience: slot.audience,
        severity: slot.severity,
        link_url: slot.link_url,
        emoji: slot.emoji,
        starts_at: slot.starts_at,
        ends_at: slot.ends_at,
    };
}
