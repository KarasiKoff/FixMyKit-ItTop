import { getStoredAuthToken } from './auth';
import { apiRequest } from './client';
import { PublicRepairSummary, RepairRequest, RepairRequestDetail } from '../types/repairRequest';
import { RepairRequestComment } from '../types/repairRequestComment';

type RepairRequestApi = {
    id: string;
    device_id: string;
    applicant_name?: string | null;
    description: string;
    status: 'open' | 'in_progress' | 'closed';
    is_published: boolean;
    taken_by_sysadmin_at?: string | null;
    created_at: string;
    tracker_ticket_id?: string | null;
    tracker_ticket_key?: string | null;
    tracker_ticket_url?: string | null;
    tracker_status_label?: string | null;
    tracker_status_sync_pending?: boolean;
    last_sync_at?: string | null;
    resolution_note?: string | null;
    resolution_desc?: string | null;
    closed_at?: string | null;
    closed_by_user_id?: string | null;
    closed_by_tracker_display?: string | null;
    device_inventory_number?: string | null;
    device_name?: string | null;
    has_attachments?: boolean;
    attachments_sync_status?: 'none' | 'partial' | 'complete';
    attachments_count?: number;
    attachments_synced_count?: number;
};

type PublicRepairSummaryApi = {
    device: {
        id: string;
        inventory_number: string;
        name: string;
        category?: { id: string; name: string } | null;
        audience?: { id: number; name: string } | null;
    };
    active_request: {
        id: string;
        description: string;
        status: string;
        created_at: string;
        closed_at?: string | null;
        resolution_note?: string | null;
        applicant_name?: string | null;
    } | null;
    has_unpublished_active: boolean;
    history: Array<{
        id: string;
        description: string;
        status: string;
        created_at: string;
        closed_at?: string | null;
        resolution_note?: string | null;
        applicant_name?: string | null;
    }>;
};

function mapRepairRequest(item: RepairRequestApi): RepairRequest {
    return {
        id: item.id,
        deviceId: item.device_id,
        requesterName: item.applicant_name ?? '',
        description: item.description,
        status: item.status === 'open' ? 'new' : item.status,
        takenBySysadmin: Boolean(item.taken_by_sysadmin_at),
        isPublished: item.is_published ?? false,
        createdAt: item.created_at,
        ticketId: item.tracker_ticket_id ?? undefined,
        ticketKey: item.tracker_ticket_key ?? undefined,
        ticketUrl: item.tracker_ticket_url ?? undefined,
        trackerStatusLabel: item.tracker_status_label ?? undefined,
        trackerStatusSyncPending: item.tracker_status_sync_pending ?? false,
        lastSyncedAt: item.last_sync_at ?? undefined,
        deviceInventoryNumber: item.device_inventory_number ?? undefined,
        deviceName: item.device_name ?? undefined,
        hasAttachments: item.has_attachments ?? false,
        attachmentsSyncStatus: item.attachments_sync_status ?? 'none',
        attachmentsCount: item.attachments_count ?? 0,
    };
}

function buildRepairRequestFormData(payload: {
    deviceId: string;
    requesterName: string;
    description: string;
    syncToTracker?: boolean;
    files?: File[];
}): FormData {
    const form = new FormData();
    form.append('device_id', payload.deviceId);
    form.append('description', payload.description);
    if (payload.requesterName.trim()) {
        form.append('applicant_name', payload.requesterName.trim());
    }
    if (payload.syncToTracker !== undefined) {
        form.append('sync_to_tracker', payload.syncToTracker ? 'true' : 'false');
    }
    for (const file of payload.files ?? []) {
        form.append('files', file);
    }
    return form;
}

function mapDetail(item: RepairRequestApi): RepairRequestDetail {
    const base = mapRepairRequest(item);
    return {
        ...base,
        resolutionNote: item.resolution_note ?? undefined,
        resolutionDesc: item.resolution_desc ?? undefined,
        closedAt: item.closed_at ?? undefined,
        closedByUserId: item.closed_by_user_id ?? undefined,
        closedByTrackerDisplay: item.closed_by_tracker_display ?? undefined,
    };
}

export function isRepairRequestSynced(r: Pick<RepairRequest, 'ticketId' | 'ticketKey' | 'lastSyncedAt'>): boolean {
    return Boolean(r.ticketKey || r.ticketId || r.lastSyncedAt);
}

