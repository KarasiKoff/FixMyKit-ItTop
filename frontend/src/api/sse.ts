import { apiRequest } from './client';

export type RepairRequestSsePayload = {
    type: 'updated';
    repair_request_id: string;
    device_id: string;
    status: string;
    source: string;
};

type SseTicketResponse = {
    sse_token: string;
    expires_in: number;
};

function apiBaseUrl(): string {
    const raw = import.meta.env.VITE_API_BASE_URL;
    if (raw === undefined || raw === null || String(raw).trim() === '') {
        return '';
    }
    return String(raw).replace(/\/+$/, '');
}

export async function fetchSseTicket(): Promise<SseTicketResponse> {
    return apiRequest<SseTicketResponse>('/api/events/ticket', { method: 'POST' });
}

export function buildRepairRequestsSseUrl(
    sseToken: string,
    options?: { repairRequestId?: string },
): string {
    const params = new URLSearchParams({ sse_token: sseToken });
    const rid = options?.repairRequestId?.trim();
    if (rid) {
        params.set('repair_request_id', rid);
    }
    const path = `/api/events/stream?${params.toString()}`;
    const base = apiBaseUrl();
    return base === '' ? path : `${base}${path}`;
}
