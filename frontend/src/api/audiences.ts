import { apiRequest } from './client';
import type { DeviceOnMap, MapDoorEdge, RoomDeviceListItem, RoomMapData } from '../types/roomMap';

export type AudienceDto = {
    id: number;
    name: string;
};

export async function fetchAudiences(name?: string) {
    const q = name ? `?name=${encodeURIComponent(name)}` : '';
    const response = await apiRequest<{ items: AudienceDto[] }>(`/api/audiences${q}`);
    return response.items;
}

export async function createAudience(name: string) {
    return apiRequest<AudienceDto>('/api/audiences', {
        method: 'POST',
        body: JSON.stringify({ name }),
    });
}

export async function updateAudience(id: number, payload: { name: string }) {
    return apiRequest<AudienceDto>(`/api/audiences/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    });
}

export async function deleteAudience(id: number) {
    await apiRequest<void>(`/api/audiences/${id}`, { method: 'DELETE' });
}

// ── Room map API ──────────────────────────────────────────────────────────────

type DeviceOnMapApi = {
    device_id: string;
    x_pct: number;
    y_pct: number;
    grid_col?: number | null;
    grid_row?: number | null;
    device_name: string;
    inventory_number: string;
    repair_status: string;
    category_id?: string | null;
    category_has_icon?: boolean;
};

function mapDeviceOnMap(item: DeviceOnMapApi): DeviceOnMap {
    return {
        deviceId: item.device_id,
        xPct: item.x_pct,
        yPct: item.y_pct,
        gridCol: item.grid_col ?? null,
        gridRow: item.grid_row ?? null,
        deviceName: item.device_name,
        inventoryNumber: item.inventory_number,
        repairStatus: item.repair_status as DeviceOnMap['repairStatus'],
        categoryId: item.category_id ?? null,
        categoryHasIcon: Boolean(item.category_has_icon),
    };
}

function parseDoorEdge(value: string | undefined): MapDoorEdge {
    return value === 'top' ? 'top' : 'bottom';
}

export async function fetchRoomMap(audienceId: number): Promise<RoomMapData> {
    const data = await apiRequest<{
        audience_id: number;
        grid_cols: number;
        grid_rows: number;
        door_edge?: string;
        positions: DeviceOnMapApi[];
    }>(`/api/audiences/${audienceId}/map`);
    return {
        audienceId: data.audience_id,
        gridCols: data.grid_cols ?? 4,
        gridRows: data.grid_rows ?? 4,
        doorEdge: parseDoorEdge(data.door_edge),
        positions: data.positions.map(mapDeviceOnMap),
    };
}

export async function saveRoomMap(
    audienceId: number,
    positions: Array<{
        device_id: string;
        x_pct: number;
        y_pct: number;
        grid_col: number;
        grid_row: number;
    }>,
    grid: { gridCols: number; gridRows: number; doorEdge: MapDoorEdge },
): Promise<RoomMapData> {
    const data = await apiRequest<{
        audience_id: number;
        grid_cols: number;
        grid_rows: number;
        door_edge?: string;
        positions: DeviceOnMapApi[];
    }>(`/api/audiences/${audienceId}/map`, {
        method: 'PUT',
        body: JSON.stringify({
            positions,
            grid_cols: grid.gridCols,
            grid_rows: grid.gridRows,
            door_edge: grid.doorEdge,
        }),
    });
    return {
        audienceId: data.audience_id,
        gridCols: data.grid_cols ?? 4,
        gridRows: data.grid_rows ?? 4,
        doorEdge: parseDoorEdge(data.door_edge),
        positions: data.positions.map(mapDeviceOnMap),
    };
}

export async function fetchAudienceDevices(audienceId: number): Promise<RoomDeviceListItem[]> {
    const data = await apiRequest<{
        items: Array<{
            id: string;
            name: string;
            inventory_number: string;
            repair_status: string;
            is_on_map: boolean;
            category_id?: string | null;
            category_has_icon?: boolean;
        }>;
    }>(`/api/audiences/${audienceId}/devices`);
    return data.items.map((item) => ({
        id: item.id,
        name: item.name,
        inventoryNumber: item.inventory_number,
        repairStatus: item.repair_status as RoomDeviceListItem['repairStatus'],
        isOnMap: item.is_on_map,
        categoryId: item.category_id ?? null,
        categoryHasIcon: Boolean(item.category_has_icon),
    }));
}
