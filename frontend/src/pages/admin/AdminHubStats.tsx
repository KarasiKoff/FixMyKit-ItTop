import React, { useCallback, useEffect, useState } from 'react';
import { fetchAdminStats, type AdminStats } from '../../api/adminStats';
import { syncAllUnsynchronizedRepairRequests } from '../../api/repairRequests';
import {
    IconCalendar,
    IconKpiOpen,
    IconKpiProgress,
    IconKpiResolved,
    IconKpiTotal,
    IconKpiWontFix,
    IconRefCategories,
    IconRefDevices,
    IconRefRooms,
    IconSync,
} from '../../components/admin/AdminDashboardIcons';
import { useToast } from '../../context/ToastContext';
import { formatApiError } from '../../utils/formatApiError';

function monthStartISO(): string {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${m}-01`;
}

function todayISO(): string {
    return new Date().toISOString().slice(0, 10);
}

function formatCount(n: number): string {
    return n.toLocaleString('ru-RU');
}

function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

const KPI_CARDS = [
    {
        key: 'total',
        label: 'Всего заявок',
        iconClass: 'admin-stats-kpi-icon-wrap--total',
        Icon: IconKpiTotal,
        deltaClass: 'admin-stats-kpi-delta--total',
        getValue: (s: AdminStats) => s.repairRequests.total,
    },
    {
        key: 'open',
        label: 'Открытых',
        iconClass: 'admin-stats-kpi-icon-wrap--open',
        Icon: IconKpiOpen,
        deltaClass: 'admin-stats-kpi-delta--open',
        getValue: (s: AdminStats) => s.repairRequests.open,
    },
    {
        key: 'in_progress',
        label: 'В работе',
        iconClass: 'admin-stats-kpi-icon-wrap--progress',
        Icon: IconKpiProgress,
        deltaClass: 'admin-stats-kpi-delta--progress',
        getValue: (s: AdminStats) => s.repairRequests.inProgress,
    },
    {
        key: 'resolved',
        label: 'Решено',
        iconClass: 'admin-stats-kpi-icon-wrap--resolved',
        Icon: IconKpiResolved,
        deltaClass: 'admin-stats-kpi-delta--resolved',
        getValue: (s: AdminStats) => s.repairRequests.resolved,
    },
    {
        key: 'wont_fix',
        label: 'Не будет исправлено',
        iconClass: 'admin-stats-kpi-icon-wrap--wont-fix',
        Icon: IconKpiWontFix,
        deltaClass: 'admin-stats-kpi-delta--wont-fix',
        getValue: (s: AdminStats) => s.repairRequests.wontFix,
    },
] as const;

export function AdminHubStats() {
    const { showSuccess, showError } = useToast();
    const [dateFrom, setDateFrom] = useState(() => monthStartISO());
    const [dateTo, setDateTo] = useState(() => todayISO());
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchAdminStats({
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
            });
            setStats(data);
        } catch (err) {
            showError(formatApiError(err));
        } finally {
            setLoading(false);
        }
    }, [dateFrom, dateTo, showError]);

    useEffect(() => {
        void load();
    }, [load]);

    async function handleSync() {
        setSyncing(true);
        try {
            const result = await syncAllUnsynchronizedRepairRequests();
            showSuccess(`Синхронизировано: ${result.synced} из ${result.attempted}`);
            await load();
        } catch (err) {
            showError(formatApiError(err));
        } finally {
            setSyncing(false);
        }
    }

    const maxCategoryCount =
        stats?.devicesByCategory.reduce((max, row) => Math.max(max, row.deviceCount), 0) ?? 0;

    return (
        <section className="card card--admin-stats">
            <div className="admin-stats-head">
                <h3 className="card-heading admin-stats-title">Общая статистика заявок</h3>
                <div className="admin-stats-date-pill">
                    <IconCalendar className="admin-stats-date-pill-icon" />
                    <label className="admin-stats-date-inline">
                        <span className="visually-hidden">Дата начала</span>
                        <input
                            type="date"
                            value={dateFrom}
                            max={dateTo || undefined}
                            onChange={(e) => setDateFrom(e.target.value)}
                        />
                    </label>
                    <span className="admin-stats-date-pill-sep" aria-hidden="true">
                        —
                    </span>
                    <label className="admin-stats-date-inline">
                        <span className="visually-hidden">Дата окончания</span>
                        <input
                            type="date"
                            value={dateTo}
                            min={dateFrom || undefined}
                            onChange={(e) => setDateTo(e.target.value)}
                        />
                    </label>
                </div>
            </div>

            <div className="admin-stats-kpi-grid" aria-busy={loading}>
                {KPI_CARDS.map((card) => {
                    const value = stats ? card.getValue(stats) : null;
                    return (
                        <article key={card.key} className="admin-stats-kpi-card">
                            <div className={`admin-stats-kpi-icon-wrap ${card.iconClass}`}>
                                <card.Icon width={26} height={26} />
                            </div>
                            <div className="admin-stats-kpi-content">
                                <span className="admin-stats-kpi-label">{card.label}</span>
                                <span className="admin-stats-kpi-value">
                                    {loading || value === null ? '…' : formatCount(value)}
                                </span>
                                <span className={`admin-stats-kpi-delta ${card.deltaClass}`}>за период</span>
                            </div>
                        </article>
                    );
                })}
            </div>

            <div className="admin-stats-panels">
                <article className="admin-stats-panel admin-stats-panel--tracker">
                    <h4 className="admin-stats-panel-title">Интеграция с трекером</h4>
                    <div className="admin-stats-tracker-body">
                        <div className="admin-stats-tracker-icon-ring">
                            <IconSync className="admin-stats-tracker-sync-glyph" width={28} height={28} />
                        </div>
                        <p className="admin-stats-tracker-count">
                            <span className="admin-stats-tracker-count-label">Синхронизировано</span>
                            <span className="admin-stats-tracker-count-value">
                                {loading || !stats ? '…' : formatCount(stats.repairRequests.trackerSynced)}
                            </span>
                            <span className="admin-stats-tracker-count-suffix">за период</span>
                        </p>
                        <button
                            type="button"
                            className="btn-ghost admin-stats-sync-btn"
                            disabled={loading || syncing}
                            onClick={() => void handleSync()}
                        >
                            {syncing ? 'Синхронизация…' : 'Синхронизировать сейчас'}
                        </button>
                        <p className="admin-stats-tracker-meta muted-text">
                            <span className="admin-stats-status-dot" aria-hidden="true" />
                            Последняя синхронизация:{' '}
                            {stats?.lastTrackerSyncAt ? formatDateTime(stats.lastTrackerSyncAt) : '—'}
                        </p>
                    </div>
                </article>

                <article className="admin-stats-panel admin-stats-panel--catalog">
                    <h4 className="admin-stats-panel-title">Справочная информация</h4>
                    <ul className="admin-stats-ref-list">
                        <li>
                            <span className="admin-stats-ref-icon admin-stats-ref-icon--devices">
                                <IconRefDevices />
                            </span>
                            <span className="admin-stats-ref-label">Всего оборудования</span>
                            <strong>{loading || !stats ? '…' : formatCount(stats.catalog.devicesTotal)}</strong>
                        </li>
                        <li>
                            <span className="admin-stats-ref-icon admin-stats-ref-icon--categories">
                                <IconRefCategories />
                            </span>
                            <span className="admin-stats-ref-label">Всего категорий</span>
                            <strong>{loading || !stats ? '…' : formatCount(stats.catalog.categoriesTotal)}</strong>
                        </li>
                        <li>
                            <span className="admin-stats-ref-icon admin-stats-ref-icon--rooms">
                                <IconRefRooms />
                            </span>
                            <span className="admin-stats-ref-label">Всего аудиторий</span>
                            <strong>{loading || !stats ? '…' : formatCount(stats.catalog.audiencesTotal)}</strong>
                        </li>
                    </ul>
                </article>

                <article className="admin-stats-panel admin-stats-panel--categories">
                    <h4 className="admin-stats-panel-title">Оборудование по категориям</h4>
                    {loading ? (
                        <p className="muted-text admin-stats-empty">Загрузка…</p>
                    ) : !stats?.devicesByCategory.length ? (
                        <p className="muted-text admin-stats-empty">Нет данных по категориям</p>
                    ) : (
                        <ul className="admin-stats-category-list">
                            {stats.devicesByCategory.map((row) => {
                                const width =
                                    maxCategoryCount > 0
                                        ? Math.max(4, Math.round((row.deviceCount / maxCategoryCount) * 100))
                                        : 0;
                                return (
                                    <li key={row.categoryId ?? 'uncategorized'}>
                                        <div className="admin-stats-category-top">
                                            <span className="admin-stats-category-name">{row.categoryName}</span>
                                            <span className="admin-stats-category-meta">
                                                {formatCount(row.deviceCount)}{' '}
                                                <span className="admin-stats-category-meta-pct">
                                                    ({row.sharePercent}%)
                                                </span>
                                            </span>
                                        </div>
                                        <div className="admin-stats-category-bar-track">
                                            <span
                                                className="admin-stats-category-bar-fill"
                                                style={{ width: `${width}%` }}
                                            />
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </article>
            </div>

        </section>
    );
}
