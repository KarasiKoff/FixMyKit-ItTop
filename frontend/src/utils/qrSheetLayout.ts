import type { QrSheetSettings } from '../types/qrSheetSettings';

export const PAGE_W_MM = 210;
export const PAGE_H_MM = 297;

/** Высота одной строки подписи в мм (pt - мм с запасом по межстрочному). */
export function labelTextHeightMm(fontPt: number): number {
    return fontPt * (25.4 / 72) * 1.25;
}

/** Внешняя ширина ячейки (QR + внутренний паддинг слева/справа). */
export function outerCellWidthMm(qrSizeMm: number, cellPaddingMm: number): number {
    return qrSizeMm + 2 * cellPaddingMm;
}

/** Внешняя высота ячейки (QR + зазор до текста + строка текста + паддинг сверху/снизу). */
export function outerCellHeightMm(s: Pick<QrSheetSettings, 'qrSizeMm' | 'labelGapMm' | 'labelFontPt' | 'cellPaddingMm'>): number {
    return s.qrSizeMm + s.labelGapMm + labelTextHeightMm(s.labelFontPt) + 2 * s.cellPaddingMm;
}

/** Сколько ячеек помещается в ряд по ширине листа (зазор между ячейками всегда 0). */
export function computeColsPerRow(qrSizeMm: number, cellPaddingMm: number): number {
    const w = outerCellWidthMm(qrSizeMm, cellPaddingMm);
    if (w <= 0) {
        return 0;
    }
    return Math.floor(PAGE_W_MM / w);
}

/** Сколько рядов помещается на одной странице. */
export function computeRowsPerPage(s: Pick<QrSheetSettings, 'qrSizeMm' | 'labelGapMm' | 'labelFontPt' | 'cellPaddingMm'>): number {
    const h = outerCellHeightMm(s);
    if (h <= 0) {
        return 0;
    }
    return Math.floor(PAGE_H_MM / h);
}

export function slotsPerPage(cols: number, rows: number): number {
    return Math.max(0, cols) * Math.max(0, rows);
}

/** Приблизительное число листов A4. */
export function estimatePageCount(deviceCount: number, cols: number, rows: number): number {
    const n = slotsPerPage(cols, rows);
    if (n <= 0 || deviceCount <= 0) {
        return 0;
    }
    return Math.ceil(deviceCount / n);
}

export type QrSheetWarnings = string[];

export function collectQrSheetWarnings(
    s: QrSheetSettings,
    cols: number,
    rows: number,
    deviceCount: number,
): QrSheetWarnings {
    const w: string[] = [];
    if (s.qrSizeMm <= 0) {
        w.push('Размер QR задан неположительным — раскладка может быть некорректной.');
    }
    if (s.cellPaddingMm < 0) {
        w.push('Отрицательный внутренний отступ ячейки может привести к некорректной вёрстке.');
    }
    if (cols < 1) {
        w.push('При текущих размерах в ряд не помещается ни одного QR по ширине листа.');
    }
    if (rows < 1) {
        w.push('При текущих размерах на страницу не помещается ни одного ряда по высоте.');
    }
    const per = slotsPerPage(cols, rows);
    if (per === 0 && deviceCount > 0) {
        w.push('Нет ни одной ячейки на странице — проверьте размеры и отступы.');
    }
    if (s.labelFontPt <= 0) {
        w.push('Размер шрифта подписи неположительный — текст может не отображаться.');
    }
    if (s.labelGapMm < 0) {
        w.push('Отступ подписи от QR отрицательный — возможно наложение текста на код.');
    }
    return w;
}
