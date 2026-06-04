import React from 'react';
import { Link } from 'react-router-dom';
import { isRepairRequestSynced } from '../../api/repairRequests';
import type { RepairRequestDetail } from '../../types/repairRequest';
import { Device } from '../../types/device';
import {
    repairRequestStatusLabel,
    repairRequestStatusPillClassForRequest,
    repairRequestWorkflowBubble,
} from '../../utils/statusDisplay';
type RepairRequestDetailCardProps = {
    request: RepairRequestDetail;
    device: Device | null;
    synced: boolean;
    hasTrackerTicket: boolean;
    trackerHref: string | null;
    apiSt: RepairRequestDetail['status'];
    resolutionNoteTrimmed: string;
    resolutionDescTrimmed: string;
    closedByDisplayed: string;
    needsAttachmentSync: boolean;
    syncing: boolean;
    showTrackerSyncButton: boolean;
    onShowMap: () => void;
    onOpenAttachments: () => void;
    onSync: () => void;
    onTogglePublish: () => void;
};

export function RepairRequestDetailCard({
    request,
    device,
    synced,
    hasTrackerTicket,
    trackerHref,
    apiSt,
    resolutionNoteTrimmed,
    resolutionDescTrimmed,
    closedByDisplayed,
    needsAttachmentSync,
    syncing,
    showTrackerSyncButton,
    onShowMap,
    onOpenAttachments,
    onSync,
    onTogglePublish,
}: RepairRequestDetailCardProps) {
    const workflowBubble = repairRequestWorkflowBubble(request);

    return (
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
                                    onClick={onShowMap}
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
                    <button type="button" className="btn-ghost btn-compact" onClick={onOpenAttachments}>
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
                            onClick={onSync}
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
                    onClick={onTogglePublish}
                >
                    {request.isPublished ? 'Снять публикацию' : 'Опубликовать'}
                </button>
            </div>
        </section>
    );
}
