import { MAP_CHIP_SIZE_PX } from './mapChipConstants';
import { cellCenterToPct, cellFromPct, computeFixedGridLayout } from './roomMapGrid';

export type PositionDraft = Record<string, { xPct: number; yPct: number }>;

export function buildMapSavePayload(
    positions: PositionDraft,
    gridCols: number,
    gridRows: number,
): Array<{
    device_id: string;
    x_pct: number;
    y_pct: number;
    grid_col: number;
    grid_row: number;
}> {
    const layout = computeFixedGridLayout(MAP_CHIP_SIZE_PX, gridCols, gridRows);
    if (!layout) {
        return Object.entries(positions).map(([device_id, pos]) => ({
            device_id,
            x_pct: pos.xPct,
            y_pct: pos.yPct,
            grid_col: 0,
            grid_row: 0,
        }));
    }
    return Object.entries(positions).map(([device_id, pos]) => {
        const { ci, cj } = cellFromPct(layout, pos.xPct, pos.yPct);
        const { xPct, yPct } = cellCenterToPct(layout, ci, cj);
        return {
            device_id,
            x_pct: xPct,
            y_pct: yPct,
            grid_col: ci,
            grid_row: cj,
        };
    });
}
