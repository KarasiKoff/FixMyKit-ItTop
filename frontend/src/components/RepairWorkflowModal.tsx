import React, { useEffect, useState } from 'react';
import type { RepairCloseResolution } from '../utils/repairWorkflow';
import { CLOSE_RESOLUTION_OPTIONS } from '../utils/repairWorkflow';

export type RepairWorkflowModalMode = 'needs_info' | 'close';

type Props = {
    open: boolean;
    mode: RepairWorkflowModalMode;
    busy?: boolean;
    onConfirm: (payload: { comment: string; resolution?: RepairCloseResolution }) => void;
    onCancel: () => void;
};

export function RepairWorkflowModal({ open, mode, busy = false, onConfirm, onCancel }: Props) {
    const [comment, setComment] = useState('');
    const [resolution, setResolution] = useState<RepairCloseResolution>('resolved');

    useEffect(() => {
        if (!open) {
            return;
        }
        setComment('');
        setResolution('resolved');
    }, [open, mode]);

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

    const title = mode === 'needs_info' ? 'Требуется информация' : 'Закрыть заявку';
    const hint =
        mode === 'needs_info'
            ? 'Опишите, какие данные вам необходимы. Комментарий появится в задаче Yandex Tracker.'
            : 'Выберите резолюцию и при необходимости добавьте комментарий.';

    const commentTrimmed = comment.trim();
    const canSubmit = mode === 'needs_info' ? commentTrimmed.length > 0 : Boolean(resolution);

    return (
        <div
            className="modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="workflow-modal-title"
            onClick={() => {
                if (!busy) {
                    onCancel();
                }
            }}
        >
            <div className="modal-panel workflow-modal card" onClick={(e) => e.stopPropagation()}>
                <div className="modal-panel__head">
                    <h3 id="workflow-modal-title">{title}</h3>
                    <button
                        type="button"
                        className="modal-panel__close"
                        aria-label="Закрыть"
                        disabled={busy}
                        onClick={onCancel}
                    >
                        ×
                    </button>
                </div>
                <p className="modal-panel__hint">{hint}</p>

                {mode === 'close' ? (
                    <div className="workflow-modal__field">
                        <span className="workflow-modal__label">
                            Резолюция <span className="workflow-modal__required">*</span>
                        </span>
                        <div className="workflow-resolution-grid" role="radiogroup" aria-label="Резолюция">
                            {CLOSE_RESOLUTION_OPTIONS.map((opt) => (
                                <label
                                    key={opt.id}
                                    className={`workflow-resolution-option ${
                                        resolution === opt.id ? 'workflow-resolution-option--active' : ''
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        className="workflow-resolution-option__input"
                                        name="resolution"
                                        value={opt.id}
                                        checked={resolution === opt.id}
                                        disabled={busy}
                                        onChange={() => setResolution(opt.id)}
                                    />
                                    <span className="workflow-resolution-option__label">{opt.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                ) : null}

                <label className="workflow-modal__field">
                    <span className="workflow-modal__label">
                        Комментарий {mode === 'needs_info' ? <span className="workflow-modal__required">*</span> : null}
                    </span>
                    <textarea
                        className="workflow-modal__textarea"
                        rows={5}
                        value={comment}
                        disabled={busy}
                        placeholder={
                            mode === 'needs_info'
                                ? 'Например: уточните модель ноутбука и номер кабинета'
                                : 'Необязательно'
                        }
                        onChange={(e) => setComment(e.target.value)}
                    />
                </label>

                <div className="modal-panel__actions workflow-modal__actions">
                    <button type="button" className="modal-panel__btn-ghost" disabled={busy} onClick={onCancel}>
                        Отмена
                    </button>
                    <button
                        type="button"
                        className={mode === 'close' ? 'btn-danger' : 'btn-primary'}
                        disabled={busy || !canSubmit}
                        onClick={() => {
                            if (!canSubmit) {
                                return;
                            }
                            onConfirm({
                                comment: commentTrimmed,
                                resolution: mode === 'close' ? resolution : undefined,
                            });
                        }}
                    >
                        {busy ? 'Сохранение…' : mode === 'close' ? 'Закрыть' : 'Отправить'}
                    </button>
                </div>
            </div>
        </div>
    );
}
