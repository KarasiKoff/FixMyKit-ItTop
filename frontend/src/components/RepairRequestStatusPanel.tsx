import React, { useState } from 'react';
import {
    fetchRepairRequest,
    patchRepairRequestTake,
    patchRepairRequestWorkflow,
    pushRepairRequestStatusToTracker,
} from '../api/repairRequests';
import type { RepairRequestDetail } from '../types/repairRequest';
import { useToast } from '../context/ToastContext';
import { formatApiError } from '../utils/formatApiError';
import { type RepairWorkflowState, workflowFromRequest } from '../utils/repairWorkflow';
import { RepairWorkflowModal, type RepairWorkflowModalMode } from './RepairWorkflowModal';
import type { RepairCloseResolution } from '../utils/repairWorkflow';


type Props = {
    requestId: string;
    request: RepairRequestDetail;
    hasTrackerTicket: boolean;
    onUpdated: (request: RepairRequestDetail) => void;
    onCommentsChanged?: () => void;
};



function statusPillClass(workflow: RepairWorkflowState, current: RepairWorkflowState, canChange: boolean): string {
    const base = 'repair-pill-btn';
    if (!canChange) {
        return `${base} repair-pill-btn--disabled`;
    }

    if (workflow !== current) {
        return `${base} repair-pill-btn--ghost`;
    }

    if (workflow === 'needs_info') {
        return `${base} repair-pill-btn--active-needs`;
    }

    if (workflow === 'closed') {
        return `${base} repair-pill-btn--active-closed`;
    }

    return `${base} repair-pill-btn--active`;
}



