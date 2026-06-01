import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../context/ToastContext';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import type { Device } from '../types/device';
import type { QrSheetSettings } from '../types/qrSheetSettings';
import { QR_SHEET_DEFAULTS, QR_SHEET_SLIDER_BOUNDS } from '../types/qrSheetSettings';
import {
    PAGE_H_MM,
    PAGE_W_MM,
    collectQrSheetWarnings,
    computeColsPerRow,
    computeRowsPerPage,
    estimatePageCount,
    outerCellHeightMm,
    outerCellWidthMm,
    slotsPerPage,
} from '../utils/qrSheetLayout';
import { buildPdfFilename, loadQrSheetSettings, saveQrSheetSettings } from '../utils/qrSheetStorage';
import { buildEmbeddedSheetCss, buildPrintDocumentHtml, buildPrintPagesMarkup, chunkItems, qrRasterPxFromMm, type QrSheetItem } from '../utils/qrSheetHtml';
import { buildRepairRequestUrl } from '../utils/qrGenerator';
import {
    MAX_QR_LOGO_FILE_BYTES,
    generateRepairQrPngDataUrl,
    readFileAsDataUrl,
    validateLogoImageFile,
} from '../utils/repairQrImage';

type QrSheetSettingsModalProps = {
    open: boolean;
    onClose: () => void;
    devices: Device[];
};

type NumericFieldKey = 'qrSizeMm' | 'cellPaddingMm' | 'labelFontPt' | 'labelGapMm' | 'logoSizePercent';

type LastValidNumeric = Record<NumericFieldKey, number>;

function formatDecimal(n: number): string {
    if (!Number.isFinite(n)) {
        return '0';
    }
    if (Number.isInteger(n)) {
        return String(n);
    }
    return String(n);
}

function normalizeDecimalInput(raw: string): string {
    const cleaned = raw.replace(/[^\d.]/g, '');
    const dot = cleaned.indexOf('.');
    if (dot === -1) {
        return cleaned;
    }
    return `${cleaned.slice(0, dot + 1)}${cleaned.slice(dot + 1).replace(/\./g, '')}`;
}

function NumericSliderRow({
    label,
    unit,
    sliderMin,
    sliderMax,
    step,
    fieldKey,
    value,
    onCommit,
    lastValidRef,
}: {
    label: string;
    unit: string;
    sliderMin: number;
    sliderMax: number;
    step: number;
    fieldKey: NumericFieldKey;
    value: number;
    onCommit: (n: number) => void;
    lastValidRef: React.MutableRefObject<LastValidNumeric>;
}) {
    const [draft, setDraft] = useState<string | null>(null);
    const shownSlider = Math.min(Math.max(value, sliderMin), sliderMax);
    const display = draft !== null ? draft : formatDecimal(value);

    const applyBlur = () => {
        const raw = (draft ?? '').trim();
        if (raw === '') {
            onCommit(lastValidRef.current[fieldKey]);
            setDraft(null);
            return;
        }
        const n = parseFloat(raw);
        if (!Number.isFinite(n)) {
            onCommit(lastValidRef.current[fieldKey]);
        } else {
            lastValidRef.current[fieldKey] = n;
            onCommit(n);
        }
        setDraft(null);
    };

    return (
        <div className="qr-sheet-field">
            <div className="qr-sheet-field__label-row">
                <span className="qr-sheet-field__label">
                    {label} <span className="qr-sheet-field__unit">({unit})</span>
                </span>
                <input
                    type="text"
                    inputMode="decimal"
                    className="qr-sheet-field__num"
                    autoComplete="off"
                    spellCheck={false}
                    value={display}
                    onChange={(e) => setDraft(normalizeDecimalInput(e.target.value))}
                    onBlur={applyBlur}
                />
            </div>
            <input
                type="range"
                className="qr-sheet-field__range"
                min={sliderMin}
                max={sliderMax}
                step={step}
                value={shownSlider}
                onChange={(ev) => {
                    const n = Number(ev.target.value);
                    lastValidRef.current[fieldKey] = n;
                    onCommit(n);
                    setDraft(null);
                }}
            />
        </div>
    );
}

