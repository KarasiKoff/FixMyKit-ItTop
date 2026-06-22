import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RepairRequestStatusPanel } from './RepairRequestStatusPanel';
import type { RepairRequestDetail } from '../types/repairRequest';
import { ApiError } from '../api/client';
import {
    fetchRepairRequest,
    patchRepairRequestWorkflow,
} from '../api/repairRequests';
import { externalSyncPendingToast } from '../utils/externalIntegrationCopy';

const showSuccess = vi.fn();
const showError = vi.fn();

vi.mock('../hooks/useToast', () => ({
    useToast: () => ({ showSuccess, showError }),
}));

vi.mock('../api/repairRequests', () => ({
    patchRepairRequestWorkflow: vi.fn(),
    patchRepairRequestTake: vi.fn(),
    fetchRepairRequest: vi.fn(),
}));

vi.mock('./RepairWorkflowModal', () => ({
    RepairWorkflowModal: () => null,
}));

const integration = { provider: 'jira' as const, enabled: true, label: 'Jira' };
const pendingToast = externalSyncPendingToast(integration);

const baseRequest: RepairRequestDetail = {
    id: 'req-1',
    requesterName: 'admin',
    description: 'test',
    status: 'open',
    takenBySysadmin: false,
    trackerStatusLabel: 'Открыт',
    trackerStatusSyncPending: false,
    isPublished: false,
    hasAttachments: false,
    createdAt: '2026-01-01T00:00:00Z',
};

describe('RepairRequestStatusPanel', () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it('shows pending toast after successful workflow when sync is pending', async () => {
        vi.mocked(patchRepairRequestWorkflow).mockResolvedValue({
            ...baseRequest,
            status: 'in_progress',
            trackerStatusSyncPending: true,
        });

        render(
            <RepairRequestStatusPanel
                requestId="req-1"
                request={baseRequest}
                canUseExternalWorkflow
                integration={integration}
                onUpdated={vi.fn()}
            />,
        );

        fireEvent.click(screen.getByRole('radio', { name: 'В работу' }));

        await waitFor(() => {
            expect(showError).toHaveBeenCalledWith(pendingToast);
        });
        expect(showSuccess).not.toHaveBeenCalled();
    });

    it('shows pending toast when tracker is unavailable but status saved', async () => {
        vi.mocked(patchRepairRequestWorkflow).mockRejectedValue(
            new ApiError(502, 'tracker_unavailable'),
        );
        vi.mocked(fetchRepairRequest).mockResolvedValue({
            ...baseRequest,
            status: 'in_progress',
            trackerStatusSyncPending: true,
        });

        render(
            <RepairRequestStatusPanel
                requestId="req-1"
                request={baseRequest}
                canUseExternalWorkflow
                integration={integration}
                onUpdated={vi.fn()}
            />,
        );

        fireEvent.click(screen.getByRole('radio', { name: 'В работу' }));

        await waitFor(() => {
            expect(showError).toHaveBeenCalledWith(pendingToast);
        });
    });

    it('shows generic error for non-tracker failures', async () => {
        vi.mocked(patchRepairRequestWorkflow).mockRejectedValue(
            new ApiError(404, 'repair_request_not_found'),
        );
        vi.mocked(fetchRepairRequest).mockRejectedValue(new Error('network'));

        render(
            <RepairRequestStatusPanel
                requestId="req-1"
                request={baseRequest}
                canUseExternalWorkflow
                integration={integration}
                onUpdated={vi.fn()}
            />,
        );

        fireEvent.click(screen.getByRole('radio', { name: 'В работу' }));

        await waitFor(() => {
            expect(showError).toHaveBeenCalled();
        });
        expect(showError).not.toHaveBeenCalledWith(pendingToast);
    });
});
