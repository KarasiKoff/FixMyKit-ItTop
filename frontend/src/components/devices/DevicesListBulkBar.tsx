import React from 'react';

type DevicesListBulkBarProps = {
    count: number;
    deleting: boolean;
    onOpenQrSheet: () => void;
    onDeleteSelected: () => void;
};

export function DevicesListBulkBar({ count, deleting, onOpenQrSheet, onDeleteSelected }: DevicesListBulkBarProps) {
    if (count <= 0) {
        return null;
    }

    return (
        <section className="card">
            <h3>Действия с выбранными ({count})</h3>
            <div className="actions-row">
                <button type="button" className="btn-compact" onClick={onOpenQrSheet}>
                    Настройка и предпросмотр
                </button>
                <button type="button" className="btn-danger btn-compact" disabled={deleting} onClick={onDeleteSelected}>
                    Удалить выбранные
                </button>
            </div>
        </section>
    );
}
