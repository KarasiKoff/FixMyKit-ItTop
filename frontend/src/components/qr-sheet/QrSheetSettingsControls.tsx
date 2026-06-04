import React, { useCallback, useRef, useState } from 'react';
import { useToast } from '../../hooks/useToast';
import type { QrSheetSettings } from '../../types/qrSheetSettings';
import { QR_SHEET_SLIDER_BOUNDS } from '../../types/qrSheetSettings';
import { buildPdfFilename } from '../../utils/qrSheetStorage';
import {
    MAX_QR_LOGO_FILE_BYTES,
    readLogoFileAsDataUrl,
    validateLogoImageFile,
} from '../../utils/repairQrImage';
import { QrSheetNumericSlider, type QrSheetLastValidNumeric, type QrSheetNumericFieldKey } from './QrSheetNumericSlider';

type QrSheetSettingsControlsProps = {
    settings: QrSheetSettings;
    labelFontSliderLabel: string;
    warnings: string[];
    busy: boolean;
    itemsCount: number;
    lastValidRef: React.MutableRefObject<QrSheetLastValidNumeric>;
    logoDataUrl: string | null;
    logoName: string | null;
    onPatch: (p: Partial<QrSheetSettings>) => void;
    onCommitNumeric: (key: QrSheetNumericFieldKey, n: number) => void;
    onLogoChange: (dataUrl: string | null, name: string | null) => void;
    onPrint: () => void;
    onPdf: () => void;
    onClose: () => void;
};

export function QrSheetSettingsControls({
    settings,
    labelFontSliderLabel,
    warnings,
    busy,
    itemsCount,
    lastValidRef,
    logoDataUrl,
    logoName,
    onPatch,
    onCommitNumeric,
    onLogoChange,
    onPrint,
    onPdf,
    onClose,
}: QrSheetSettingsControlsProps) {
    const { showError } = useToast();
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const applyLogoFile = useCallback(
        async (file: File) => {
            const v = validateLogoImageFile(file);
            if (v === 'type') {
                showError('Допустимы PNG, JPEG и SVG.');
                return;
            }
            if (v === 'size') {
                showError(`Файл больше ${MAX_QR_LOGO_FILE_BYTES / (1024 * 1024)} МБ.`);
                return;
            }
            try {
                const dataUrl = await readLogoFileAsDataUrl(file);
                onLogoChange(dataUrl, file.name);
            } catch {
                showError('Не удалось прочитать файл.');
            }
        },
        [onLogoChange, showError],
    );

    return (
        <div className="qr-sheet-modal__controls">
            <QrSheetNumericSlider
                label="Размер QR"
                unit="мм"
                sliderMin={QR_SHEET_SLIDER_BOUNDS.qrSizeMm.min}
                sliderMax={QR_SHEET_SLIDER_BOUNDS.qrSizeMm.max}
                step={1}
                fieldKey="qrSizeMm"
                value={settings.qrSizeMm}
                onCommit={(n) => onCommitNumeric('qrSizeMm', n)}
                lastValidRef={lastValidRef}
            />
            <QrSheetNumericSlider
                label="Внутренний отступ ячейки"
                unit="мм"
                sliderMin={QR_SHEET_SLIDER_BOUNDS.cellPaddingMm.min}
                sliderMax={QR_SHEET_SLIDER_BOUNDS.cellPaddingMm.max}
                step={0.5}
                fieldKey="cellPaddingMm"
                value={settings.cellPaddingMm}
                onCommit={(n) => onCommitNumeric('cellPaddingMm', n)}
                lastValidRef={lastValidRef}
            />
            <QrSheetNumericSlider
                label={labelFontSliderLabel}
                unit="pt"
                sliderMin={QR_SHEET_SLIDER_BOUNDS.labelFontPt.min}
                sliderMax={QR_SHEET_SLIDER_BOUNDS.labelFontPt.max}
                step={0.5}
                fieldKey="labelFontPt"
                value={settings.labelFontPt}
                onCommit={(n) => onCommitNumeric('labelFontPt', n)}
                lastValidRef={lastValidRef}
            />
            <QrSheetNumericSlider
                label="Отступ подписи от QR"
                unit="мм"
                sliderMin={QR_SHEET_SLIDER_BOUNDS.labelGapMm.min}
                sliderMax={QR_SHEET_SLIDER_BOUNDS.labelGapMm.max}
                step={0.5}
                fieldKey="labelGapMm"
                value={settings.labelGapMm}
                onCommit={(n) => onCommitNumeric('labelGapMm', n)}
                lastValidRef={lastValidRef}
            />

            <label className="qr-sheet-check">
                <input
                    type="checkbox"
                    checked={settings.labelBold}
                    onChange={(e) => onPatch({ labelBold: e.target.checked })}
                />
                Жирный шрифт подписи
            </label>

            <label className="qr-sheet-check">
                <input
                    type="checkbox"
                    checked={settings.showScanShortLink}
                    onChange={(e) => onPatch({ showScanShortLink: e.target.checked })}
                />
                Под QR — короткая ссылка на общую страницу /scan (clck.ru)
            </label>

            <div className="qr-sheet-field">
                <span className="qr-sheet-field__label">Логотип в центре QR (PNG, JPEG, SVG, до 16 МБ)</span>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,.png,.jpg,.jpeg,.svg"
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
                    <button
                        type="button"
                        className="modal-panel__btn-ghost qr-sheet-logo-clear"
                        onClick={() => onLogoChange(null, null)}
                    >
                        Убрать логотип
                    </button>
                ) : null}
            </div>

            <QrSheetNumericSlider
                label="Размер логотипа в QR"
                unit="% ширины QR"
                sliderMin={QR_SHEET_SLIDER_BOUNDS.logoSizePercent.min}
                sliderMax={QR_SHEET_SLIDER_BOUNDS.logoSizePercent.max}
                step={1}
                fieldKey="logoSizePercent"
                value={settings.logoSizePercent}
                onCommit={(n) => onCommitNumeric('logoSizePercent', n)}
                lastValidRef={lastValidRef}
            />

            <label className="qr-sheet-check">
                <input
                    type="checkbox"
                    checked={settings.dashedGuides}
                    onChange={(e) => onPatch({ dashedGuides: e.target.checked })}
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
                    onChange={(e) => onPatch({ pdfNameSuffix: e.target.value })}
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
                <button type="button" className="btn-compact" disabled={busy || itemsCount === 0} onClick={onPrint}>
                    Печать
                </button>
                <button type="button" className="btn-compact" disabled={busy || itemsCount === 0} onClick={onPdf}>
                    Сохранить в PDF
                </button>
                <button type="button" className="modal-panel__btn-ghost btn-compact" disabled={busy} onClick={onClose}>
                    Закрыть
                </button>
            </div>
        </div>
    );
}
