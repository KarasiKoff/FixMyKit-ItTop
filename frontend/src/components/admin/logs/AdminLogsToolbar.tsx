import React from 'react';
import type { LogLevelFilter, LogSource } from '../../../api/adminLogs';

export type AdminLogsFilters = {
    source: LogSource;
    level: LogLevelFilter;
    search: string;
};

type AdminLogsToolbarProps = {
    draft: AdminLogsFilters;
    filtersPending: boolean;
    autoRefresh: boolean;
    fetching: boolean;
    filesMeta: { appKb: string; errorKb: string };
    onDraftChange: (next: AdminLogsFilters) => void;
    onApply: () => void;
    onAutoRefreshChange: (value: boolean) => void;
    onRefresh: () => void;
};

export function AdminLogsToolbar({
    draft,
    filtersPending,
    autoRefresh,
    fetching,
    filesMeta,
    onDraftChange,
    onApply,
    onAutoRefreshChange,
    onRefresh,
}: AdminLogsToolbarProps) {
    return (
        <section className="card card--hub">
            <p className="filter-hint">Загружается до 500 последних записей; листание — постранично на клиенте.</p>
            <div className="admin-logs-toolbar">
                <div className="admin-logs-toolbar__filters">
                    <label>
                        Источник
                        <select
                            value={draft.source}
                            onChange={(e) => onDraftChange({ ...draft, source: e.target.value as LogSource })}
                        >
                            <option value="app">Все события (app)</option>
                            <option value="error">Только сбои (error)</option>
                        </select>
                    </label>
                    <label>
                        Уровень
                        <select
                            value={draft.level}
                            onChange={(e) => onDraftChange({ ...draft, level: e.target.value as LogLevelFilter })}
                        >
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
                            value={draft.search}
                            onChange={(e) => onDraftChange({ ...draft, search: e.target.value })}
                            placeholder="текст, request_id, tracker…"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && filtersPending) {
                                    onApply();
                                }
                            }}
                        />
                    </label>
                </div>
                <div className="admin-logs-toolbar__actions">
                    <button
                        type="button"
                        className="btn-primary btn-compact"
                        disabled={!filtersPending}
                        onClick={onApply}
                    >
                        Применить
                    </button>
                    <label className="admin-logs-toolbar__check">
                        <input
                            type="checkbox"
                            checked={autoRefresh}
                            onChange={(e) => onAutoRefreshChange(e.target.checked)}
                        />
                        Каждые 5 с
                    </label>
                    <button
                        type="button"
                        className="btn-ghost btn-compact"
                        disabled={fetching}
                        onClick={onRefresh}
                    >
                        {fetching ? 'Загрузка…' : 'Обновить'}
                    </button>
                </div>
            </div>
            <p className="muted-text admin-logs-files-meta">
                app: {filesMeta.appKb} · error: {filesMeta.errorKb}
            </p>
        </section>
    );
}