export async function createRepairRequest(payload: {
    deviceId: string;
    requesterName: string;
    description: string;
    syncToTracker?: boolean;
    files?: File[];
}) {
    const token = getStoredAuthToken();
    const hasFiles = (payload.files?.length ?? 0) > 0;
    if (token) {
        const init = hasFiles
            ? {
                  method: 'POST' as const,
                  body: buildRepairRequestFormData(payload),
              }
            : {
                  method: 'POST' as const,
                  body: JSON.stringify({
                      device_id: payload.deviceId,
                      applicant_name: payload.requesterName?.trim() || null,
                      description: payload.description,
                      sync_to_tracker: payload.syncToTracker ?? true,
                  }),
              };
        const response = await apiRequest<RepairRequestApi>('/api/repair-requests', init);
        return mapRepairRequest(response);
    }

    const pubInit = hasFiles
        ? {
              method: 'POST' as const,
              body: buildRepairRequestFormData({
                  deviceId: payload.deviceId,
                  requesterName: payload.requesterName,
                  description: payload.description,
                  files: payload.files,
              }),
              skipAuth: true as const,
          }
        : {
              method: 'POST' as const,
              body: JSON.stringify({
                  device_id: payload.deviceId,
                  applicant_name: payload.requesterName,
                  description: payload.description,
              }),
              skipAuth: true as const,
          };
    const pub = await apiRequest<{
        id: string;
        status: string;
        has_attachments?: boolean;
        attachments_sync_status?: RepairRequestApi['attachments_sync_status'];
        attachments_count?: number;
        attachments_synced_count?: number;
    }>('/api/public/repair-requests', pubInit);

    const statusMap: Record<string, RepairRequestApi['status']> = {
        open: 'open',
        in_progress: 'in_progress',
        closed: 'closed',
    };
    const st = statusMap[pub.status] ?? 'open';

    return mapRepairRequest({
        id: pub.id,
        device_id: payload.deviceId,
        applicant_name: payload.requesterName,
        description: payload.description,
        status: st,
        is_published: false,
        taken_by_sysadmin_at: null,
        created_at: new Date().toISOString(),
        tracker_ticket_id: null,
        tracker_ticket_key: null,
        tracker_ticket_url: null,
        last_sync_at: null,
        has_attachments: pub.has_attachments,
        attachments_sync_status: pub.attachments_sync_status,
        attachments_count: pub.attachments_count,
        attachments_synced_count: pub.attachments_synced_count,
    });
}

export type RepairRequestListParams = {
    device?: string;
    applicant?: string;
    status?: 'open' | 'in_progress' | 'closed';
    sort_by?: string;
    sort_dir?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
};

function buildRepairRequestQuery(params: Record<string, string | number | undefined>): string {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== '') {
            search.set(key, String(value));
        }
    }
    const q = search.toString();
    return q ? `?${q}` : '';
}

export async function fetchRepairRequests(params?: RepairRequestListParams) {
    const query = buildRepairRequestQuery({
        device: params?.device,
        applicant: params?.applicant,
        status: params?.status,
        sort_by: params?.sort_by,
        sort_dir: params?.sort_dir,
        limit: params?.limit ?? 50,
        offset: params?.offset ?? 0,
    });
    const response = await apiRequest<{ items: RepairRequestApi[]; total: number }>(`/api/repair-requests${query}`);
    return { items: response.items.map(mapRepairRequest), total: response.total };
}

export type RepairRequestSuggestField = 'device' | 'applicant';

export async function suggestRepairRequests(field: RepairRequestSuggestField, q: string) {
    const params = new URLSearchParams({ field, q });
    const response = await apiRequest<{ items: string[] }>(`/api/repair-requests/suggest?${params.toString()}`);
    return response.items;
}

export async function fetchRepairRequest(id: string) {
    return mapDetail(await apiRequest<RepairRequestApi>(`/api/repair-requests/${id}`));
}

