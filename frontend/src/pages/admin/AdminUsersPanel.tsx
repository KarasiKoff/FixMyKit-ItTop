import React, { useCallback, useMemo } from 'react';
import { fetchUsers, type UserListItem } from '../../api/users';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar';
import { AdminUsersCreateForm } from '../../components/admin/users/AdminUsersCreateForm';
import { AdminUsersTable } from '../../components/admin/users/AdminUsersTable';
import { ListPagination } from '../../components/ListPagination';
import { useAuth } from '../../hooks/useAuth';
import { usePaginatedList } from '../../hooks/usePaginatedList';
import { useToast } from '../../hooks/useToast';
import { formatApiError } from '../../utils/formatApiError';

type UserFilters = { search: string };

const EMPTY_USER_FILTERS: UserFilters = { search: '' };

export function AdminUsersPanel() {
    const { showSuccess, showError } = useToast();
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    const loadUsers = useCallback(
        async ({ filters, page: p, pageSize: ps }: { filters: UserFilters; page: number; pageSize: number }) => {
            try {
                return await fetchUsers({
                    search: filters.search.trim() || undefined,
                    limit: ps,
                    offset: (p - 1) * ps,
                });
            } catch (err) {
                showError(formatApiError(err));
                throw err;
            }
        },
        [showError],
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
    } = usePaginatedList<UserListItem, UserFilters, 'login'>({
        emptyFilters: EMPTY_USER_FILTERS,
        defaultSort: 'login',
        defaultPageSize: 20,
        load: loadUsers,
    });

    const activeOnPage = useMemo(() => items.filter((u) => u.isActive).length, [items]);

    return (
        <section className="card card--admin-block">
            <div className="admin-block-head">
                <h3 className="admin-block-title">Пользователи</h3>
                <div className="admin-stats-row">
                    <div className="admin-stat-pill">
                        <span className="admin-stat-value">{items.length}</span>
                        <span className="admin-stat-label">на странице</span>
                    </div>
                    <div className="admin-stat-pill">
                        <span className="admin-stat-value">{total}</span>
                        <span className="admin-stat-label">всего</span>
                    </div>
                    <div className="admin-stat-pill">
                        <span className="admin-stat-value">{activeOnPage}</span>
                        <span className="admin-stat-label">активных</span>
                    </div>
                </div>
            </div>

            <AdminUsersCreateForm
                disabled={!isAdmin}
                onCreated={() => void reload()}
                onError={(msg) => showError(msg)}
                onSuccess={showSuccess}
            />

            <AdminFilterBar
                embedded
                filtersPending={filtersPending}
                onApply={applyFilters}
                hint="Поиск по логину или ФИО на сервере."
                actions={
                    <button
                        type="button"
                        className="btn-ghost btn-compact"
                        disabled={fetching}
                        onClick={() => void reload()}
                    >
                        {fetching ? 'Загрузка…' : 'Обновить'}
                    </button>
                }
            >
                <label className="admin-search-field">
                    <span className="admin-inline-label">Поиск</span>
                    <input
                        value={draftFilters.search}
                        onChange={(e) => setDraftFilters((p) => ({ ...p, search: e.target.value }))}
                        placeholder="Логин или ФИО…"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && filtersPending) {
                                applyFilters();
                            }
                        }}
                    />
                </label>
            </AdminFilterBar>

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

            <AdminUsersTable
                users={items}
                fetching={fetching}
                isAdmin={isAdmin}
                currentUserId={user?.id}
                onReload={() => void reload()}
                onError={(msg) => showError(msg)}
                onSuccess={showSuccess}
            />
        </section>
    );
}
