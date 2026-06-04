import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fetchDeviceById } from '../api/devices';
import {
    fetchRepairRequest,
    isRepairRequestSynced,
    publishRepairRequest,
    syncRepairRequestTracker,
} from '../api/repairRequests';
import { RepairAttachmentsModal } from '../components/RepairAttachmentsModal';
import { RepairRequestComments } from '../components/RepairRequestComments';
import { RepairRequestStatusPanel } from '../components/RepairRequestStatusPanel';
import { RepairTrackerSyncBanner } from '../components/RepairTrackerSyncBanner';
import { FormSubmitOverlay } from '../components/ui/FormSubmitOverlay';
import { LoadingPanel } from '../components/ui/LoadingPanel';
import { Device } from '../types/device';
import { RepairRequestDetail } from '../types/repairRequest';
import { useToast } from '../hooks/useToast';
import {
    repairRequestStatusLabel,
    repairRequestStatusPillClassForRequest,
    repairRequestWorkflowBubble,
} from '../utils/statusDisplay';
import { yandexTrackerIssueWebHref } from '../utils/yandexTracker';
import { formatApiError } from '../utils/formatApiError';
import { needsAttachmentTrackerSync } from '../utils/attachmentSyncDisplay';
import { splitResolutionNoteFromApi } from '../utils/resolutionNoteTracker';
import { fetchUserListItemById } from '../api/users';
import { RoomMapModal } from '../components/RoomMapModal';
import { IconSync } from '../components/admin/AdminDashboardIcons';
import { useRepairRequestSse } from '../hooks/useRepairRequestSse';

