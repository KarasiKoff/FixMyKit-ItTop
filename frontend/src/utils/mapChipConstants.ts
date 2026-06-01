/** Фиксированный размер квадратной карточки на карте (px), совпадает с CSS .device-chip--map-square */
export const MAP_CHIP_SIZE_PX = 88;

export function mapCanvasGridPx(cols: number, rows: number): { width: number; height: number } {
    const c = Math.max(1, cols);
    const r = Math.max(1, rows);
    return { width: c * MAP_CHIP_SIZE_PX, height: r * MAP_CHIP_SIZE_PX };
}