export async function patchRepairRequestStatus(id: string, status: 'open' | 'in_progress' | 'closed', resolutionNote?: string | null) {
    const body: Record<string, unknown> = { status };
    if (resolutionNote !== undefined && resolutionNote !== null) {
        body.resolution_note = resolutionNote;
    }
    return mapDetail(
        await apiRequest<RepairRequestApi>(`/api/repair-requests/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }),
    );
}

export async function patchRepairRequestTake(id: string, taken: boolean) {
    return mapDetail(
        await apiRequest<RepairRequestApi>(`/api/repair-requests/${id}/take`, {
            method: 'PATCH',
            body: JSON.stringify({ taken }),
        }),
    );
}

export async function patchRepairRequestWorkflow(
    id: string,
    payload: {
        workflow: 'open' | 'in_progress' | 'needs_info' | 'closed';
        resolution?: 'resolved' | 'wont_fix';
        comment?: string;
    },
): Promise<RepairRequestDetail> {
    const body: Record<string, unknown> = { workflow: payload.workflow };
    if (payload.resolution) {
        body.resolution = payload.resolution;
    }
    if (payload.comment !== undefined && payload.comment !== '') {
        body.comment = payload.comment;
    }
    return mapDetail(
        await apiRequest<RepairRequestApi>(`/api/repair-requests/${id}/workflow`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }),
    );
}

export async function patchRepairRequestClose(id: string, resolutionNote?: string | null) {
    return mapDetail(
        await apiRequest<RepairRequestApi>(`/api/repair-requests/${id}/close`, {
            method: 'PATCH',
            body: JSON.stringify({ resolution_note: resolutionNote }),
        }),
    );
}

export async function pushRepairRequestStatusToTracker(id: string): Promise<RepairRequestDetail> {
    return mapDetail(
        await apiRequest<RepairRequestApi>(`/api/repair-requests/${id}/tracker/push-status`, {
            method: 'POST',
        }),
    );
}

export async function syncRepairRequestTracker(id: string) {
    return apiRequest<{
        tracker_ticket_id: string;
        tracker_ticket_key: string;
        tracker_ticket_url: string;
        last_sync_at: string;
    }>(`/api/repair-requests/${id}/tracker/sync`, { method: 'POST' });
}

export async function syncAllUnsynchronizedRepairRequests() {
    return apiRequest<{ attempted: number; synced: number; failed: number }>(
        '/api/repair-requests/tracker/sync-unsynchronized',
        { method: 'POST' },
    );
}

export async function publishRepairRequest(id: string, isPublished: boolean): Promise<RepairRequestDetail> {
    return mapDetail(
        await apiRequest<RepairRequestApi>(`/api/repair-requests/${id}/publish`, {
            method: 'PATCH',
            body: JSON.stringify({ is_published: isPublished }),
        }),
    );
}

type RepairRequestCommentApi = {
    id: string;
    repair_request_id: string;
    author_user_id: string;
    author_login?: string | null;
    author_display_name?: string | null;
    body: string;
    tracker_synced: boolean;
    created_at: string;
};

function mapComment(item: RepairRequestCommentApi): RepairRequestComment {
    return {
        id: item.id,
        repairRequestId: item.repair_request_id,
        authorUserId: item.author_user_id,
        authorLogin: item.author_login ?? undefined,
        authorDisplayName: item.author_display_name ?? undefined,
        body: item.body,
        trackerSynced: item.tracker_synced,
        createdAt: item.created_at,
    };
}

export async function fetchRepairRequestComments(requestId: string): Promise<RepairRequestComment[]> {
    const response = await apiRequest<{ items: RepairRequestCommentApi[] }>(
        `/api/repair-requests/${requestId}/comments`,
    );
    return response.items.map(mapComment);
}

export async function postRepairRequestComment(requestId: string, body: string): Promise<RepairRequestComment> {
    return mapComment(
        await apiRequest<RepairRequestCommentApi>(`/api/repair-requests/${requestId}/comments`, {
            method: 'POST',
            body: JSON.stringify({ body }),
        }),
    );
}

export async function fetchPublicRepairSummary(deviceId: string): Promise<PublicRepairSummary> {
    const data = await apiRequest<PublicRepairSummaryApi>(
        `/api/public/devices/${deviceId}/repair-summary`,
        { skipAuth: true },
    );
    return {
        device: {
            id: data.device.id,
            inventoryNumber: data.device.inventory_number,
            name: data.device.name,
            category: data.device.category ?? null,
            audience: data.device.audience ?? null,
        },
        activeRequest: data.active_request
            ? {
                  id: data.active_request.id,
                  description: data.active_request.description,
                  status: data.active_request.status as 'open' | 'in_progress' | 'closed',
                  createdAt: data.active_request.created_at,
                  closedAt: data.active_request.closed_at,
                  resolutionNote: data.active_request.resolution_note,
                  applicantName: data.active_request.applicant_name,
              }
            : null,
        hasUnpublishedActive: data.has_unpublished_active,
        history: data.history.map((h) => ({
            id: h.id,
            description: h.description,
            status: h.status as 'open' | 'in_progress' | 'closed',
            createdAt: h.created_at,
            closedAt: h.closed_at,
            resolutionNote: h.resolution_note,
            applicantName: h.applicant_name,
        })),
    };
}
