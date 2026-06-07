import { describe, expect, it } from 'vitest';

import {
    deviceHistoryStatusLabel,
    deviceRepairStatusLabel,
    deviceRepairStatusPillClass,
    repairRequestStatusPillClass,
    repairRequestWorkflowBubble,
} from './statusDisplay';

describe('repairRequestWorkflowBubble', () => {
    it('shows resolved bubble for closed', () => {
        expect(repairRequestWorkflowBubble({ status: 'closed', takenBySysadmin: false })).toEqual({
            label: 'Решён',
            className: 'status-pill status-pill--request-resolved',
        });
    });

    it('shows sysadmin taken for in_progress', () => {
        expect(
            repairRequestWorkflowBubble({ status: 'in_progress', takenBySysadmin: true }),
        ).toMatchObject({ label: 'Забрал сисадмин' });
    });

    it('shows sysadmin taken for needs_info', () => {
        expect(
            repairRequestWorkflowBubble({ status: 'needs_info', takenBySysadmin: true }),
        ).toMatchObject({ label: 'Забрал сисадмин' });
    });

    it('returns null when not applicable', () => {
        expect(
            repairRequestWorkflowBubble({ status: 'open', takenBySysadmin: false }),
        ).toBeNull();
    });
});

describe('repairRequestStatusPillClass', () => {
    it('maps needs_info', () => {
        expect(repairRequestStatusPillClass('needs_info')).toContain('needs-info');
    });
});

describe('deviceRepairStatusLabel', () => {
    it('maps repair states', () => {
        expect(deviceRepairStatusLabel('in_repair')).toBe('В ремонте');
        expect(deviceRepairStatusLabel('not_in_repair')).toBe('Исправно');
    });
});

describe('deviceRepairStatusPillClass', () => {
    it('maps pill classes', () => {
        expect(deviceRepairStatusPillClass('in_repair')).toContain('in-repair');
        expect(deviceRepairStatusPillClass('not_in_repair')).toContain('device-ok');
    });
});

describe('deviceHistoryStatusLabel', () => {
    it('formats known values', () => {
        expect(deviceHistoryStatusLabel('in_repair')).toBe('В ремонте');
        expect(deviceHistoryStatusLabel(undefined)).toBe('—');
    });
});
