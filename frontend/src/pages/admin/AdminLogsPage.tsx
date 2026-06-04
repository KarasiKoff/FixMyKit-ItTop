import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { fetchAdminLogs, type AdminLogsResponse } from '../../api/adminLogs';
import { AdminLogsReference } from '../../components/admin/AdminLogsReference';
import { AdminLogLine } from '../../components/admin/logs/AdminLogLine';
import { AdminLogsToolbar, type AdminLogsFilters } from '../../components/admin/logs/AdminLogsToolbar';
import { ListPagination } from '../../components/ListPagination';
import { useAuth } from '../../hooks/useAuth';
import { useClientPaginatedList } from '../../hooks/useClientPaginatedList';
import { useToast } from '../../hooks/useToast';

const EMPTY_LOG_FILTERS: AdminLogsFilters = { source: 'app', level: 'ALL', search: '' };

function formatFileKb(files: AdminLogsResponse['files'] | null, key: 'app' | 'error'): string {
    const file = files?.[key] as { size_bytes?: number } | undefined;
    return file?.size_bytes != null ? `${Math.round(file.size_bytes / 1024)} КБ` : '—';
}

export function AdminLogsPage() {
    const { user } = useAuth();
    const { showError } = useToast();
    const isAdmin = user?.role === 'admin';
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [filesMeta, setFilesMeta] = useState<AdminLogsResponse['files'] | null>(null);

    const fetchAll = useCallback(
        async (filters: AdminLogsFilters) => {
            const res = await fetchAdminLogs({
                source: filters.source,
                level: filters.level,
                search: filters.search || undefined,
                limit: 500,
            });
            setFilesMeta(res.files);
            return res.items;
        },
        [],
    );

    const {
        items,
        total,
        fetching,
        page,
        pageSize,
        draftFilters,
        setDraftFilters,
        applyFilters,
        filtersPending,
        setPage,
        setPageSize,
        reload,
    } = useClientPaginatedList({
        emptyFilters: EMPTY_LOG_FILTERS,
        defaultPageSize: 50,
        fetchAll,
        onError: (message) => showError(message),
    });

    useEffect(() => {
        if (!isAdmin || !autoRefresh) {
            return;
        }
        const id = window.setInterval(() => {
            void reload({ silent: true, resetPage: false });
        }, 5000);
        return () => window.clearInterval(id);
    }, [isAdmin, autoRefresh, reload]);

    const filesDisplay = useMemo(
        () => ({
            appKb: formatFileKb(filesMeta, 'app'),
            errorKb: formatFileKb(filesMeta, 'error'),
        }),
        [filesMeta],
    );

    if (!isAdmin) {
        return <Navigate to="/admin" replace />;
    }

    return (
        <main className="page page--wide page--admin-dashboard">
            <div className="admin-page-head admin-page-head--edges">
                <Link to="/admin" className="admin-back-link">
                    ← Админка
                </Link>
            </div>
            <div className="page-intro page-intro--wide">
                <h2 className="page-title">Логи приложения</h2>
                <p className="muted-text">Структурированные записи с сервера: HTTP, БД, авторизация, Yandex Tracker</p>
            </div>

            <AdminLogsToolbar
                draft={draftFilters}
                filtersPending={filtersPending}
                autoRefresh={autoRefresh}
                fetching={fetching}
                filesMeta={filesDisplay}
                onDraftChange={setDraftFilters}
                onApply={applyFilters}
                onAutoRefreshChange={setAutoRefresh}
                onRefresh={() => void reload({ resetPage: false })}
            />

            <ListPagination
                page={page}
                pageSize={pageSize}
                total={total}
                loading={fetching}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                }}
            />

            <AdminLogsReference />

            <section className="card card--hub admin-logs-viewer">
                {fetching && items.length === 0 ? (
                    <p className="muted-text">Загрузка логов…</p>
                ) : total === 0 ? (
                    <p className="muted-text">
                        Записей не найдено. Проверьте фильтры или выполните действие в системе.
                    </p>
                ) : (
                    <div className="admin-logs-list">
                        {items.map((entry, idx) => (
                            <AdminLogLine key={`${entry.ts}-${idx}`} entry={entry} />
                        ))}
                    </div>
                )}
            </section>
        </main>
    );
}
