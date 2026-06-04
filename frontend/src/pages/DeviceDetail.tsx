import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fetchDeviceById, fetchDeviceHistory } from '../api/devices';
import { Device } from '../types/device';
import { RepairHistoryEntry } from '../types/repairHistory';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DeviceNote } from '../components/DeviceNote';
import { useAppData } from '../hooks/useAppData';
import { useToast } from '../hooks/useToast';
import { DeviceTitlePills } from '../components/DeviceTitlePills';
import { deviceHistoryStatusLabel } from '../utils/statusDisplay';
import { formatApiError } from '../utils/formatApiError';
import { IconSync } from '../components/admin/AdminDashboardIcons';
import { yandexTrackerIssueWebHref } from '../utils/yandexTracker';

const HISTORY_PAGE_SIZE = 8;

function formatHistoryLine(entry: RepairHistoryEntry): string {
    return `${deviceHistoryStatusLabel(entry.oldStatus)} → ${deviceHistoryStatusLabel(entry.newStatus)}`;
}

function historyEntryIconKind(entry: RepairHistoryEntry): 'ok' | 'tracker' | 'repair' {
    if (entry.note?.includes('Трекер')) {
        return 'tracker';
    }
    if (entry.newStatus === 'not_in_repair') {
        return 'ok';
    }
    return 'repair';
}

function IconBarcode() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 7h1v10H4V7zm3 0h2v10H7V7zm4 0h1v10h-1V7zm3 0h2v10h-2V7zm4 0h1v10h-1V7z" fill="currentColor" />
        </svg>
    );
}

function IconBriefcase() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M9 7V6a3 3 0 0 1 3-3 3 3 0 0 1 3 3v1h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3zm2-1a1 1 0 0 1 2 0v1h-2V6zM6 9v10h12V9H6z"
                fill="currentColor"
            />
        </svg>
    );
}

function IconMonitor() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-5v2h3a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2h3v-2H6a2 2 0 0 1-2-2V5zm2 0v9h12V5H6z"
                fill="currentColor"
            />
        </svg>
    );
}

function IconDoor() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M14 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8zm0 2H8v14h6V5zm-2 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"
                fill="currentColor"
            />
        </svg>
    );
}

function IconPerson() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 9a7 7 0 0 1 14 0H5z" fill="currentColor" />
        </svg>
    );
}

function IconChevronDown() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M7 10l5 5 5-5H7z" fill="currentColor" />
        </svg>
    );
}

function TimelineIcon({ kind }: { kind: 'ok' | 'tracker' | 'repair' }) {
    if (kind === 'tracker') {
        return (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                    d="M6 4h9l3 3v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm8 3V6H7v12h10V7h-3z"
                    fill="currentColor"
                />
            </svg>
        );
    }
    if (kind === 'repair') {
        return (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 2 9.2 8.6 2 11l7.2 2.4L12 20l2.8-6.6L22 11l-7.2-2.4L12 2z" fill="currentColor" />
            </svg>
        );
    }
    return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9.5 16.2 4.8 11.5l1.4-1.4 3.3 3.3 8.1-8.1 1.4 1.4-9.5 9.5z" fill="currentColor" />
        </svg>
    );
}

type DeviceMetaItemProps = {
    icon: React.ReactNode;
    label: string;
    value: string;
};

function HistoryEntryLinks({ entry }: { entry: RepairHistoryEntry }) {
    if (!entry.repairRequestId) {
        return null;
    }

    const trackerHref = yandexTrackerIssueWebHref(entry.ticketKey, entry.ticketUrl);

    return (
        <span className="history-timeline__links">
            {' '}
            <Link className="history-timeline__link" to={`/requests/${entry.repairRequestId}`}>
                Заявка
            </Link>
            {trackerHref ? (
                <>
                    <span className="history-timeline__links-sep" aria-hidden="true">
                        ·
                    </span>
                    <a className="history-timeline__link" href={trackerHref} target="_blank" rel="noreferrer">
                        {entry.ticketKey ? `Трекер: ${entry.ticketKey}` : 'Яндекс Трекер'}
                    </a>
                </>
            ) : null}
        </span>
    );
}

function DeviceMetaItem({ icon, label, value }: DeviceMetaItemProps) {
    return (
        <div className="device-meta-item">
            <span className="device-meta-item__icon">{icon}</span>
            <span className="device-meta-item__label">{label}</span>
            <span className="device-meta-item__value">{value}</span>
        </div>
    );
}

