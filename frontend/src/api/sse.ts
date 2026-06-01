import { getStoredAuthToken } from './auth';

export type RepairRequestSsePayload = {
    type: 'updated';
    repair_request_id: string;
    device_id: string;
    status: string;
    source: string;
};

function apiBaseUrl(): string {
    const raw = import.meta.env.VITE_API_BASE_URL;
    if (raw === undefined || raw === null || String(raw).trim() === '') {
        return '';
    }
    return String(raw).replace(/\/+$/, '');
}

export function buildRepairRequestsSseUrl(options?: {
    repairRequestId?: string;
}): string | null {
    const token = getStoredAuthToken();
    if (!token) {
        return null;
    }
    const params = new URLSearchParams({ access_token: token });
    const rid = options?.repairRequestId?.trim();
    if (rid) {
        params.set('repair_request_id', rid);
    }
    const path = `/api/events/stream?${params.toString()}`;
    const base = apiBaseUrl();
    return base === '' ? path : `${base}${path}`;
}
