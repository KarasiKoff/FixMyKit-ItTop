/** Настройки сетки QR на листе A4 (печать / PDF). */
export type QrSheetSettings = {
    qrSizeMm: number;
    /** Внутренний отступ ячейки (от пунктира до QR и текста), мм. */
    cellPaddingMm: number;
    labelFontPt: number;
    labelGapMm: number;
    /** Жирный шрифт подписи. */
    labelBold: boolean;
    /** Размер логотипа в центре QR, % от ширины QR (при наличии изображения). */
    logoSizePercent: number;
    dashedGuides: boolean;
    pdfNameSuffix: string;
    /** Под подписью: одна сокращённая ссылка на общую страницу /scan (clck.ru). */
    showScanShortLink: boolean;
};

/** Значения по умолчанию и границы ползунков (поле ввода может выходить за них). */
export const QR_SHEET_DEFAULTS: QrSheetSettings = {
    qrSizeMm: 28,
    cellPaddingMm: 2,
    labelFontPt: 10,
    labelGapMm: 1.5,
    labelBold: false,
    logoSizePercent: 22,
    dashedGuides: true,
    pdfNameSuffix: '',
    showScanShortLink: false,
};

export const QR_SHEET_SLIDER_BOUNDS = {
    qrSizeMm: { min: 12, max: 48 },
    cellPaddingMm: { min: 0, max: 8 },
    labelFontPt: { min: 6, max: 16 },
    labelGapMm: { min: 0, max: 6 },
    logoSizePercent: { min: 8, max: 35 },
} as const;
