import type { QrPrintTarget } from '../types/qrPrintTarget';
import type { Device } from '../types/device';

/**
 * Ссылка на публичную страницу устройства (по UUID).
 */
export function buildRepairRequestUrl(deviceId: string, _inventoryNumber?: string): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/device/${deviceId}/public`;
}

/** Ссылка на публичную страницу кабинета (по UUID). */
export function buildAudienceRepairRequestUrl(audienceId: string): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/audience/${audienceId}/public`;
}

export function qrPrintTargetFromDevice(device: Device): QrPrintTarget {
    return {
        label: device.inventoryNumber,
        directUrl: buildRepairRequestUrl(device.id, device.inventoryNumber),
        kind: 'device',
        entityId: device.id,
    };
}

export function qrPrintTargetFromAudience(audience: { id: string; name: string }): QrPrintTarget {
    return {
        label: audience.name,
        directUrl: buildAudienceRepairRequestUrl(audience.id),
        kind: 'audience',
        entityId: audience.id,
    };
}
