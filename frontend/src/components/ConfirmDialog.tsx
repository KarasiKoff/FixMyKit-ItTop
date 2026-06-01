import React, { useEffect } from 'react';

export type ConfirmDialogProps = {
    open: boolean;
    title: string;
    message: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    confirmVariant?: 'danger' | 'primary';
    busy?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
};

export function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel = 'Подтвердить',
    cancelLabel = 'Отмена',
    confirmVariant = 'primary',
    busy = false,
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    useEffect(() => {
        if (!open) {
            return;
        }
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !busy) {
                onCancel();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [open, busy, onCancel]);

    if (!open) {
        return null;
    }

    return (
        <div
            className="modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            onClick={() => {
                if (!busy) {
                    onCancel();
                }
            }}
        >
            <div className="modal-panel confirm-dialog card" onClick={(event) => event.stopPropagation()}>
                <div className="modal-panel__head confirm-dialog__head">
                    <h3 id="confirm-dialog-title">{title}</h3>
                </div>
                <div className="confirm-dialog__message">{message}</div>
                <div className="modal-panel__actions confirm-dialog__actions">
                    <button
                        type="button"
                        className="modal-panel__btn-ghost confirm-dialog__cancel"
                        disabled={busy}
                        onClick={onCancel}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        className={
                            confirmVariant === 'danger'
                                ? 'btn-danger confirm-dialog__confirm'
                                : 'btn-primary confirm-dialog__confirm'
                        }
                        disabled={busy}
                        onClick={onConfirm}
                    >
                        {busy ? 'Подождите…' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
