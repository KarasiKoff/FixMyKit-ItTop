import type { Device } from '../types/device';
import type { RepairRequest } from '../types/repairRequest';
import type { RepairHistoryEntry } from '../types/repairHistory';
import { workflowFromRequest, workflowPillClass, workflowStatusLabel } from './repairWorkflow';

export function repairRequestStatusLabel(
    status: RepairRequest['status'],
    trackerStatusLabel?: string | null,
): string {
    return workflowStatusLabel(workflowFromRequest({ status, trackerStatusLabel }));
}

export function repairRequestStatusPillClassForRequest(
    request: Pick<RepairRequest, 'status' | 'trackerStatusLabel'>,
): string {
    return workflowPillClass(workflowFromRequest(request));
}

/**
 * Второй бейдж рядом со статусом заявки (не путать с основным «В работе» / «Закрыта»):
 * - closed - «Решён»
 * - in_progress и takenBySysadmin - «Забрал сисадмин»
 */
export function repairRequestWorkflowBubble(
    request: Pick<RepairRequest, 'status' | 'takenBySysadmin'>,
): { label: string; className: string } | null {
    if (request.status === 'closed') {
        return { label: 'Решён', className: 'status-pill status-pill--request-resolved' };
    }
    if (
        (request.status === 'in_progress' || request.status === 'needs_info') &&
        request.takenBySysadmin
    ) {
        return { label: 'Забрал сисадмин', className: 'status-pill status-pill--sysadmin-taken' };
    }
    return null;
}

export function repairRequestStatusPillClass(status: RepairRequest['status']): string {
    switch (status) {
        case 'new':
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

export function deviceRepairStatusLabel(status: Device['status']): string {
    return status === 'in_repair' ? 'В ремонте' : 'Исправно';
}

export function deviceRepairStatusPillClass(status: Device['status']): string {
    return status === 'in_repair'
        ? 'status-pill status-pill--device-in-repair'
        : 'status-pill status-pill--device-ok';
}

export function deviceSubcategoryPillClass(): string {
    return 'status-pill status-pill--device-subcategory';
}

export function deviceHistoryStatusLabel(value?: RepairHistoryEntry['oldStatus']): string {
    if (value === 'not_in_repair' || value === 'in_repair') {
        return deviceRepairStatusLabel(value);
    }
    return value ?? '—';
}