function QrSheetPreview({
    settings,
    nCols,
    nRows,
    firstPageDevices,
    logoDataUrl,
}: {
    settings: QrSheetSettings;
    nCols: number;
    nRows: number;
    firstPageDevices: Device[];
    logoDataUrl: string | null;
}) {
    const wrapRef = useRef<HTMLDivElement>(null);
    const [box, setBox] = useState({ pw: 280, ph: (280 * PAGE_H_MM) / PAGE_W_MM });

    useLayoutEffect(() => {
        const el = wrapRef.current;
        if (!el) {
            return;
        }
        const measure = () => {
            const cw = el.clientWidth;
            const ch = el.clientHeight;
            if (cw < 40 || ch < 40) {
                return;
            }
            const ratio = PAGE_H_MM / PAGE_W_MM;
            let pw = cw;
            let ph = pw * ratio;
            if (ph > ch) {
                ph = ch;
                pw = ph / ratio;
            }
            setBox({ pw, ph });
        };
        measure();
        const ro = new ResizeObserver(() => measure());
        ro.observe(el);
        return () => ro.disconnect();
    }, [
        settings.qrSizeMm,
        settings.cellPaddingMm,
        settings.labelFontPt,
        settings.labelGapMm,
        settings.labelBold,
        settings.logoSizePercent,
        firstPageDevices.length,
        logoDataUrl,
    ]);

    const sf = box.pw / PAGE_W_MM;
    const colsCss = Math.max(1, nCols);
    const slots = colsCss * Math.max(1, nRows);
    const cellWpx = outerCellWidthMm(settings.qrSizeMm, settings.cellPaddingMm) * sf;
    const cellHpx = outerCellHeightMm(settings) * sf;
    const padPx = settings.cellPaddingMm * sf;
    const qrPx = settings.qrSizeMm * sf;
    const labelGapPx = settings.labelGapMm * sf;
    const fontPx = settings.labelFontPt * (96 / 72) * 0.85;
    const logoBox = (settings.logoSizePercent / 100) * qrPx;

    const borderPage = settings.dashedGuides ? '1px dashed #444' : 'none';
    const borderCell = settings.dashedGuides ? '1px dashed #aaa' : 'none';

    return (
        <div ref={wrapRef} className="qr-sheet-preview-wrap-inner">
            <div
                className="qr-sheet-preview"
                style={{
                    width: box.pw,
                    height: box.ph,
                    background: '#fff',
                    color: '#111',
                    boxSizing: 'border-box',
                    border: borderPage,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 0,
                    justifyContent: 'flex-start',
                    alignContent: 'flex-start',
                    overflow: 'hidden',
                }}
            >
                {Array.from({ length: slots }).map((_, i) => {
                    const dev = firstPageDevices[i];
                    const filled = Boolean(dev);
                    const inv = dev?.inventoryNumber ?? '';
                    return (
                        <div
                            key={i}
                            style={{
                                width: cellWpx,
                                minHeight: cellHpx,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'flex-start',
                                borderRight: borderCell,
                                borderBottom: borderCell,
                                boxSizing: 'border-box',
                                padding: padPx,
                            }}
                        >
                            <div
                                style={{
                                    position: 'relative',
                                    width: qrPx,
                                    height: qrPx,
                                    background: filled ? '#111' : '#e5e5e5',
                                    flexShrink: 0,
                                }}
                            >
                                {logoDataUrl && filled ? (
                                    <img
                                        src={logoDataUrl}
                                        alt=""
                                        style={{
                                            position: 'absolute',
                                            left: '50%',
                                            top: '50%',
                                            transform: 'translate(-50%, -50%)',
                                            width: logoBox,
                                            height: logoBox,
                                            objectFit: 'contain',
                                            pointerEvents: 'none',
                                        }}
                                    />
                                ) : null}
                            </div>
                            <div
                                style={{
                                    marginTop: labelGapPx,
                                    fontSize: fontPx,
                                    fontWeight: settings.labelBold ? 700 : 400,
                                    lineHeight: 1.2,
                                    textAlign: 'center',
                                    maxWidth: qrPx,
                                    wordBreak: 'break-word',
                                }}
                            >
                                {inv}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

async function generateQrDataUrls(
    devices: Device[],
    settings: QrSheetSettings,
    logoDataUrl: string | null,
): Promise<QrSheetItem[]> {
    const px = qrRasterPxFromMm(settings.qrSizeMm);
    const results: QrSheetItem[] = [];
    for (const device of devices) {
        const url = buildRepairRequestUrl(device.id, device.inventoryNumber);
        const dataUrl = await generateRepairQrPngDataUrl(url, px, {
            logoDataUrl,
            logoSizePercent: settings.logoSizePercent,
        });
        results.push({ dataUrl, inventoryNumber: device.inventoryNumber });
    }
    return results;
}

export function QrSheetSettingsModal({ open, onClose, devices }: QrSheetSettingsModalProps) {
    const { showError } = useToast();
    const [settings, setSettings] = useState<QrSheetSettings>(QR_SHEET_DEFAULTS);
    const [busy, setBusy] = useState(false);
    const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
    const [logoName, setLogoName] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const lastValidRef = useRef<LastValidNumeric>({
        qrSizeMm: QR_SHEET_DEFAULTS.qrSizeMm,
        cellPaddingMm: QR_SHEET_DEFAULTS.cellPaddingMm,
        labelFontPt: QR_SHEET_DEFAULTS.labelFontPt,
        labelGapMm: QR_SHEET_DEFAULTS.labelGapMm,
        logoSizePercent: QR_SHEET_DEFAULTS.logoSizePercent,
    });

    useEffect(() => {
        if (open) {
            setLogoDataUrl(null);
            setLogoName(null);
            const loaded = loadQrSheetSettings();
            setSettings(loaded);
            lastValidRef.current = {
                qrSizeMm: loaded.qrSizeMm,
                cellPaddingMm: loaded.cellPaddingMm,
                labelFontPt: loaded.labelFontPt,
                labelGapMm: loaded.labelGapMm,
                logoSizePercent: loaded.logoSizePercent,
            };
        }
    }, [open]);

    useEffect(() => {
        if (!open) {
            return;
        }
        const id = window.setTimeout(() => saveQrSheetSettings(settings), 300);
        return () => window.clearTimeout(id);
    }, [settings, open]);

    useEffect(() => {
        if (!open) {
            return;
        }
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    const cols = computeColsPerRow(settings.qrSizeMm, settings.cellPaddingMm);
    const rows = computeRowsPerPage(settings);
    const slots = slotsPerPage(cols, rows);
    const pagesEst = slots > 0 ? estimatePageCount(devices.length, cols, rows) : null;

    const pageSlots = slots > 0 ? slots : Math.max(1, devices.length);

    const firstPageDevices = useMemo(() => {
        const colsCss = Math.max(1, cols);
        const rowsCss = Math.max(1, rows);
        const gridSlots = colsCss * rowsCss;
        return devices.slice(0, Math.min(gridSlots, devices.length));
    }, [devices, cols, rows]);

    const warnings = useMemo(
        () => collectQrSheetWarnings(settings, cols, rows, devices.length),
        [settings, cols, rows, devices.length],
    );

    const patch = useCallback((p: Partial<QrSheetSettings>) => {
        setSettings((prev) => ({ ...prev, ...p }));
    }, []);

    const commitNumeric = useCallback((key: NumericFieldKey, n: number) => {
        setSettings((prev) => ({ ...prev, [key]: n }));
    }, []);

    const applyLogoFile = useCallback(
        async (file: File) => {
            const v = validateLogoImageFile(file);
            if (v === 'type') {
                showError('Допустимы только PNG и JPEG.');
                return;
            }
            if (v === 'size') {
                showError(`Файл больше ${MAX_QR_LOGO_FILE_BYTES / (1024 * 1024)} МБ.`);
                return;
            }
            try {
                const dataUrl = await readFileAsDataUrl(file);
                setLogoDataUrl(dataUrl);
                setLogoName(file.name);
            } catch {
                showError('Не удалось прочитать файл.');
            }
        },
        [showError],
    );

    const runPrint = useCallback(async () => {
        if (devices.length === 0) {
            return;
        }
        setBusy(true);
        try {
            const qrs = await generateQrDataUrls(devices, settings, logoDataUrl);
            const ps = slots > 0 ? slots : Math.max(1, devices.length);
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
    }, [devices, settings, slots, logoDataUrl]);

    const runPdf = useCallback(async () => {
        if (devices.length === 0) {
            return;
        }
        setBusy(true);
        let container: HTMLDivElement | null = null;
        try {
            const qrs = await generateQrDataUrls(devices, settings, logoDataUrl);
            const ps = slots > 0 ? slots : Math.max(1, devices.length);
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
                    context.drawImage(canvas, 0, y, canvas.width, pageCanvas.height, 0, 0, pageCanvas.width, pageCanvas.height);
                }
                const pageDataUrl = pageCanvas.toDataURL('image/png');
                if (page > 0) {
                    pdf.addPage();
                }
                pdf.addImage(pageDataUrl, 'PNG', 0, 0, pageWidthMm, Math.min(pageHeightMm, pageCanvas.height / pxPerMm));
            }

            pdf.save(buildPdfFilename(settings.pdfNameSuffix));
        } finally {
            if (container?.parentNode) {
                container.parentNode.removeChild(container);
            }
            setBusy(false);
        }
    }, [devices, settings, slots, logoDataUrl]);

    if (!open) {
        return null;
    }

    return (
        <div className="modal-backdrop" role="presentation" onClick={onClose}>
            <div
                className="modal-panel modal-panel--wide qr-sheet-modal card"
                role="dialog"
                aria-modal="true"
                aria-labelledby="qr-sheet-modal-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="qr-sheet-modal__head">
                    <h3 id="qr-sheet-modal-title">Настройка и предпросмотр</h3>
                    <button type="button" className="modal-panel__close" onClick={onClose} aria-label="Закрыть">
                        ×
                    </button>
                </div>
                <p className="qr-sheet-modal__sub">
                    Устройств в печати: <strong>{devices.length}</strong>
                    {pagesEst !== null && slots > 0 && (
                        <>
                            {' '}
                            · ориентировочно листов A4: <strong>≈ {pagesEst}</strong>
                        </>
                    )}
                    {slots <= 0 && (
                        <>
                            {' '}
                            · листов A4: <strong>—</strong> (проверьте размеры)
                        </>
                    )}
                </p>

                <div className="qr-sheet-modal__body">
                    <div className="qr-sheet-modal__controls">
                        <NumericSliderRow
                            label="Размер QR"
                            unit="мм"
                            sliderMin={QR_SHEET_SLIDER_BOUNDS.qrSizeMm.min}
                            sliderMax={QR_SHEET_SLIDER_BOUNDS.qrSizeMm.max}
                            step={1}
                            fieldKey="qrSizeMm"
                            value={settings.qrSizeMm}
                            onCommit={(n) => commitNumeric('qrSizeMm', n)}
                            lastValidRef={lastValidRef}
                        />
                        <NumericSliderRow
                            label="Внутренний отступ ячейки"
                            unit="мм"
                            sliderMin={QR_SHEET_SLIDER_BOUNDS.cellPaddingMm.min}
                            sliderMax={QR_SHEET_SLIDER_BOUNDS.cellPaddingMm.max}
                            step={0.5}
                            fieldKey="cellPaddingMm"
                            value={settings.cellPaddingMm}
                            onCommit={(n) => commitNumeric('cellPaddingMm', n)}
                            lastValidRef={lastValidRef}
                        />
                        <NumericSliderRow
                            label="Шрифт подписи (инв. номер)"
                            unit="pt"
                            sliderMin={QR_SHEET_SLIDER_BOUNDS.labelFontPt.min}
                            sliderMax={QR_SHEET_SLIDER_BOUNDS.labelFontPt.max}
                            step={0.5}
                            fieldKey="labelFontPt"
                            value={settings.labelFontPt}
                            onCommit={(n) => commitNumeric('labelFontPt', n)}
                            lastValidRef={lastValidRef}
                        />
                        <NumericSliderRow
                            label="Отступ подписи от QR"
                            unit="мм"
                            sliderMin={QR_SHEET_SLIDER_BOUNDS.labelGapMm.min}
                            sliderMax={QR_SHEET_SLIDER_BOUNDS.labelGapMm.max}
                            step={0.5}
                            fieldKey="labelGapMm"
                            value={settings.labelGapMm}
                            onCommit={(n) => commitNumeric('labelGapMm', n)}
                            lastValidRef={lastValidRef}
                        />

                        <label className="qr-sheet-check">
                            <input
                                type="checkbox"
                                checked={settings.labelBold}
                                onChange={(e) => patch({ labelBold: e.target.checked })}
                            />
                            Жирный шрифт подписи (инв. номер)
                        </label>

                        <div className="qr-sheet-field">
                            <span className="qr-sheet-field__label">Логотип в центре QR (PNG / JPEG, до 16 МБ)</span>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/png,image/jpeg,.jpg,.jpeg,.png"
                                className="qr-sheet-logo-input"
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    e.target.value = '';
                                    if (f) {
                                        void applyLogoFile(f);
                                    }
                                }}
                            />
                            <div
                                className={`qr-sheet-dropzone${dragOver ? ' qr-sheet-dropzone--active' : ''}`}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        fileInputRef.current?.click();
                                    }
                                }}
                                onClick={() => fileInputRef.current?.click()}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    setDragOver(true);
                                }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setDragOver(false);
                                    const f = e.dataTransfer.files?.[0];
                                    if (f) {
                                        void applyLogoFile(f);
                                    }
                                }}
                            >
                                Перетащите файл сюда или нажмите для выбора
                                {logoName ? (
                                    <span className="qr-sheet-dropzone__file">
                                        <br />
                                        Загружено: {logoName}
                                    </span>
                                ) : null}
                            </div>
                            {logoDataUrl ? (
                                <button type="button" className="modal-panel__btn-ghost qr-sheet-logo-clear" onClick={() => { setLogoDataUrl(null); setLogoName(null); }}>
                                    Убрать логотип
                                </button>
                            ) : null}
                        </div>

                        <NumericSliderRow
                            label="Размер логотипа в QR"
                            unit="% ширины QR"
                            sliderMin={QR_SHEET_SLIDER_BOUNDS.logoSizePercent.min}
                            sliderMax={QR_SHEET_SLIDER_BOUNDS.logoSizePercent.max}
                            step={1}
                            fieldKey="logoSizePercent"
                            value={settings.logoSizePercent}
                            onCommit={(n) => commitNumeric('logoSizePercent', n)}
                            lastValidRef={lastValidRef}
                        />

                        <label className="qr-sheet-check">
                            <input
                                type="checkbox"
                                checked={settings.dashedGuides}
                                onChange={(e) => patch({ dashedGuides: e.target.checked })}
                            />
                            Пунктирные линии для резки
                        </label>

                        <div className="qr-sheet-field">
                            <span className="qr-sheet-field__label">Подпись к имени PDF (необязательно)</span>
                            <input
                                type="text"
                                className="qr-sheet-field__text"
                                placeholder="например, каб-101"
                                value={settings.pdfNameSuffix}
                                onChange={(e) => patch({ pdfNameSuffix: e.target.value })}
                            />
                            <span className="qr-sheet-field__hint">Файл: {buildPdfFilename(settings.pdfNameSuffix)}</span>
                        </div>

                        {warnings.length > 0 && (
                            <ul className="qr-sheet-warnings">
                                {warnings.map((w) => (
                                    <li key={w}>{w}</li>
                                ))}
                            </ul>
                        )}

                        <div className="qr-sheet-modal__actions">
                            <button type="button" disabled={busy || devices.length === 0} onClick={() => void runPrint()}>
                                Печать
                            </button>
                            <button type="button" disabled={busy || devices.length === 0} onClick={() => void runPdf()}>
                                Сохранить в PDF
                            </button>
                            <button type="button" className="modal-panel__btn-ghost" disabled={busy} onClick={onClose}>
                                Закрыть
                            </button>
                        </div>
                    </div>

                    <div className="qr-sheet-modal__preview-col">
                        <div className="qr-sheet-preview__frame">
                            <QrSheetPreview
                                settings={settings}
                                nCols={cols}
                                nRows={rows}
                                firstPageDevices={firstPageDevices}
                                logoDataUrl={logoDataUrl}
                            />
                        </div>
                        <p className="qr-sheet-preview__hint qr-sheet-preview__hint--below">
                            Подписи — как на первом листе; QR в превью упрощены; печать и PDF — с реальными кодами.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
