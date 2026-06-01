import type { RepairRequest, RepairRequestDetail } from '../types/repairRequest';

export type RepairWorkflowState = 'open' | 'in_progress' | 'needs_info' | 'closed';

export type RepairCloseResolution = 'resolved' | 'wont_fix';

export const WORKFLOW_OPTIONS: { id: RepairWorkflowState; label: string }[] = [
    { id: 'open', label: 'Открыто' },
    { id: 'in_progress', label: 'В работе' },
    { id: 'needs_info', label: 'Требуется информация' },
    { id: 'closed', label: 'Закрыто' },
];

export const CLOSE_RESOLUTION_OPTIONS: { id: RepairCloseResolution; label: string }[] = [
    { id: 'resolved', label: 'Решен' },
    { id: 'wont_fix', label: 'Не будет исправлено' },
];

export function workflowFromRequest(
    request: Pick<RepairRequestDetail, 'status' | 'trackerStatusLabel'>,
): RepairWorkflowState {
    if (request.status === 'closed') {
        return 'closed';
    }
    if (request.status === 'new') {
        return 'open';
    }
    const label = (request.trackerStatusLabel ?? '').trim().toLowerCase();
    if (label === 'требуется информация') {
        return 'needs_info';
    }
    if (request.status === 'in_progress') {
        return 'in_progress';
    }
    return 'open';
}

export function workflowStatusLabel(state: RepairWorkflowState): string {
    return WORKFLOW_OPTIONS.find((o) => o.id === state)?.label ?? state;
}

export function workflowPillClass(state: RepairWorkflowState): string {
    switch (state) {
        case 'open':
            return 'status-pill status-pill--request-new';
        case 'in_progress':
            return 'status-pill status-pill--request-progress';
        case 'needs_info':
            return 'status-pill status-pill--request-needs-info';
        case 'closed':
            return 'status-pill status-pill--request-closed';
        default:
            return 'status-pill';
    }
}
