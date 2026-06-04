import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
    isRepairRequestSynced,
    publishRepairRequest,
    syncRepairRequestTracker,
} from '../api/repairRequests';
import { RepairAttachmentsModal } from '../components/RepairAttachmentsModal';
import { RepairRequestComments } from '../components/RepairRequestComments';
import { RepairRequestStatusPanel } from '../components/RepairRequestStatusPanel';
import { RepairRequestDetailCard } from '../components/repair/RepairRequestDetailCard';
import { RepairTrackerSyncBanner } from '../components/RepairTrackerSyncBanner';
import { FormSubmitOverlay } from '../components/ui/FormSubmitOverlay';
import { LoadingPanel } from '../components/ui/LoadingPanel';
import { useToast } from '../hooks/useToast';
import { yandexTrackerIssueWebHref } from '../utils/yandexTracker';
import { formatApiError } from '../utils/formatApiError';
import { needsAttachmentTrackerSync } from '../utils/attachmentSyncDisplay';
import { RoomMapModal } from '../components/RoomMapModal';
import { IconSync } from '../components/admin/AdminDashboardIcons';
import { useRepairRequestDetail } from '../hooks/useRepairRequestDetail';

export function RepairRequestDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showSuccess, showError } = useToast();
    const {
        request,
        device,
        loading,
        closedByDbLabel,
        commentsRefreshKey,
        noteParts,
        reload,
        applyRequestUpdate,
        bumpComments,
    } = useRepairRequestDetail(id);
    const [showMapModal, setShowMapModal] = useState(false);
    const [attachmentsOpen, setAttachmentsOpen] = useState(false);
    const [syncing, setSyncing] = useState(false);

    async function trySync() {
        if (!id || syncing) {
            return;
        }
        setSyncing(true);
        try {
            await syncRepairRequestTracker(id);
            showSuccess('Синхронизация с Трекером выполнена');
            await reload();
        } catch (err) {
            showError(formatApiError(err));
        } finally {
            setSyncing(false);
        }
    }

    async function togglePublish() {
        if (!id || !request) {
            return;
        }
        try {
            const updated = await publishRepairRequest(id, !request.isPublished);
            await applyRequestUpdate(updated);
            showSuccess(updated.isPublished ? 'Заявка опубликована для гостей' : 'Публикация снята');
        } catch (err) {
            showError(formatApiError(err));
        }
    }

    if (loading) {
        return (
            <main className="page page--wide page--centered">
                <div className="admin-page-head admin-page-head--edges">
                    <button type="button" className="admin-back-link" onClick={() => navigate('/requests')}>
                        ← К заявкам
                    </button>
                    <div className="page-title-actions">
                        <Link to="/repair" className="page-title page-title--link">
                            Заявка на ремонт
                        </Link>
                        <button
                            type="button"
                            className="btn-ghost btn-compact btn-icon"
                            disabled
                            aria-label="Обновить"
                            title="Обновить"
                        >
                            <IconSync />
                        </button>
                    </div>
                </div>
                <LoadingPanel title="Загружаем заявку…" />
            </main>
        );
    }

    if (!request) {
        return (
            <main className="page page--wide page--centered">
                <div className="admin-page-head admin-page-head--edges">
                    <button type="button" className="admin-back-link" onClick={() => navigate('/requests')}>
                        ← К заявкам
                    </button>
                    <div className="page-title-actions">
                        <Link to="/repair" className="page-title page-title--link">
                            Заявка на ремонт
                        </Link>
                        <button
                            type="button"
                            className="btn-ghost btn-compact btn-icon"
                            onClick={() => void reload()}
                            aria-label="Обновить"
                            title="Обновить"
                        >
                            <IconSync />
                        </button>
                    </div>
                </div>
                <p>Не найдена.</p>
                <button type="button" className="btn-ghost" onClick={() => navigate('/requests')}>
                    К списку заявок
                </button>
            </main>
        );
    }

    const synced = isRepairRequestSynced(request);
    const hasTrackerTicket = synced;
    const apiSt = request.status;
    const trackerHref = yandexTrackerIssueWebHref(request.ticketKey, request.ticketUrl);
    const needsAttachmentSync = needsAttachmentTrackerSync(request);
    const showTrackerSyncButton = !trackerHref || needsAttachmentSync;
    const resolutionNoteTrimmed = noteParts.resolutionTrimmed;
    const resolutionDescTrimmed = request.resolutionDesc?.trim() ?? '';
    const closedByDisplayed = noteParts.closedFromMeta || closedByDbLabel || '';

    return (
        <main className="page page--wide page--centered">
            <FormSubmitOverlay
                open={syncing}
                title="Синхронизация с Трекером…"
                detail="Создаём или обновляем задачу и загружаем вложения"
            />
            <div className="admin-page-head admin-page-head--edges">
                <button type="button" className="admin-back-link" onClick={() => navigate('/requests')}>
                    ← К заявкам
                </button>
                <div className="page-title-actions">
                    <Link to="/repair" className="page-title page-title--link">
                        Заявка на ремонт
                    </Link>
                    <button
                        type="button"
                        className="btn-ghost btn-compact btn-icon"
                        onClick={() => void reload()}
                        aria-label="Обновить"
                        title="Обновить"
                    >
                        <IconSync />
                    </button>
                </div>
            </div>

            {id && hasTrackerTicket ? (
                <RepairTrackerSyncBanner
                    requestId={id}
                    request={request}
                    onUpdated={applyRequestUpdate}
                />
            ) : null}

            <div className="repair-detail-page">
                <div className="repair-detail-main-with-side">
                    {id ? (
                        <aside className="repair-detail-floating-status">
                            <RepairRequestStatusPanel
                                requestId={id}
                                request={request}
                                hasTrackerTicket={hasTrackerTicket}
                                onUpdated={applyRequestUpdate}
                                onCommentsChanged={bumpComments}
                            />
                        </aside>
                    ) : null}
                    <RepairRequestDetailCard
                        request={request}
                        device={device}
                        synced={synced}
                        hasTrackerTicket={hasTrackerTicket}
                        trackerHref={trackerHref ?? null}
                        apiSt={apiSt}
                        resolutionNoteTrimmed={resolutionNoteTrimmed ?? ''}
                        resolutionDescTrimmed={resolutionDescTrimmed}
                        closedByDisplayed={closedByDisplayed}
                        needsAttachmentSync={needsAttachmentSync}
                        syncing={syncing}
                        showTrackerSyncButton={showTrackerSyncButton}
                        onShowMap={() => setShowMapModal(true)}
                        onOpenAttachments={() => setAttachmentsOpen(true)}
                        onSync={() => void trySync()}
                        onTogglePublish={() => void togglePublish()}
                    />
                    {id ? (
                        <section className="repair-detail-comments-block">
                            <RepairRequestComments
                                embedded
                                requestId={id}
                                hasTrackerTicket={hasTrackerTicket}
                                refreshKey={`${request.ticketKey ?? id}-${commentsRefreshKey}`}
                            />
                        </section>
                    ) : null}
                </div>
            </div>

            {showMapModal && device?.audienceId != null ? (
                <RoomMapModal
                    audienceId={device.audienceId}
                    audienceName={device.room}
                    highlightedDeviceId={device.id}
                    onClose={() => setShowMapModal(false)}
                />
            ) : null}
            {id ? (
                <RepairAttachmentsModal
                    requestId={id}
                    open={attachmentsOpen}
                    onClose={() => setAttachmentsOpen(false)}
                />
            ) : null}
        </main>
    );
}