export function RepairRequestStatusPanel({
    requestId,
    request,
    hasTrackerTicket,
    onUpdated,
    onCommentsChanged,
}: Props) {
    const { showSuccess, showError } = useToast();
    const [busy, setBusy] = useState(false);
    const [modal, setModal] = useState<RepairWorkflowModalMode | null>(null);

    const current = workflowFromRequest(request);
    const canChange = hasTrackerTicket && !busy;
    const showTrackerStatusRetry = Boolean(request.trackerStatusSyncPending && hasTrackerTicket);
    const sliderValue: 'open' | 'in_progress' | null =
        current === 'open' || current === 'in_progress' ? current : null;



    async function applyWorkflow(
        workflow: RepairWorkflowState,
        opts?: { resolution?: RepairCloseResolution; comment?: string },

    ) {
        setBusy(true);
        try {
            const updated = await patchRepairRequestWorkflow(requestId, {
                workflow,
                resolution: opts?.resolution,
                comment: opts?.comment,
            });

            onUpdated(updated);
            if (workflow === 'needs_info') {
                onCommentsChanged?.();
            }
            showSuccess('Статус обновлён');
        } catch (err) {
            showError(formatApiError(err));
            try {
                onUpdated(await fetchRepairRequest(requestId));
            } catch {
                /* ignore */
            }
        } finally {
            setBusy(false);
            setModal(null);
        }
    }

    async function pushStatusToTracker() {
        if (!showTrackerStatusRetry || busy) {
            return;
        }
        setBusy(true);
        try {
            const updated = await pushRepairRequestStatusToTracker(requestId);
            onUpdated(updated);
            showSuccess('Статус отправлен в Трекер');
        } catch (err) {
            showError(formatApiError(err));
        } finally {
            setBusy(false);
        }
    }

    function onSelect(next: RepairWorkflowState) {
        if (!canChange || next === current) {
            return;
        }

        if (next === 'needs_info') {
            setModal('needs_info');
            return;
        }

        if (next === 'closed') {
            setModal('close');
            return;
        }

        void applyWorkflow(next);
    }



    async function onSetTaken(taken: boolean) {
        if (!canChange) {
            return;
        }

        if (taken && request.takenBySysadmin) {
            return;
        }

        if (!taken && !request.takenBySysadmin) {
            return;
        }

        setBusy(true);

        try {
            const updated = await patchRepairRequestTake(requestId, taken);
            onUpdated(updated);
            showSuccess(taken ? 'Отмечено: забрал сисадмин' : 'Устройство возвращено');

        } catch (err) {
            showError(formatApiError(err));
        } finally {
            setBusy(false);
        }

    }

    return (
        <>
            <section className="card card-form repair-status-panel-card">
                <div className="repair-status-panel__head">
                    <h3 className="repair-status-panel-card__title">Статус заявки</h3>
                    {!hasTrackerTicket ? (
                        <p className="repair-status-panel__hint muted-text">
                            Смена статуса доступна после синхронизации с Трекером.
                        </p>
                    ) : null}
                </div>

                {showTrackerStatusRetry ? (
                    <div className="repair-status-panel__pending">
                        <p className="repair-status-panel__pending-text muted-text">
                            Статус на сайте обновлён, в Yandex Tracker не ушёл. Когда Трекер снова доступен — отправьте
                            вручную.
                        </p>
                        <button
                            type="button"
                            className="repair-pill-btn repair-pill-btn--filled repair-status-panel__pending-btn"
                            disabled={busy}
                            onClick={() => void pushStatusToTracker()}
                        >
                            {busy ? 'Отправка…' : 'Отправить статус в Трекер'}
                        </button>
                    </div>
                ) : null}

                <div
                    className={`repair-status-stack ${!canChange ? 'repair-status-stack--disabled' : ''}`}
                    role="tablist"
                    aria-label="Статус заявки"
                >
                    <div
                        className={`repair-status-slider ${!canChange ? 'repair-status-slider--disabled' : ''} ${
                            sliderValue === 'open'
                                ? 'repair-status-slider--open'
                                : sliderValue === 'in_progress'
                                  ? 'repair-status-slider--in-progress'
                                  : 'repair-status-slider--none'
                        }`}
                        role="radiogroup"
                        aria-label="Открыта или в работе"
                        aria-disabled={!canChange}
                    >
                        <span className="repair-status-slider__thumb" aria-hidden="true" />
                        <button
                            type="button"
                            role="radio"
                            aria-checked={sliderValue === 'open'}
                            className="repair-status-slider__option"
                            disabled={!canChange}
                            onClick={() => onSelect('open')}
                        >
                            Открыта
                        </button>

                        <button
                            type="button"
                            role="radio"
                            aria-checked={sliderValue === 'in_progress'}
                            className="repair-status-slider__option"
                            disabled={!canChange}
                            onClick={() => onSelect('in_progress')}
                        >
                            В работу
                        </button>
                    </div>

                    <button
                        type="button"
                        role="tab"
                        aria-selected={current === 'needs_info'}
                        className={statusPillClass('needs_info', current, canChange)}
                        disabled={!canChange}
                        onClick={() => onSelect('needs_info')}
                    >
                        Нужна информация
                    </button>

                    <button
                        type="button"
                        role="tab"
                        aria-selected={current === 'closed'}
                        className={statusPillClass('closed', current, canChange)}
                        disabled={!canChange}
                        onClick={() => onSelect('closed')}
                    >
                        Закрыть
                    </button>

                </div>


                {current !== 'closed' ? (
                    <div className="repair-status-panel__taken-row">
                        <button
                            type="button"
                            className={
                                request.takenBySysadmin
                                    ? 'repair-pill-btn repair-pill-btn--ghost repair-status-panel__taken'
                                    : 'repair-pill-btn repair-pill-btn--filled repair-status-panel__taken'
                            }
                            disabled={!canChange}
                            onClick={() => void onSetTaken(!request.takenBySysadmin)}
                        >
                            {request.takenBySysadmin ? 'Вернуть на место' : 'Забрал сисадмин'}
                        </button>
                    </div>
                ) : null}
            </section>


            <RepairWorkflowModal
                open={modal !== null}
                mode={modal ?? 'needs_info'}
                busy={busy}
                onCancel={() => {
                    if (!busy) {
                        setModal(null);
                    }
                }}

                onConfirm={({ comment, resolution }) => {
                    if (modal === 'needs_info') {
                        void applyWorkflow('needs_info', { comment });
                    } else if (modal === 'close' && resolution) {
                        void applyWorkflow('closed', { resolution, comment });
                    }
                }}
            />
        </>
    );
}