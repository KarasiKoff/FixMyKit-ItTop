import { fetchDevices } from '../api/devices';
import { Device } from '../types/device';

export const BULK_COUNT_MIN = 1;
export const BULK_COUNT_MAX = 50;

function maxSuffixIndex(values: string[], prefix: string): number {
    const fullPrefix = `${prefix}-`;
    let max = 0;
    for (const value of values) {
        if (!value.startsWith(fullPrefix)) {
            continue;
        }
        const n = Number.parseInt(value.slice(fullPrefix.length), 10);
        if (!Number.isNaN(n) && n > max) {
            max = n;
        }
    }
    return max;
}

async function nextBulkIndex(
    prefix: string,
    pickValues: (device: Device) => string[],
    listParams?: { room?: string },
): Promise<number> {
    let max = 0;
    let offset = 0;
    const limit = 50;

    while (true) {
        const { items, total } = await fetchDevices({ ...listParams, limit, offset });
        for (const device of items) {
            max = Math.max(max, maxSuffixIndex(pickValues(device), prefix));
        }
        offset += items.length;
        if (offset >= total || items.length === 0) {
            break;
        }
    }

    return max + 1;
}

export function nextBulkDeviceIndex(roomName: string): Promise<number> {
    return nextBulkIndex(roomName, (device) => [device.name, device.inventoryNumber], { room: roomName });
}

export function nextBulkSerialIndex(serialPrefix: string): Promise<number> {
    return nextBulkIndex(serialPrefix, (device) => (device.serialNumber ? [device.serialNumber] : []));
}

export function clampBulkCount(value: number): number {
    return Math.min(BULK_COUNT_MAX, Math.max(BULK_COUNT_MIN, value));
}
