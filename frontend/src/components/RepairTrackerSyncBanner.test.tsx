import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RepairTrackerSyncBanner } from './RepairTrackerSyncBanner';
import type { RepairRequestDetail } from '../types/repairRequest';
import { pushRepairRequestStatusToTracker } from '../api/repairRequests';

const showSuccess = vi.fn();
const showError = vi.fn();

vi.mock('../hooks/useToast', () => ({
    useToast: () => ({
        showSuccess,
        showError,
    }),
}));

vi.mock('../api/repairRequests', () => ({
    pushRepairRequestStatusToTracker: vi.fn(),
}));

const baseRequest: RepairRequestDetail = {
    id: 'req-1',
    requesterName: 'admin',
    description: 'test',
    status: 'in_progress',
    takenBySysadmin: false,
    trackerStatusLabel: 'Требуется информация',
    trackerStatusSyncPending: true,
    isPublished: false,
    hasAttachments: false,
    createdAt: '2026-01-01T00:00:00Z',
};

describe('RepairTrackerSyncBanner', () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it('renders nothing when sync is not pending', () => {
        const { container } = render(
            <RepairTrackerSyncBanner
                requestId="req-1"
                request={{ ...baseRequest, trackerStatusSyncPending: false }}
                onUpdated={vi.fn()}
            />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('shows banner and sync button when pending', () => {
        render(
            <RepairTrackerSyncBanner requestId="req-1" request={baseRequest} onUpdated={vi.fn()} />,
        );
        expect(screen.getByRole('status')).toBeInTheDocument();
        expect(screen.getByText(/Трекер не синхронизирован/i)).toBeInTheDocument();
        expect(screen.getByText(/В работе/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Синхронизировать с Трекером/i })).toBeInTheDocument();
    });

    it('calls push API and onUpdated on sync click', async () => {
        const onUpdated = vi.fn();
        const updated = { ...baseRequest, trackerStatusSyncPending: false };
        vi.mocked(pushRepairRequestStatusToTracker).mockResolvedValue(updated);

        render(
            <RepairTrackerSyncBanner requestId="req-1" request={baseRequest} onUpdated={onUpdated} />,
        );

        fireEvent.click(screen.getByRole('button', { name: /Синхронизировать с Трекером/i }));

        await waitFor(() => {
            expect(pushRepairRequestStatusToTracker).toHaveBeenCalledWith('req-1');
            expect(onUpdated).toHaveBeenCalledWith(updated);
            expect(showSuccess).toHaveBeenCalledWith('Статус отправлен в Трекер');
        });
    });
});
