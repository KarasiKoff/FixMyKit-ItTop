import { useMemo } from 'react';
import { MAP_CHIP_SIZE_PX } from '../utils/mapChipConstants';
import { cellCenterToPct, computeFixedGridLayout, type GridLayout } from '../utils/roomMapGrid';
import type { DeviceOnMap } from '../types/roomMap';

export type MapDisplayDevice = DeviceOnMap & { xPct: number; yPct: number };

function hasSavedGridCell(device: DeviceOnMap, layout: GridLayout): boolean {
    return (
        device.gridCol != null &&
        device.gridRow != null &&
        device.gridCol >= 0 &&
        device.gridCol < layout.cols &&
        device.gridRow >= 0 &&
        device.gridRow < layout.rows
    );
}

export function useRoomMapDisplay(
    gridCols: number,
    gridRows: number,
    devices: DeviceOnMap[],
): { displayDevices: MapDisplayDevice[] } {
    const layout = useMemo(
        () => computeFixedGridLayout(MAP_CHIP_SIZE_PX, gridCols, gridRows),
        [gridCols, gridRows],
    );

    const displayDevices = useMemo((): MapDisplayDevice[] => {
        if (!layout) {
            return devices.map((d) => ({ ...d, xPct: d.xPct, yPct: d.yPct }));
        }
        return devices.map((d) => {
            if (hasSavedGridCell(d, layout)) {
                const { xPct, yPct } = cellCenterToPct(layout, d.gridCol!, d.gridRow!);
                return { ...d, xPct, yPct };
            }
            return { ...d, xPct: d.xPct, yPct: d.yPct };
        });
    }, [devices, layout]);

    return { displayDevices };
}
