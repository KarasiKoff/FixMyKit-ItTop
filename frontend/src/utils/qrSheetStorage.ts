import { QR_SHEET_DEFAULTS, type QrSheetSettings } from '../types/qrSheetSettings';

const STORAGE_KEY = 'fixmykit-qr-sheet-settings';

type PartialSettings = Partial<QrSheetSettings> & { evenColumns?: boolean; gapMm?: number };

function parseNumber(v: unknown, fallback: number): number {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function parseBool(v: unknown, fallback: boolean): boolean {
    return typeof v === 'boolean' ? v : fallback;
}

function parseString(v: unknown, fallback: string): string {
    return typeof v === 'string' ? v : fallback;
}

export function loadQrSheetSettings(): QrSheetSettings {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return { ...QR_SHEET_DEFAULTS };
        }
        const o = JSON.parse(raw) as PartialSettings;
        return {
            qrSizeMm: parseNumber(o.qrSizeMm, QR_SHEET_DEFAULTS.qrSizeMm),
            cellPaddingMm: parseNumber(o.cellPaddingMm, QR_SHEET_DEFAULTS.cellPaddingMm),
            labelFontPt: parseNumber(o.labelFontPt, QR_SHEET_DEFAULTS.labelFontPt),
            labelGapMm: parseNumber(o.labelGapMm, QR_SHEET_DEFAULTS.labelGapMm),
            labelBold: parseBool(o.labelBold, QR_SHEET_DEFAULTS.labelBold),
            logoSizePercent: parseNumber(o.logoSizePercent, QR_SHEET_DEFAULTS.logoSizePercent),
            dashedGuides: parseBool(o.dashedGuides, QR_SHEET_DEFAULTS.dashedGuides),
            pdfNameSuffix: parseString(o.pdfNameSuffix, QR_SHEET_DEFAULTS.pdfNameSuffix),
        };
    } catch {
        return { ...QR_SHEET_DEFAULTS };
    }
}

export function saveQrSheetSettings(s: QrSheetSettings): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
        /* ignore */
    }
}

/** Для имени файла: убрать недопустимые символы. */
export function sanitizePdfSuffixPart(raw: string): string {
    return raw.replace(/[\u0000-\u001f<>:"/\\|?*]+/g, '').trim().slice(0, 80);
}

export function buildPdfFilename(suffix: string): string {
    const part = sanitizePdfSuffixPart(suffix);
    return part.length > 0 ? `qr-codes-${part}.pdf` : 'qr-codes.pdf';
}
