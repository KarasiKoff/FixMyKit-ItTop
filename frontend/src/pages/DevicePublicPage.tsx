import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fetchPublicRepairSummary } from '../api/repairRequests';
import { useAuth } from '../hooks/useAuth';
import { formatApiError } from '../utils/formatApiError';
import { PublicRepairSummary, PublicRepairRequestItem } from '../types/repairRequest';

function statusLabel(status: string): string {
    if (status === 'open') return 'Новая';
    if (status === 'in_progress') return 'В работе';
    if (status === 'closed') return 'Закрыта';
    return status;
}

function statusPillClass(status: string): string {
    if (status === 'open') return 'status-pill status-pill--request-new';
    if (status === 'in_progress') return 'status-pill status-pill--request-progress';
    if (status === 'closed') return 'status-pill status-pill--request-closed';
    return 'status-pill';
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });
}

function ActiveRequestCard({ req }: { req: PublicRepairRequestItem }) {
    return (
        <section className="card public-history-active-card">
            <div className="public-history-active-head">
                <h3 className="public-history-section-title">Активная заявка</h3>
                <span className={statusPillClass(req.status)}>{statusLabel(req.status)}</span>
            </div>
            <ul className="repair-detail-list">
                {req.applicantName ? (
                    <li>
                        <strong>Заявитель:</strong>
                        <span>{req.applicantName}</span>
                    </li>
                ) : null}
                <li>
                    <strong>Подана:</strong>
                    <span>{formatDate(req.createdAt)}</span>
                </li>
                <li className="repair-detail-list__block">
                    <strong>Описание:</strong>
                    <p className="request-description-block">{req.description}</p>
                </li>
            </ul>
        </section>
    );
}

function ModerationBanner() {
    return (
        <div className="public-history-moderation-banner">
            <span className="public-history-moderation-icon" aria-hidden="true">⏳</span>
            <span>
                <strong>Есть активная заявка</strong> — она находится на модерации и будет видна после
                подтверждения администратором.
            </span>
        </div>
    );
}

function HistoryItem({ item, isLast }: { item: PublicRepairRequestItem; isLast: boolean }) {
    return (
        <li className={`history-timeline__item${isLast ? ' history-timeline__item--last' : ''}`}>
            <span className="history-timeline__dot history-timeline__dot--ok" aria-hidden="true">
                ✓
            </span>
            <div className="history-timeline__content">
                <div className="public-history-item-header">
                    <span className={statusPillClass(item.status)}>{statusLabel(item.status)}</span>
                    <time>{formatDate(item.createdAt)}</time>
                    {item.closedAt ? (
                        <span className="history-timeline__note">
                            — закрыта {formatDate(item.closedAt)}
                        </span>
                    ) : null}
                </div>
                <p className="public-history-item-desc">{item.description}</p>
                {item.resolutionNote?.trim() ? (
                    <p className="public-history-item-resolution">
                        <strong>Решение:</strong> {item.resolutionNote.trim()}
                    </p>
                ) : null}
            </div>
        </li>
    );
}

export function DevicePublicPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const [summary, setSummary] = useState<PublicRepairSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        setError(null);
        fetchPublicRepairSummary(id)
            .then(setSummary)
            .catch((err: unknown) => setError(formatApiError(err)))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) {
        return (
            <main className="page page--centered">
                <p className="muted-text">Загрузка…</p>
            </main>
        );
    }

    if (error || !summary) {
        return (
            <main className="page page--centered">
                <div className="card card--narrow-device">
                    <p className="error-text">{error ?? 'Устройство не найдено.'}</p>
                    <button type="button" className="btn-ghost" style={{ marginTop: 16 }} onClick={() => navigate(-1)}>
                        Назад
                    </button>
                </div>
            </main>
        );
    }

    const { device, activeRequest, hasUnpublishedActive, history } = summary;
    const hasAnyHistory = history.length > 0;
    const canSubmitNewRequest = !activeRequest && !hasUnpublishedActive;

    return (
        <main className="page page--centered">
            {isAuthenticated ? (
                <div className="admin-page-head admin-page-head--edges" style={{ width: '100%', maxWidth: 520 }}>
                    <Link to={`/devices/${device.id}`} className="admin-back-link">
                        ← К карточке устройства
                    </Link>
                </div>
            ) : null}

            {/* Device info */}
            <section className="card card--narrow-device">
                <h2 className="card-heading" style={{ textAlign: 'left', marginBottom: 12 }}>
                    {device.name}
                </h2>
                <ul className="repair-detail-list">
                    <li>
                        <strong>Инв. номер:</strong>
                        <span className="muted-text">{device.inventoryNumber}</span>
                    </li>
                    {device.category ? (
                        <li>
                            <strong>Категория:</strong>
                            <span>{device.category.name}</span>
                        </li>
                    ) : null}
                    {device.audience ? (
                        <li>
                            <strong>Кабинет:</strong>
                            <span>{device.audience.name}</span>
                        </li>
                    ) : null}
                </ul>
                {canSubmitNewRequest ? (
                    <div className="public-device-submit">
                        <Link to={`/repair?deviceId=${device.id}`} className="btn-primary">
                            Подать заявку на ремонт
                        </Link>
                    </div>
                ) : null}
            </section>

            {/* Active request */}
            {activeRequest ? <ActiveRequestCard req={activeRequest} /> : null}
            {!activeRequest && hasUnpublishedActive ? <ModerationBanner /> : null}

            {/* History */}
            <section className="card card--narrow-device">
                <h3 className="public-history-section-title" style={{ marginBottom: hasAnyHistory ? 20 : 0 }}>
                    История ремонтов
                </h3>
                {hasAnyHistory ? (
                    <ol className="history-timeline" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {history.map((item, idx) => (
                            <HistoryItem key={item.id} item={item} isLast={idx === history.length - 1} />
                        ))}
                    </ol>
                ) : (
                    <p className="muted-text" style={{ margin: 0 }}>
                        Ремонтов ещё не было.
                    </p>
                )}
            </section>
        </main>
    );
}
