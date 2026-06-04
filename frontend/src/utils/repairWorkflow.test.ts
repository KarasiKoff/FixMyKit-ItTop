import { describe, expect, it } from 'vitest';
import { workflowFromRequest, workflowStatusLabel } from './repairWorkflow';

describe('workflowFromRequest', () => {
    it('uses needs_info status from API', () => {
        expect(
            workflowFromRequest({
                status: 'needs_info',
                trackerStatusLabel: 'В работе',
            }),
        ).toBe('needs_info');
    });

    it('uses in_progress status from API', () => {
        expect(
            workflowFromRequest({
                status: 'in_progress',
                trackerStatusLabel: 'Требуется информация',
            }),
        ).toBe('in_progress');
    });

});

describe('workflowStatusLabel', () => {
    it('returns Russian label for in_progress', () => {
        expect(workflowStatusLabel('in_progress')).toBe('В работе');
    });
});
