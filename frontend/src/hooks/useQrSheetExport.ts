import { useCallback, useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import type { QrPrintTarget } from '../types/qrPrintTarget';
import type { QrSheetSettings } from '../types/qrSheetSettings';
import { PAGE_H_MM, PAGE_W_MM } from '../utils/qrSheetLayout';
import { buildPdfFilename } from '../utils/qrSheetStorage';
import {
    buildEmbeddedSheetCss,
    buildPrintDocumentHtml,
    buildPrintPagesMarkup,
    chunkItems,
    qrRasterPxFromMm,
    type QrSheetItem,
} from '../utils/qrSheetHtml';
import { resolveScanShortLinkCaption } from '../utils/qrPayload';
import { generateRepairQrPngDataUrl } from '../utils/repairQrImage';

async function generateQrDataUrls(
    items: QrPrintTarget[],
    settings: QrSheetSettings,
    logoDataUrl: string | null,
): Promise<QrSheetItem[]> {
    const px = qrRasterPxFromMm(settings.qrSizeMm);
    const scanShortCaption = settings.showScanShortLink ? await resolveScanShortLinkCaption() : undefined;
    const results: QrSheetItem[] = [];
    for (const item of items) {
        const dataUrl = await generateRepairQrPngDataUrl(item.directUrl, px, {
            logoDataUrl,
            logoSizePercent: settings.logoSizePercent,
        });
        results.push({ dataUrl, label: item.label, linkCaption: scanShortCaption });
    }
    return results;
}

export function useQrSheetExport(items: QrPrintTarget[], settings: QrSheetSettings, slots: number, logoDataUrl: string | null) {
    const [busy, setBusy] = useState(false);

    const runPrint = useCallback(async () => {
        if (items.length === 0) {
            return;
        }
        setBusy(true);
        try {
            const qrs = await generateQrDataUrls(items, settings, logoDataUrl);
            const ps = slots > 0 ? slots : Math.max(1, items.length);
            const pages = chunkItems(qrs, ps);
            const w = window.open('', '_blank');
            if (!w) {
                return;
            }
            w.document.open();
            w.document.write(buildPrintDocumentHtml(pages, settings));
            w.document.close();
            window.setTimeout(() => {
                w.focus();
                w.print();
                w.close();
            }, 300);
        } finally {
            setBusy(false);
        }
    }, [items, settings, slots, logoDataUrl]);

    const runPdf = useCallback(async () => {
        if (items.length === 0) {
            return;
        }
        setBusy(true);
        let container: HTMLDivElement | null = null;
        try {
            const qrs = await generateQrDataUrls(items, settings, logoDataUrl);
            const ps = slots > 0 ? slots : Math.max(1, items.length);
            const pages = chunkItems(qrs, ps);
            const css = buildEmbeddedSheetCss(settings);
            const markup = buildPrintPagesMarkup(pages);
            container = document.createElement('div');
            container.style.position = 'absolute';
            container.style.left = '-9999px';
            container.style.top = '0';
            container.style.width = '210mm';
            const styleEl = document.createElement('style');
            styleEl.textContent = css;
            const root = document.createElement('div');
            root.className = 'sheet-root';
            root.innerHTML = markup;
            container.appendChild(styleEl);
            container.appendChild(root);
            document.body.appendChild(container);

            const canvas = await html2canvas(root, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                scrollY: -window.scrollY,
            } as Parameters<typeof html2canvas>[1]);

            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidthMm = PAGE_W_MM;
            const pageHeightMm = PAGE_H_MM;
            const pxPerMm = canvas.width / pageWidthMm;
            const pageHeightPx = Math.floor(pageHeightMm * pxPerMm);
            const pageCount = Math.ceil(canvas.height / pageHeightPx);

            for (let page = 0; page < pageCount; page++) {
                const y = page * pageHeightPx;
                const pageCanvas = document.createElement('canvas');
                pageCanvas.width = canvas.width;
                pageCanvas.height = Math.min(pageHeightPx, canvas.height - y);
                const context = pageCanvas.getContext('2d');
                if (context) {
                    context.fillStyle = '#ffffff';
                    context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
                    context.drawImage(
                        canvas,
                        0,
                        y,
                        canvas.width,
                        pageCanvas.height,
                        0,
                        0,
                        pageCanvas.width,
                        pageCanvas.height,
                    );
                }
                const pageDataUrl = pageCanvas.toDataURL('image/png');
                if (page > 0) {
                    pdf.addPage();
                }
                pdf.addImage(
                    pageDataUrl,
                    'PNG',
                    0,
                    0,
                    pageWidthMm,
                    Math.min(pageHeightMm, pageCanvas.height / pxPerMm),
                );
            }

            pdf.save(buildPdfFilename(settings.pdfNameSuffix));
        } finally {
            if (container?.parentNode) {
                container.parentNode.removeChild(container);
            }
            setBusy(false);
        }
    }, [items, settings, slots, logoDataUrl]);

    return { busy, runPrint, runPdf };
}