export function DeviceDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { removeDevice } = useAppData();
    const { showError, showSuccess } = useToast();
    const [device, setDevice] = useState<Device | null>(null);
    const [history, setHistory] = useState<RepairHistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [historyVisibleCount, setHistoryVisibleCount] = useState(HISTORY_PAGE_SIZE);

    const reload = useCallback(async () => {
        if (!id) {
            return;
        }
        setLoading(true);
        try {
            const [d, h] = await Promise.all([fetchDeviceById(id), fetchDeviceHistory(id)]);
            setDevice(d);
            setHistory(h);
            setHistoryVisibleCount(HISTORY_PAGE_SIZE);
        } catch (err) {
            setDevice(null);
            setHistory([]);
            showError(formatApiError(err));
        } finally {
            setLoading(false);
        }
    }, [id, showError]);

    useEffect(() => {
        void reload();
    }, [reload]);

    const visibleHistory = useMemo(() => history.slice(0, historyVisibleCount), [history, historyVisibleCount]);
    const hasMoreHistory = history.length > historyVisibleCount;

    async function executeDelete() {
        if (!device) {
            return;
        }
        setDeleting(true);
        try {
            await removeDevice(device.id);
            showSuccess('Устройство удалено');
            setDeleteConfirmOpen(false);
            navigate('/devices');
        } catch (err) {
            showError(formatApiError(err));
        } finally {
            setDeleting(false);
        }
    }

    return (
        <main className="page">
            <div className="page-head-row">
                <h2>Карточка устройства</h2>
                <button
                    type="button"
                    className="btn-ghost btn-compact btn-icon"
                    disabled={loading || !id}
                    onClick={() => void reload()}
                    aria-label="Обновить"
                    title="Обновить"
                >
                    <IconSync />
                </button>
            </div>
            {loading ? (
                <p>Загрузка…</p>
            ) : !device ? (
                <>
                    <p>Устройство не найдено.</p>
                    <Link to="/devices">Вернуться к списку</Link>
                </>
            ) : (
                <>
                    <section className="card device-detail-card">
                        <div className="device-title-row">
                            <h3 className="device-detail-card__name">{device.name}</h3>
                            <DeviceTitlePills subcategory={device.subcategory} status={device.status} />
                        </div>

                        <div className="device-meta-grid grid grid-5">
                            <DeviceMetaItem
                                icon={<IconBarcode />}
                                label="Инвентарный номер"
                                value={device.inventoryNumber}
                            />
                            <DeviceMetaItem icon={<IconBriefcase />} label="Категория" value={device.category} />
                            <DeviceMetaItem icon={<IconMonitor />} label="Серийный номер" value={device.serialNumber} />
                            <DeviceMetaItem icon={<IconDoor />} label="Кабинет" value={device.room} />
                            <DeviceMetaItem
                                icon={<IconPerson />}
                                label="Ответственный"
                                value={device.responsible || '—'}
                            />
                        </div>

                        <DeviceNote
                            deviceId={device.id}
                            note={device.note}
                            onSaved={(note) => setDevice((current) => (current ? { ...current, note } : current))}
                        />

                        <div className="actions-row device-detail-actions">
                            <Link
                                className="btn-primary device-detail-actions__primary"
                                to={`/repair?deviceId=${device.id}`}
                            >
                                Создать заявку
                            </Link>
                            <Link className="btn-ghost" to={`/admin/device/${device.id}/edit`}>
                                Изменить
                            </Link>
                            <button
                                type="button"
                                className="btn-danger"
                                disabled={deleting}
                                onClick={() => setDeleteConfirmOpen(true)}
                            >
                                Удалить устройство
                            </button>
                        </div>
                    </section>

                    <section className="card device-history-card">
                        <h3 className="device-history-card__title">История ремонтов</h3>
                        {history.length === 0 ? (
                            <p className="muted-text">Записей пока нет.</p>
                        ) : (
                            <>
                                <ol className="history-timeline">
                                    {visibleHistory.map((entry, index) => {
                                        const iconKind = historyEntryIconKind(entry);
                                        const isLast = index === visibleHistory.length - 1;
                                        return (
                                            <li
                                                key={entry.id}
                                                className={`history-timeline__item${isLast ? ' history-timeline__item--last' : ''}`}
                                            >
                                                <span
                                                    className={`history-timeline__dot history-timeline__dot--${iconKind}`}
                                                    aria-hidden="true"
                                                >
                                                    <TimelineIcon kind={iconKind} />
                                                </span>
                                                <span className="history-timeline__content">
                                                    <time dateTime={entry.createdAt}>
                                                        {new Date(entry.createdAt).toLocaleString('ru-RU')}
                                                    </time>
                                                    {' — '}
                                                    {formatHistoryLine(entry)}
                                                    {entry.note ? (
                                                        <span className="history-timeline__note"> ({entry.note})</span>
                                                    ) : null}
                                                    <HistoryEntryLinks entry={entry} />
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ol>
                                {hasMoreHistory ? (
                                    <button
                                        type="button"
                                        className="btn-ghost history-show-more"
                                        onClick={() => setHistoryVisibleCount((count) => count + HISTORY_PAGE_SIZE)}
                                    >
                                        Показать ещё
                                        <IconChevronDown />
                                    </button>
                                ) : null}
                            </>
                        )}
                    </section>
                </>
            )}
            <ConfirmDialog
                open={deleteConfirmOpen && device !== null}
                title="Удалить устройство?"
                message={
                    device ? (
                        <>
                            <p>Будут безвозвратно удалены все заявки и история ремонтов по этому устройству.</p>
                            <p className="confirm-dialog__target">
                                <strong>{device.name}</strong>
                                {device.inventoryNumber ? ` · ${device.inventoryNumber}` : null}
                            </p>
                        </>
                    ) : null
                }
                confirmLabel="Удалить"
                cancelLabel="Отмена"
                confirmVariant="danger"
                busy={deleting}
                onConfirm={() => void executeDelete()}
                onCancel={() => {
                    if (!deleting) {
                        setDeleteConfirmOpen(false);
                    }
                }}
            />
        </main>
    );
}
