import { apiRequest, ApiRequestOptions } from './client';
import { Device } from '../types/device';
import type { DeviceSuggestField } from '../types/listQuery';
import { RepairHistoryEntry } from '../types/repairHistory';

type DeviceApi = {
    id: string;
    inventory_number: string;
    name: string;
    category?: { id: string; name: string } | null;
    subcategory?: { id: string; name: string; category_id?: string; is_active?: boolean } | null;
    serial_number?: string | null;
    audience?: { id: string; name: string } | null;
    responsible?: { id: string; full_name?: string | null; login: string } | null;
    repair_status: Device['status'];
    note?: string | null;
};

export function mapDevice(item: DeviceApi): Device {
    return {
        id: item.id,
        inventoryNumber: item.inventory_number,
        name: item.name,
        category: item.category?.name ?? '',
        categoryId: item.category?.id ?? null,
        subcategory: item.subcategory?.name ?? '',
        subcategoryId: item.subcategory?.id ?? null,
        serialNumber: item.serial_number ?? '',
        room: item.audience?.name ?? '',
        audienceId: item.audience?.id ?? null,
        responsible: item.responsible?.full_name ?? item.responsible?.login ?? '',
        responsibleId: item.responsible?.id ?? null,
        status: item.repair_status,
        note: item.note ?? null,
    };
}

type HistoryApi = {
    id: string;
    device_id: string;
    repair_request_id?: string | null;
    old_status?: string | null;
    new_status?: string | null;
    note?: string | null;
    created_at: string;
    tracker_ticket_key?: string | null;
    tracker_ticket_url?: string | null;
};

function mapHistoryRow(item: HistoryApi): RepairHistoryEntry {
    return {
        id: item.id,
        deviceId: item.device_id,
        repairRequestId: item.repair_request_id ?? undefined,
        oldStatus: (item.old_status as RepairHistoryEntry['oldStatus']) ?? undefined,
        newStatus: (item.new_status as RepairHistoryEntry['newStatus']) ?? undefined,
        note: item.note ?? undefined,
        createdAt: item.created_at,
        ticketKey: item.tracker_ticket_key ?? undefined,
        ticketUrl: item.tracker_ticket_url ?? undefined,
    };
}

export type DeviceListParams = {
    inventory_number?: string;
    name?: string;
    category?: string;
    room?: string;
    responsible?: string;
    repair_status?: Device['status'];
    sort_by?: string;
    sort_dir?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
};

function buildQuery(params: Record<string, string | number | undefined>): string {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== '') {
            search.set(key, String(value));
        }
    }
    const q = search.toString();
    return q ? `?${q}` : '';
}

export async function fetchDevices(params?: DeviceListParams) {
    const query = buildQuery({
        inventory_number: params?.inventory_number,
        name: params?.name,
        category: params?.category,
        room: params?.room,
        responsible: params?.responsible,
        repair_status: params?.repair_status,
        sort_by: params?.sort_by,
        sort_dir: params?.sort_dir,
        limit: params?.limit ?? 50,
        offset: params?.offset ?? 0,
    });
    const response = await apiRequest<{ items: DeviceApi[]; total: number }>(`/api/devices${query}`);
    return { items: response.items.map(mapDevice), total: response.total };
}

export type { DeviceSuggestField } from '../types/listQuery';

export async function suggestDevices(field: DeviceSuggestField, q: string) {
    const params = new URLSearchParams({ field, q });
    const response = await apiRequest<{ items: string[] }>(`/api/devices/suggest?${params.toString()}`);
    return response.items;
}

export async function fetchDeviceById(id: string) {
    return mapDevice(await apiRequest<DeviceApi>(`/api/devices/${id}`));
}

export async function fetchPublicDeviceById(id: string, init?: ApiRequestOptions) {
    if (!id?.trim() || id.trim() === 'undefined') {
        throw new Error('invalid_device_id');
    }
    return mapDevice(
        await apiRequest<DeviceApi>(`/api/public/devices/${id}`, {
            ...init,
            skipAuth: true,
        }),
    );
}

/** Поиск устройства по QR/ручному вводу: UUID или точный инв. номер. */
export async function resolveDeviceByScanInput(raw: string): Promise<Device> {
    const trimmed = raw.trim();
    if (!trimmed) {
        throw new Error('empty_scan_input');
    }
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRe.test(trimmed)) {
        return fetchDeviceById(trimmed);
    }
    return fetchPublicDeviceByInventory(trimmed);
}

export async function fetchPublicDeviceByInventory(inventoryNumber: string) {
    const params = new URLSearchParams({ number: inventoryNumber.trim() });
    return mapDevice(
        await apiRequest<DeviceApi>(`/api/public/devices/by-inventory?${params.toString()}`, {
            skipAuth: true,
        }),
    );
}

export async function fetchDeviceHistory(deviceId: string) {
    const response = await apiRequest<{ items: HistoryApi[] }>(`/api/devices/${deviceId}/history`);
    return response.items.map(mapHistoryRow);
}

export async function createDevice(payload: {
    inventory_number: string;
    name: string;
    serial_number?: string | null;
    audience_id?: string | null;
    category_id?: string | null;
    subcategory_id?: string | null;
    responsible_id?: string | null;
    repair_status: Device['status'];
    note?: string | null;
}) {
    return mapDevice(
        await apiRequest<DeviceApi>('/api/devices', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    );
}

export async function fetchDeviceQrUrl(deviceId: string) {
    const response = await apiRequest<{ device_id: string; url: string }>(`/api/devices/${deviceId}/qr`);
    return response.url;
}

export async function updateDeviceStatus(id: string, status: Device['status']) {
    return mapDevice(
        await apiRequest<DeviceApi>(`/api/devices/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ repair_status: status }),
        }),
    );
}

export async function updateDevice(
    id: string,
    payload: {
        inventory_number?: string;
        name?: string;
        serial_number?: string | null;
        audience_id?: string | null;
        category_id?: string | null;
        subcategory_id?: string | null;
        responsible_id?: string | null;
        repair_status?: Device['status'];
        note?: string | null;
    },
) {
    return mapDevice(
        await apiRequest<DeviceApi>(`/api/devices/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        }),
    );
}

export async function deleteDevice(id: string) {
    await apiRequest<void>(`/api/devices/${id}`, { method: 'DELETE' });
}