export function RepairRequestDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showSuccess, showError } = useToast();
    const [request, setRequest] = useState<RepairRequestDetail | null>(null);
    const [device, setDevice] = useState<Device | null>(null);
    const [loading, setLoading] = useState(true);
    const [closedByDbLabel, setClosedByDbLabel] = useState<string | null>(null);
    const [commentsRefreshKey, setCommentsRefreshKey] = useState(0);
    const [showMapModal, setShowMapModal] = useState(false);
    const [attachmentsOpen, setAttachmentsOpen] = useState(false);
    const [syncing, setSyncing] = useState(false);

    const reload = useCallback(
        async (opts?: { silent?: boolean }) => {
            if (!id) {
                return;
            }
            if (!opts?.silent) {
                setLoading(true);
            }
            try {
                const req = await fetchRepairRequest(id);
                setRequest(req);
                if (req.deviceId) {
                    const dev = await fetchDeviceById(req.deviceId);
                    setDevice(dev);
                } else {
                    setDevice(null);
                }
            } catch (err) {
                if (!opts?.silent) {
                    setRequest(null);
                    setDevice(null);
                    showError(formatApiError(err));
                }
            } finally {
                if (!opts?.silent) {
                    setLoading(false);
                }
            }
        },
        [id, showError],
    );

    useEffect(() => {
        void reload();
    }, [reload]);

    useRepairRequestSse({
        repairRequestId: id,
        enabled: Boolean(id),
        onEvent: (payload) => {
            if (payload.repair_request_id === id) {
                setCommentsRefreshKey((k) => k + 1);
                void reload({ silent: true });
            }
        },
    });

    const noteParts = useMemo(() => {
        if (!request) {
            return { resolutionTrimmed: '', closedFromMeta: '' };
        }
        const { resolutionBody, trackerClosedBy } = splitResolutionNoteFromApi(request.resolutionNote);
        const resolutionTrimmed = resolutionBody.trim();
        const closedFromMeta =
            request.status === 'closed' ? request.closedByTrackerDisplay?.trim() || trackerClosedBy || '' : '';
        return { resolutionTrimmed, closedFromMeta };
    }, [request]);

    useEffect(() => {
        let cancelled = false;
        async function resolveClosedByName() {
            if (!request || request.status !== 'closed') {
                setClosedByDbLabel(null);
                return;
            }
            if (noteParts.closedFromMeta) {
                setClosedByDbLabel(null);
                return;
            }
            const uid = request.closedByUserId?.trim();
            if (!uid) {
                setClosedByDbLabel(null);
                return;
            }
            try {
                const u = await fetchUserListItemById(uid);
                if (!cancelled) {
                    setClosedByDbLabel(u ? u.name || u.login : null);
                }
            } catch {
                if (!cancelled) {
                    setClosedByDbLabel(null);
                }
            }
        }
        void resolveClosedByName();
        return () => {
            cancelled = true;
        };
    }, [request, noteParts.closedFromMeta]);

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
            setRequest(updated);
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
    const workflowBubble = repairRequestWorkflowBubble(request);

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
                    onUpdated={async (updated) => {
                        setRequest(updated);
                        if (updated.deviceId) {
                            setDevice(await fetchDeviceById(updated.deviceId));
                        } else {
                            setDevice(null);
                        }
                    }}
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
                                onUpdated={async (updated) => {
                                    setRequest(updated);
                                    if (updated.deviceId) {
                                        setDevice(await fetchDeviceById(updated.deviceId));
                                    } else {
                                        setDevice(null);
                                    }
                                }}
                                onCommentsChanged={() => setCommentsRefreshKey((k) => k + 1)}
                            />
                        </aside>
                    ) : null}
                    <section className="card card-form card--narrow-device repair-detail-card repair-detail-layout__card">
                        <div className="device-title-row repair-detail-head">
                            <p className="repair-detail-status-line">
                                <span className={repairRequestStatusPillClassForRequest(request)}>
                                    {repairRequestStatusLabel(request.status, request.trackerStatusLabel)}
                                </span>
                                {synced ? (
                                    <span className="status-pill status-pill--tracker-synced">Трекер</span>
                                ) : (
                                    <span className="status-pill status-pill--tracker-missing">Нет в Трекере</span>
                                )}
                                {workflowBubble ? (
                                    <span className={workflowBubble.className} title={workflowBubble.label}>
                                        {workflowBubble.label}
                                    </span>
                                ) : null}
                                {request.isPublished ? (
                                    <span className="status-pill status-pill--device-ok">Опубликована</span>
                                ) : (
                                    <span className="status-pill status-pill--request-closed">Не опубликована</span>
                                )}
                                <span className="repair-detail-status-inline-sep" aria-hidden="true" />
                                <span className="repair-detail-status-kv repair-detail-status-kv--resolution">
                                    <strong>Резолюция:</strong>{' '}
                                    {resolutionNoteTrimmed ? (
                                        <span className="repair-detail-resolution-text">{resolutionNoteTrimmed}</span>
                                    ) : trackerHref ? (
                                        <span className="repair-detail-resolution-fallback muted-text">
                                            В ответе заявки текста нет — смотрите поле резолюции в{' '}
                                            <a href={trackerHref} target="_blank" rel="noreferrer">
                                                задаче Трекера
                                            </a>
                                            .
                                        </span>
                                    ) : (
                                        <span>—</span>
                                    )}
                                </span>
                                {apiSt === 'closed' ? (
                                    <span className="repair-detail-status-kv repair-detail-status-kv--closed-by">
                                        <strong>Кем закрыт:</strong> <span>{closedByDisplayed || '—'}</span>
                                    </span>
                                ) : null}
                                {resolutionDescTrimmed ? (
                                    <span className="repair-detail-status-kv repair-detail-status-kv--comment">
                                        <strong>Комментарий:</strong>{' '}
                                        <span className="repair-detail-resolution-text">{resolutionDescTrimmed}</span>
                                    </span>
                                ) : null}
                            </p>
                        </div>
                        <ul className="repair-detail-list">
                            {request.audienceId != null ? (
                                <li>
                                    <strong>Кабинет:</strong>
                                    <span>{request.audienceName ?? `Кабинет #${request.audienceId}`}</span>
                                </li>
                            ) : (
                                <li>
                                    <strong>Устройство:</strong>
                                    <span>
                                        {device ? (
                                            <Link to={`/devices/${device.id}`}>
                                                {device.inventoryNumber} — {device.name}
                                            </Link>
                                        ) : (
                                            request.deviceId
                                        )}
                                        {device?.audienceId != null ? (
                                            <button
                                                type="button"
                                                className="btn-ghost btn-compact"
                                                style={{ marginLeft: 10 }}
                                                onClick={() => setShowMapModal(true)}
                                            >
                                                Показать на карте
                                            </button>
                                        ) : null}
                                    </span>
                                </li>
                            )}
                            <li>
                                <strong>Заявитель:</strong>
                                <span>{request.requesterName || '—'}</span>
                            </li>
                            <li>
                                <strong>Создана:</strong>
                                <span>{new Date(request.createdAt).toLocaleString('ru-RU')}</span>
                            </li>
                            {trackerHref ? (
                                <li>
                                    <strong>Тикет:</strong>
                                    <span>
                                        <a href={trackerHref} target="_blank" rel="noreferrer">
                                            {request.ticketKey ?? trackerHref}
                                        </a>
                                    </span>
                                </li>
                            ) : null}
                            <li className="repair-detail-list__block">
                                <strong>Описание:</strong>
                                <p className="request-description-block">{request.description}</p>
                            </li>
                        </ul>

                        <section className="repair-detail-attachments card-inset">
                            <h3 className="repair-detail-attachments__title">Вложения</h3>
                            {request.hasAttachments ? (
                                <p className="repair-detail-attachments__meta">
                                    Файлов: {request.attachmentsCount ?? 0}
                                    {request.attachmentsSyncStatus === 'complete'
                                        ? ' · все в Трекере'
                                        : request.attachmentsSyncStatus === 'partial'
                                          ? ' · часть ещё загружается в Трекер'
                                          : ' · ожидают загрузки в Трекер'}
                                </p>
                            ) : (
                                <p className="repair-detail-attachments__meta">Файлы не прикреплялись.</p>
                            )}
                            {isRepairRequestSynced(request) && request.attachmentsSyncStatus === 'complete' ? (
                                <button
                                    type="button"
                                    className="btn-ghost btn-compact"
                                    onClick={() => setAttachmentsOpen(true)}
                                >
                                    Просмотреть вложения в Трекере
                                </button>
                            ) : request.hasAttachments ? (
                                <p className="repair-detail-attachments__hint">
                                    {needsAttachmentSync
                                        ? 'Вложения ещё не в Трекере. Нажмите «Синхронизировать с Трекером» ниже.'
                                        : 'Просмотр доступен после синхронизации с Трекером. Файлы можно прикрепить только при создании заявки.'}
                                </p>
                            ) : null}
                        </section>

                        <div className="repair-detail-tracker-actions">
                            <div className="repair-detail-tracker-footer repair-detail-tracker-footer--stacked">
                                {trackerHref ? (
                                    <a
                                        href={trackerHref}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="repair-tracker-footer-btn repair-tracker-footer-btn--filled"
                                    >
                                        Перейти в Tracker
                                    </a>
                                ) : (
                                    <button
                                        type="button"
                                        className="repair-tracker-footer-btn repair-tracker-footer-btn--muted"
                                        disabled
                                        title="Сначала синхронизируйте заявку — появится ссылка на тикет в Трекере"
                                    >
                                        Перейти в Tracker
                                    </button>
                                )}
                                {showTrackerSyncButton ? (
                                    <button
                                        type="button"
                                        className="repair-tracker-footer-btn repair-tracker-footer-btn--filled"
                                        disabled={syncing}
                                        onClick={() => void trySync()}
                                    >
                                        {syncing ? 'Синхронизация…' : 'Синхронизировать с Трекером'}
                                    </button>
                                ) : null}
                            </div>
                            <button
                                type="button"
                                className={`repair-detail-publish-btn ${request.isPublished ? 'btn-publish--active' : 'btn-publish'}`}
                                disabled={!hasTrackerTicket}
                                title={hasTrackerTicket ? undefined : 'Сначала синхронизируйте с Трекером'}
                                onClick={() => void togglePublish()}
                            >
                                {request.isPublished ? 'Снять публикацию' : 'Опубликовать'}
                            </button>
                        </div>
                    </section>

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
