import React, { useState } from 'react';
import { fetchRepairRequest, patchRepairRequestTake, patchRepairRequestWorkflow } from '../api/repairRequests';
import type { RepairRequestDetail } from '../types/repairRequest';
import { useToast } from '../hooks/useToast';
import {
    formatApiError,
    isTrackerUnavailableError,
} from '../utils/formatApiError';
import { externalSyncPendingToast } from '../utils/externalIntegrationCopy';
import type { PublicIntegration } from '../types/integration';
import { type RepairWorkflowState, workflowFromRequest } from '../utils/repairWorkflow';
import { RepairWorkflowModal, type RepairWorkflowModalMode } from './RepairWorkflowModal';
import type { RepairCloseResolution } from '../utils/repairWorkflow';
/** URL через import.meta.url — стабильно попадает в prod-сборку (в отличие от части default-import .svg). */
const STATUS_ICON_URLS = {
    new: new URL('../icon/new.svg', import.meta.url).href,
    inWork: new URL('../icon/in-work.svg', import.meta.url).href,
    needInfo: new URL('../icon/need-info.svg', import.meta.url).href,
    taken: new URL('../icon/take-by-sysadmin.svg', import.meta.url).href,
} as const;

type Props = {
    requestId: string;
    request: RepairRequestDetail;
    canUseExternalWorkflow: boolean;
    integration: PublicIntegration;
    onUpdated: (request: RepairRequestDetail) => void;
    onCommentsChanged?: () => void;
};

function StatusIconAsset({ src }: { src: string }) {
    const mask = `url("${src}")`;
    return (
        <span
            className="repair-status-icon-asset"
            style={{
                maskImage: mask,
                WebkitMaskImage: mask,
            }}
            aria-hidden="true"
        />
    );
}

function IconOpen() {
    return <StatusIconAsset src={STATUS_ICON_URLS.new} />;
}

function IconInProgress() {
    return <StatusIconAsset src={STATUS_ICON_URLS.inWork} />;
}

function IconNeedsInfo() {
    return <StatusIconAsset src={STATUS_ICON_URLS.needInfo} />;
}

function IconClosed() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
            <path
                d="m8.8 12.2 2.2 2.2 4.2-4.2"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function IconTaken() {
    return <StatusIconAsset src={STATUS_ICON_URLS.taken} />;
}

export function RepairRequestStatusPanel({
    requestId,
    request,
    canUseExternalWorkflow,
    integration,
    onUpdated,
    onCommentsChanged,
}: Props) {
    const { showSuccess, showError } = useToast();
    const [busy, setBusy] = useState(false);
    const [modal, setModal] = useState<RepairWorkflowModalMode | null>(null);

    const current = workflowFromRequest(request);
    const canChange = canUseExternalWorkflow && !busy;
    const sliderValue: 'open' | 'in_progress' | null = current === 'open' || current === 'in_progress' ? current : null;

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
            if (updated.trackerStatusSyncPending) {
                showError(externalSyncPendingToast(integration));
            } else {
                showSuccess('Статус обновлён');
            }
        } catch (err) {
            let refreshed: RepairRequestDetail | null = null;
            try {
                refreshed = await fetchRepairRequest(requestId);
                onUpdated(refreshed);
            } catch {
                /* ignore */
            }
            if (refreshed?.trackerStatusSyncPending && isTrackerUnavailableError(err)) {
                showError(externalSyncPendingToast(integration));
            } else {
                showError(formatApiError(err));
            }
        } finally {
            setBusy(false);
            setModal(null);
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
            <div className="repair-status-panel-card">
                <section
                    className={`repair-status-icon-panel ${!canChange ? 'repair-status-icon-panel--disabled' : ''}`}
                    aria-label="Статус заявки"
                >
                <div
                    className={`repair-status-vertical-switch ${
                        sliderValue === 'open'
                            ? 'repair-status-vertical-switch--open'
                            : sliderValue === 'in_progress'
                              ? 'repair-status-vertical-switch--in-progress'
                              : 'repair-status-vertical-switch--none'
                    }`}
                    role="radiogroup"
                    aria-label="Открыта или в работе"
                    aria-disabled={!canChange}
                >
                    <span className="repair-status-vertical-switch__thumb" aria-hidden="true" />
                    <button
                        type="button"
                        role="radio"
                        aria-checked={sliderValue === 'open'}
                        className="repair-status-vertical-switch__option"
                        disabled={!canChange}
                        title="Открыта"
                        aria-label="Открыта"
                        onClick={() => onSelect('open')}
                    >
                        <IconOpen />
                        <span className="repair-status-tooltip" role="tooltip">
                            Открыта
                        </span>
                    </button>
                    <button
                        type="button"
                        role="radio"
                        aria-checked={sliderValue === 'in_progress'}
                        className="repair-status-vertical-switch__option"
                        disabled={!canChange}
                        title="В работу"
                        aria-label="В работу"
                        onClick={() => onSelect('in_progress')}
                    >
                        <IconInProgress />
                        <span className="repair-status-tooltip" role="tooltip">
                            В работу
                        </span>
                    </button>
                </div>

                <button
                    type="button"
                    className={`repair-status-icon-btn repair-status-icon-btn--warning ${current === 'needs_info' ? 'is-active' : ''}`}
                    disabled={!canChange}
                    onClick={() => onSelect('needs_info')}
                    title="Нужна информация"
                    aria-label="Нужна информация"
                >
                    <IconNeedsInfo />
                    <span className="repair-status-tooltip" role="tooltip">
                        Нужна информация
                    </span>
                </button>

                <button
                    type="button"
                    className={`repair-status-icon-btn repair-status-icon-btn--success ${current === 'closed' ? 'is-active' : ''}`}
                    disabled={!canChange}
                    onClick={() => onSelect('closed')}
                    title="Закрыть"
                    aria-label="Закрыть"
                >
                    <IconClosed />
                    <span className="repair-status-tooltip" role="tooltip">
                        Закрыть
                    </span>
                </button>

                {current !== 'closed' ? (
                    <button
                        type="button"
                        className={`repair-status-icon-btn repair-status-icon-btn--taken ${
                            request.takenBySysadmin ? 'is-active' : ''
                        }`}
                        disabled={!canChange}
                        onClick={() => void onSetTaken(!request.takenBySysadmin)}
                        title={request.takenBySysadmin ? 'Вернуть на место' : 'Забрал сисадмин'}
                        aria-label={request.takenBySysadmin ? 'Вернуть на место' : 'Забрал сисадмин'}
                    >
                        <IconTaken />
                        <span className="repair-status-tooltip" role="tooltip">
                            {request.takenBySysadmin ? 'Вернуть на место' : 'Забрал сисадмин'}
                        </span>
                    </button>
                ) : null}
                </section>
            </div>

            <RepairWorkflowModal
                open={modal !== null}
                mode={modal ?? 'needs_info'}
                integration={integration}
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
