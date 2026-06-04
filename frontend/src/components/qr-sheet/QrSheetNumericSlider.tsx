import React, { useState } from 'react';
import type { QrSheetSettings } from '../../types/qrSheetSettings';

export type QrSheetNumericFieldKey = 'qrSizeMm' | 'cellPaddingMm' | 'labelFontPt' | 'labelGapMm' | 'logoSizePercent';

export type QrSheetLastValidNumeric = Record<QrSheetNumericFieldKey, number>;

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

type QrSheetNumericSliderProps = {
    label: string;
    unit: string;
    sliderMin: number;
    sliderMax: number;
    step: number;
    fieldKey: QrSheetNumericFieldKey;
    value: number;
    onCommit: (n: number) => void;
    lastValidRef: React.MutableRefObject<QrSheetLastValidNumeric>;
};

export function QrSheetNumericSlider({
    label,
    unit,
    sliderMin,
    sliderMax,
    step,
    fieldKey,
    value,
    onCommit,
    lastValidRef,
}: QrSheetNumericSliderProps) {
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
