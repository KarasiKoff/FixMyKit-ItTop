import React, { useLayoutEffect, useRef, useState } from 'react';
import type { QrPrintTarget } from '../../types/qrPrintTarget';
import type { QrSheetSettings } from '../../types/qrSheetSettings';
import { PAGE_H_MM, PAGE_W_MM, outerCellHeightMm, outerCellWidthMm } from '../../utils/qrSheetLayout';

type QrSheetPreviewPanelProps = {
    settings: QrSheetSettings;
    nCols: number;
    nRows: number;
    firstPageItems: QrPrintTarget[];
    logoDataUrl: string | null;
};

export function QrSheetPreviewPanel({ settings, nCols, nRows, firstPageItems, logoDataUrl }: QrSheetPreviewPanelProps) {
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
        firstPageItems.length,
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
                    const item = firstPageItems[i];
                    const filled = Boolean(item);
                    const inv = item?.label ?? '';
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
