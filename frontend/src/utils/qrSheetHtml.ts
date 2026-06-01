import type { QrSheetSettings } from '../types/qrSheetSettings';
import { outerCellHeightMm, outerCellWidthMm } from './qrSheetLayout';

export const QR_EXPORT_DPI = 300;

/** Пиксельная ширина/высота растрового QR для заданного размера на бумаге (мм). */
export function qrRasterPxFromMm(qrSizeMm: number): number {
    return Math.max(32, Math.round(qrSizeMm * (QR_EXPORT_DPI / 25.4)));
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export type QrSheetItem = { dataUrl: string; inventoryNumber: string };

function pageAndItemBorders(s: QrSheetSettings): string {
    if (!s.dashedGuides) {
        return `
            .print-page { border: none; }
            .qr-item { border: none; }
        `;
    }
    return `
        .print-page {
            border: 0.25mm dashed #444;
            box-sizing: border-box;
        }
        .qr-item {
            border-right: 0.2mm dashed #888;
            border-bottom: 0.2mm dashed #888;
            box-sizing: border-box;
        }
    `;
}

export function buildEmbeddedSheetCss(s: QrSheetSettings): string {
    const cellW = outerCellWidthMm(s.qrSizeMm, s.cellPaddingMm);
    const cellH = outerCellHeightMm(s);
    const borders = pageAndItemBorders(s);
    return `
        .sheet-root { margin: 0; padding: 0; background: #fff; color: #000; width: 210mm; }
        .print-page {
            display: flex;
            flex-wrap: wrap;
            gap: 0;
            justify-content: flex-start;
            align-content: flex-start;
            width: 210mm;
            min-height: 297mm;
            max-height: 297mm;
            height: 297mm;
            padding: 0;
            margin: 0;
            box-sizing: border-box;
            page-break-after: always;
            overflow: hidden;
        }
        .print-page:last-child { page-break-after: auto; }
        .qr-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            flex: 0 0 ${cellW}mm;
            width: ${cellW}mm;
            min-height: ${cellH}mm;
            padding: ${s.cellPaddingMm}mm;
            margin: 0;
            box-sizing: border-box;
        }
        .qr-item img {
            width: ${s.qrSizeMm}mm;
            height: ${s.qrSizeMm}mm;
            display: block;
            flex-shrink: 0;
        }
        .qr-item p {
            margin: 0;
            margin-top: ${s.labelGapMm}mm;
            font-size: ${s.labelFontPt}pt;
            font-weight: ${s.labelBold ? '700' : '400'};
            line-height: 1.2;
            text-align: center;
            word-break: break-word;
            max-width: 100%;
            width: ${s.qrSizeMm}mm;
        }
        ${borders}
    `;
}

export function buildPrintPageInnerHtml(items: QrSheetItem[]): string {
    return items
        .map(
            (qr) =>
                `<div class="qr-item"><img src="${qr.dataUrl}" alt="QR" /><p>${escapeHtml(qr.inventoryNumber)}</p></div>`,
        )
        .join('');
}

/** Разбивка по страницам: не больше perPage элементов на лист. */
export function chunkItems<T>(items: T[], perPage: number): T[][] {
    if (items.length === 0) {
        return [];
    }
    if (perPage <= 0) {
        return [items];
    }
    const pages: T[][] = [];
    for (let i = 0; i < items.length; i += perPage) {
        pages.push(items.slice(i, i + perPage));
    }
    return pages;
}

export function buildPrintPagesMarkup(pages: QrSheetItem[][]): string {
    return pages.map((p) => `<div class="print-page">${buildPrintPageInnerHtml(p)}</div>`).join('');
}

export function buildPrintDocumentHtml(pages: QrSheetItem[][], s: QrSheetSettings): string {
    const css = buildEmbeddedSheetCss(s);
    const bodies = buildPrintPagesMarkup(pages);
    return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <title>QR-коды для печати</title>
  <style>
    @page { size: A4; margin: 0; }
    html, body { margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; }
    ${css}
  </style>
</head>
<body>
  <div class="sheet-root">${bodies}</div>
</body>
</html>`;
}
