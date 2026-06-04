import { useState } from 'react';
import { pushRepairRequestStatusToTracker } from '../api/repairRequests';
import type { RepairRequestDetail } from '../types/repairRequest';
import { useToast } from '../hooks/useToast';
import { formatApiError } from '../utils/formatApiError';
import { workflowFromRequest, workflowStatusLabel } from '../utils/repairWorkflow';
type Props = {
    requestId: string;
    request: RepairRequestDetail;
    onUpdated: (request: RepairRequestDetail) => void;
};

export function RepairTrackerSyncBanner({ requestId, request, onUpdated }: Props) {
    const { showSuccess, showError } = useToast();
    const [busy, setBusy] = useState(false);

    if (!request.trackerStatusSyncPending) {
        return null;
    }

    const siteStatusLabel = workflowStatusLabel(workflowFromRequest(request));

    async function handlePush() {
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

    return (
        <div className="repair-detail-tracker-sync-banner" role="status">
            <p className="repair-detail-tracker-sync-banner__text">
                Трекер не синхронизирован. На сайте: <strong>{siteStatusLabel}</strong>.
            </p>
            <button
                type="button"
                className="repair-tracker-footer-btn repair-tracker-footer-btn--filled repair-detail-tracker-sync-banner__btn"
                disabled={busy}
                onClick={() => void handlePush()}
            >
                {busy ? 'Отправка…' : 'Синхронизировать с Трекером'}
            </button>
        </div>
    );
}
