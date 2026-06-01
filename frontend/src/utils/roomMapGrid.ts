import { MAP_CHIP_SIZE_PX } from './mapChipConstants';

export type GridLayout = {
    innerW: number;
    innerH: number;
    chip: number;
    cols: number;
    rows: number;
    K: number;
    ox: number;
    oy: number;
};

/** Сетка без масштабирования: холст = cols×chip × rows×chip */
export function computeFixedGridLayout(
    chip: number = MAP_CHIP_SIZE_PX,
    cols: number,
    rows: number,
): GridLayout | null {
    if (chip <= 0 || cols < 1 || rows < 1) return null;
    const innerW = cols * chip;
    const innerH = rows * chip;
    return { innerW, innerH, chip, cols, rows, K: 1, ox: 0, oy: 0 };
}

/** Совместимость: если размеры холста совпадают с сеткой — та же раскладка */
export function computeGridLayout(
    innerW: number,
    innerH: number,
    chip: number,
    cols: number,
    rows: number,
): GridLayout | null {
    const layout = computeFixedGridLayout(chip, cols, rows);
    if (!layout) return null;
    return { ...layout, innerW, innerH };
}

export function cellCenterToPct(layout: GridLayout, ci: number, cj: number): { xPct: number; yPct: number } {
    const cx = layout.ox + (ci + 0.5) * layout.chip * layout.K;
    const cy = layout.oy + (cj + 0.5) * layout.chip * layout.K;
    return { xPct: (cx / layout.innerW) * 100, yPct: (cy / layout.innerH) * 100 };
}

export function nearestCellFromInnerPx(layout: GridLayout, mx: number, my: number): { ci: number; cj: number } {
    const { ox, oy, K, chip, cols, rows } = layout;
    const localX = (mx - ox) / K;
    const localY = (my - oy) / K;
    let ci = Math.round(localX / chip - 0.5);
    let cj = Math.round(localY / chip - 0.5);
    ci = Math.max(0, Math.min(cols - 1, ci));
    cj = Math.max(0, Math.min(rows - 1, cj));
    return { ci, cj };
}

export function nearestCellFromClient(
    layout: GridLayout,
    clientX: number,
    clientY: number,
    rect: DOMRect,
): { ci: number; cj: number } {
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    return nearestCellFromInnerPx(layout, mx, my);
}

export function cellFromPct(layout: GridLayout, xPct: number, yPct: number): { ci: number; cj: number } {
    const mx = (xPct / 100) * layout.innerW;
    const my = (yPct / 100) * layout.innerH;
    return nearestCellFromInnerPx(layout, mx, my);
}

export function isCellOccupiedByOther(
    positions: Record<string, { xPct: number; yPct: number }>,
    layout: GridLayout,
    targetCi: number,
    targetCj: number,
    selfId: string,
): boolean {
    for (const [id, pos] of Object.entries(positions)) {
        if (id === selfId) continue;
        const { ci, cj } = cellFromPct(layout, pos.xPct, pos.yPct);
        if (ci === targetCi && cj === targetCj) return true;
    }
    return false;
}
