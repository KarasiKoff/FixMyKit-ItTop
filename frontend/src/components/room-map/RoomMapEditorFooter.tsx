import React from 'react';
import type { MapDoorEdge } from '../../types/roomMap';

type RoomMapEditorFooterProps = {
    gridCols: number;
    gridRows: number;
    doorEdge: MapDoorEdge;
    saving: boolean;
    onGridColsChange: (value: number) => void;
    onGridRowsChange: (value: number) => void;
    onToggleDoorEdge: () => void;
    onReset: () => void;
    onSave: () => void;
};

export function RoomMapEditorFooter({
    gridCols,
    gridRows,
    doorEdge,
    saving,
    onGridColsChange,
    onGridRowsChange,
    onToggleDoorEdge,
    onReset,
    onSave,
}: RoomMapEditorFooterProps) {
    function clampGridDim(raw: string): number {
        const n = Number.parseInt(raw, 10);
        if (Number.isNaN(n)) return 1;
        return Math.min(10, Math.max(1, n));
    }

    return (
        <div className="map-editor-footer-row">
            <div className="map-editor-footer__grid-controls">
                <label className="map-grid-field">
                    <span className="map-grid-field__label">Столбцы</span>
                    <input
                        type="number"
                        className="map-grid-field__input"
                        min={1}
                        max={10}
                        value={gridCols}
                        onChange={(ev) => onGridColsChange(clampGridDim(ev.target.value))}
                    />
                </label>
                <label className="map-grid-field">
                    <span className="map-grid-field__label">Ряды</span>
                    <input
                        type="number"
                        className="map-grid-field__input"
                        min={1}
                        max={10}
                        value={gridRows}
                        onChange={(ev) => onGridRowsChange(clampGridDim(ev.target.value))}
                    />
                </label>
                <button
                    type="button"
                    className="btn-ghost btn-compact map-door-toggle"
                    onClick={onToggleDoorEdge}
                    disabled={saving}
                    title={
                        doorEdge === 'bottom'
                            ? 'Вход снизу — нажмите, чтобы перенести наверх'
                            : 'Вход сверху — нажмите, чтобы перенести вниз'
                    }
                >
                    Вход ↑↓
                </button>
            </div>
            <div className="map-editor-footer__actions">
                <button type="button" className="btn-ghost btn-compact" onClick={onReset} disabled={saving}>
                    Сбросить
                </button>
                <button type="button" className="btn-primary btn-compact" onClick={onSave} disabled={saving}>
                    {saving ? 'Сохранение…' : 'Сохранить карту'}
                </button>
            </div>
        </div>
    );
}
