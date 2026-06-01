/**
 * Ссылка на публичную страницу устройства (по UUID).
 */
export function buildRepairRequestUrl(deviceId: string, _inventoryNumber?: string): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/device/${deviceId}/public`;
}

