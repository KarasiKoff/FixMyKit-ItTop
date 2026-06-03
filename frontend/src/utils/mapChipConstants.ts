/** Фиксированный размер квадратной карточки на карте (px), совпадает с CSS .device-chip--map-square */
export const MAP_CHIP_SIZE_PX = 88;

/** Расстояние между карточками на сетке (px), чтобы не сливались подсветки и рамки */
export const MAP_CHIP_GAP_PX = 16;

export function mapGridPitchPx(): number {
    return MAP_CHIP_SIZE_PX + MAP_CHIP_GAP_PX;
}

export function mapCanvasGridPx(cols: number, rows: number): { width: number; height: number } {
    const c = Math.max(1, cols);
    const r = Math.max(1, rows);
    const gapW = (c - 1) * MAP_CHIP_GAP_PX;
    const gapH = (r - 1) * MAP_CHIP_GAP_PX;
    return {
        width: c * MAP_CHIP_SIZE_PX + gapW,
        height: r * MAP_CHIP_SIZE_PX + gapH,
    };
}
