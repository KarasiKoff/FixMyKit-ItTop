import React, { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
    fetchAdminLogs,
    type AdminLogsResponse,
    type LogEntry,
    type LogLevelFilter,
    type LogSource,
} from '../../api/adminLogs';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';
import { AdminLogsReference } from '../../components/admin/AdminLogsReference';
import { formatApiError } from '../../utils/formatApiError';
import { findLoggerRef, findMessageHint } from '../../utils/logReference';

function levelClass(level: string): string {
    const l = level.toUpperCase();
    if (l === 'ERROR' || l === 'CRITICAL') {
        return 'admin-log-line--error';
    }
    if (l === 'WARNING') {
        return 'admin-log-line--warn';
    }
    if (l === 'DEBUG') {
        return 'admin-log-line--debug';
    }
    return 'admin-log-line--info';
}

function formatTs(ts: string | null | undefined): string {
    if (!ts) {
        return '—';
    }
    try {
        return new Date(ts).toLocaleString('ru-RU');
    } catch {
        return ts;
    }
}

function LogLine({ entry }: { entry: LogEntry }) {
    const extra =
        entry.extra && Object.keys(entry.extra).length > 0
            ? JSON.stringify(entry.extra, null, 0)
            : null;
    const loggerRef = findLoggerRef(entry.logger);
    const messageHint = findMessageHint(entry.message, entry.logger);
    return (
        <div className={`admin-log-line ${levelClass(entry.level)}`}>
            <div className="admin-log-line__meta">
                <span className="admin-log-line__time">{formatTs(entry.ts)}</span>
                <span className="admin-log-line__level">{entry.level}</span>
                {entry.request_id && entry.request_id !== '-' ? (
                    <span className="admin-log-line__rid" title={`request_id: ${entry.request_id}`}>
                        {entry.request_id.slice(0, 8)}…
                    </span>
                ) : null}
                {entry.logger ? (
                    <span
                        className="admin-log-line__logger"
                        title={loggerRef ? `${loggerRef.title}: ${loggerRef.description}` : entry.logger}
                    >
                        {loggerRef?.title ?? entry.logger}
                    </span>
                ) : null}
            </div>
            <div className="admin-log-line__msg">{entry.message || entry.raw}</div>
            {messageHint ? <p className="admin-log-line__hint">{messageHint.description}</p> : null}
            {extra ? <pre className="admin-log-line__extra">{extra}</pre> : null}
            {entry.exception ? <pre className="admin-log-line__exc">{entry.exception}</pre> : null}
        </div>
    );
}

export function AdminLogsPage() {
    const { user } = useAuth();
    const { showError } = useToast();
    const isAdmin = user?.role === 'admin';

    const [source, setSource] = useState<LogSource>('app');
    const [level, setLevel] = useState<LogLevelFilter>('ALL');
    const [search, setSearch] = useState('');
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<AdminLogsResponse | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetchAdminLogs({
                source,
                level,
                search: search || undefined,
                limit: 300,
            });
            setData(res);
        } catch (err) {
            showError(formatApiError(err));
        } finally {
            setLoading(false);
        }
    }, [source, level, search, showError]);

    useEffect(() => {
        if (!isAdmin) {
            return;
        }
        setLoading(true);
        void load();
    }, [isAdmin, load]);

    useEffect(() => {
        if (!isAdmin || !autoRefresh) {
            return;
        }
        const id = window.setInterval(() => {
            void load();
        }, 5000);
        return () => window.clearInterval(id);
    }, [isAdmin, autoRefresh, load]);

    if (!isAdmin) {
        return <Navigate to="/admin" replace />;
    }

    const appFile = data?.files?.app as { size_bytes?: number } | undefined;
    const errFile = data?.files?.error as { size_bytes?: number } | undefined;

    return (
        <main className="page page--wide page--admin-dashboard">
            <div className="admin-page-head admin-page-head--edges">
                <Link to="/admin" className="admin-back-link">
                    ← Админка
                </Link>
            </div>
            <div className="page-intro page-intro--wide">
                <h2 className="page-title">Логи приложения</h2>
                <p className="muted-text">
                    Структурированные записи с сервера: HTTP, БД, авторизация, Yandex Tracker
                </p>
            </div>

            <section className="card card--hub">
                <div className="admin-logs-toolbar">
                    <label>
                        Источник
                        <select value={source} onChange={(e) => setSource(e.target.value as LogSource)}>
                            <option value="app">Все события (app)</option>
                            <option value="error">Только сбои (error)</option>
                        </select>
                    </label>
                    <label>
                        Уровень
                        <select value={level} onChange={(e) => setLevel(e.target.value as LogLevelFilter)}>
                            <option value="ALL">Все</option>
                            <option value="INFO">INFO+</option>
                            <option value="WARNING">WARNING+</option>
                            <option value="ERROR">ERROR+</option>
                            <option value="CRITICAL">CRITICAL</option>
                            <option value="DEBUG">DEBUG+</option>
                        </select>
                    </label>
                    <label className="admin-logs-toolbar__search">
                        Поиск
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="текст, request_id, tracker…"
                        />
                    </label>
                    <label className="admin-logs-toolbar__check">
                        <input
                            type="checkbox"
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                        />
                        Обновлять каждые 5 с
                    </label>
                    <button type="button" className="btn-ghost" disabled={loading} onClick={() => void load()}>
                        {loading ? 'Загрузка…' : 'Обновить'}
                    </button>
                </div>
                <p className="muted-text admin-logs-files-meta">
                    app: {appFile?.size_bytes != null ? `${Math.round(appFile.size_bytes / 1024)} КБ` : '—'} · error:{' '}
                    {errFile?.size_bytes != null ? `${Math.round(errFile.size_bytes / 1024)} КБ` : '—'}
                </p>
            </section>

            <AdminLogsReference />

            <section className="card card--hub admin-logs-viewer">
                {loading && !data ? (
                    <p className="muted-text">Загрузка логов…</p>
                ) : data && data.items.length === 0 ? (
                    <p className="muted-text">Записей не найдено. Проверьте фильтры или выполните действие в системе.</p>
                ) : (
                    <div className="admin-logs-list">
                        {data?.items.map((entry, idx) => (
                            <LogLine key={`${entry.ts}-${idx}`} entry={entry} />
                        ))}
                    </div>
                )}
            </section>
        </main>
    );
}
