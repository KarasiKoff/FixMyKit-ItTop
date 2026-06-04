import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { QrPrintTarget } from '../types/qrPrintTarget';
import type { QrSheetSettings } from '../types/qrSheetSettings';
import { QR_SHEET_DEFAULTS } from '../types/qrSheetSettings';
import {
    collectQrSheetWarnings,
    computeColsPerRow,
    computeRowsPerPage,
    estimatePageCount,
    slotsPerPage,
} from '../utils/qrSheetLayout';
import { loadQrSheetSettings, saveQrSheetSettings } from '../utils/qrSheetStorage';
import { useQrSheetExport } from '../hooks/useQrSheetExport';
import type { QrSheetLastValidNumeric, QrSheetNumericFieldKey } from './qr-sheet/QrSheetNumericSlider';
import { QrSheetPreviewPanel } from './qr-sheet/QrSheetPreviewPanel';
import { QrSheetSettingsControls } from './qr-sheet/QrSheetSettingsControls';

export type QrSheetVariant = 'device' | 'audience';

const QR_SHEET_VARIANT_META: Record<
    QrSheetVariant,
    { countNoun: string; labelFontSlider: string; modalTitle: string }
> = {
    device: {
        countNoun: 'Устройств',
        labelFontSlider: 'Шрифт подписи (инв. номер)',
        modalTitle: 'QR для оборудования',
    },
    audience: {
        countNoun: 'Кабинетов',
        labelFontSlider: 'Шрифт подписи (кабинет)',
        modalTitle: 'QR для кабинетов',
    },
};

type QrSheetSettingsModalProps = {
    open: boolean;
    onClose: () => void;
    items: QrPrintTarget[];
    variant?: QrSheetVariant;
};

export function QrSheetSettingsModal({ open, onClose, items, variant = 'device' }: QrSheetSettingsModalProps) {
    const meta = QR_SHEET_VARIANT_META[variant];
    const [settings, setSettings] = useState<QrSheetSettings>(QR_SHEET_DEFAULTS);
    const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
    const [logoName, setLogoName] = useState<string | null>(null);

    const lastValidRef = useRef<QrSheetLastValidNumeric>({
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
    const pagesEst = slots > 0 ? estimatePageCount(items.length, cols, rows) : null;

    const firstPageItems = useMemo(() => {
        const colsCss = Math.max(1, cols);
        const rowsCss = Math.max(1, rows);
        const gridSlots = colsCss * rowsCss;
        return items.slice(0, Math.min(gridSlots, items.length));
    }, [items, cols, rows]);

    const warnings = useMemo(
        () => collectQrSheetWarnings(settings, cols, rows, items.length),
        [settings, cols, rows, items.length],
    );

    const patch = useCallback((p: Partial<QrSheetSettings>) => {
        setSettings((prev) => ({ ...prev, ...p }));
    }, []);

    const commitNumeric = useCallback((key: QrSheetNumericFieldKey, n: number) => {
        setSettings((prev) => ({ ...prev, [key]: n }));
    }, []);

    const { busy, runPrint, runPdf } = useQrSheetExport(items, settings, slots, logoDataUrl);

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
                    <h3 id="qr-sheet-modal-title">{meta.modalTitle}</h3>
                    <button type="button" className="modal-panel__close" onClick={onClose} aria-label="Закрыть">
                        ×
                    </button>
                </div>
                <p className="qr-sheet-modal__sub">
                    {meta.countNoun} в печати: <strong>{items.length}</strong>
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
                    <QrSheetSettingsControls
                        settings={settings}
                        labelFontSliderLabel={meta.labelFontSlider}
                        warnings={warnings}
                        busy={busy}
                        itemsCount={items.length}
                        lastValidRef={lastValidRef}
                        logoDataUrl={logoDataUrl}
                        logoName={logoName}
                        onPatch={patch}
                        onCommitNumeric={commitNumeric}
                        onLogoChange={(dataUrl, name) => {
                            setLogoDataUrl(dataUrl);
                            setLogoName(name);
                        }}
                        onPrint={() => void runPrint()}
                        onPdf={() => void runPdf()}
                        onClose={onClose}
                    />

                    <div className="qr-sheet-modal__preview-col">
                        <div className="qr-sheet-preview__frame">
                            <QrSheetPreviewPanel
                                settings={settings}
                                nCols={cols}
                                nRows={rows}
                                firstPageItems={firstPageItems}
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
