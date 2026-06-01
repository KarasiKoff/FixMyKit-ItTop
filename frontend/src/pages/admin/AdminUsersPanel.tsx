import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import {
    adminResetUserPassword,
    createUser,
    fetchUsers,
    updateUser,
    type UserListItem,
} from '../../api/users';
import { IconCheck, IconClose, IconEdit, IconLock, IconPower, IconSync } from '../../components/admin/AdminDashboardIcons';
import { formatApiError } from '../../utils/formatApiError';

export function AdminUsersPanel() {
    const { showSuccess, showError } = useToast();
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    const [users, setUsers] = useState<UserListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [role, setRole] = useState<'admin' | 'sysadmin'>('sysadmin');
    const [search, setSearch] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editDraft, setEditDraft] = useState({ fullName: '', role: 'admin' as 'admin' | 'sysadmin' });
    const [resetUserId, setResetUserId] = useState<string | null>(null);
    const [resetPassword, setResetPassword] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetchUsers({ limit: 100 });
            setUsers(res.items);
        } catch (err) {
            showError(formatApiError(err));
        } finally {
            setLoading(false);
        }
    }, [showError]);

    useEffect(() => {
        void load();
    }, [load]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) {
            return users;
        }
        return users.filter(
            (u) => u.login.toLowerCase().includes(q) || u.name.toLowerCase().includes(q),
        );
    }, [users, search]);

    async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!isAdmin || !login.trim() || !password.trim()) {
            return;
        }
        try {
            await createUser({
                login: login.trim(),
                password: password,
                role,
                full_name: fullName.trim() || null,
            });
            setLogin('');
            setPassword('');
            setFullName('');
            setRole('sysadmin');
            showSuccess('Пользователь создан');
            await load();
        } catch (err) {
            showError(formatApiError(err));
        }
    }

    function startEdit(u: UserListItem) {
        setEditingId(u.id);
        setEditDraft({ fullName: u.name === u.login ? '' : u.name, role: u.role });
    }

    async function saveEdit() {
        if (!isAdmin || !editingId) {
            return;
        }
        const editingSelf = Boolean(user?.id && editingId === user.id);
        try {
            await updateUser(editingId, {
                full_name: editDraft.fullName.trim() || null,
                ...(editingSelf ? {} : { role: editDraft.role }),
            });
            setEditingId(null);
            showSuccess('Сохранено');
            await load();
        } catch (err) {
            showError(formatApiError(err));
        }
    }

    const isCurrentUser = (u: UserListItem) => Boolean(user?.id && u.id === user.id);

    async function toggleActive(u: UserListItem) {
        if (!isAdmin) {
            return;
        }
        if (isCurrentUser(u) && u.isActive) {
            showError('Нельзя отключить свою учётную запись');
            return;
        }
        try {
            await updateUser(u.id, { is_active: !u.isActive });
            showSuccess(u.isActive ? 'Пользователь отключён' : 'Пользователь включён');
            await load();
        } catch (err) {
            showError(formatApiError(err));
        }
    }

    async function applyPasswordReset() {
        if (!isAdmin || !resetUserId || !resetPassword.trim()) {
            return;
        }
        try {
            await adminResetUserPassword(resetUserId, resetPassword);
            setResetUserId(null);
            setResetPassword('');
            showSuccess('Пароль обновлён');
        } catch (err) {
            showError(formatApiError(err));
        }
    }

    const activeCount = filtered.filter((u) => u.isActive).length;

    return (
        <>
            <section className="card card--admin-block">
                <div className="admin-block-head">
                    <h3 className="admin-block-title">Пользователи</h3>
                    <div className="admin-stats-row">
                        <div className="admin-stat-pill">
                            <span className="admin-stat-value">{filtered.length}</span>
                            <span className="admin-stat-label">по запросу</span>
                        </div>
                        <div className="admin-stat-pill">
                            <span className="admin-stat-value">{users.length}</span>
                            <span className="admin-stat-label">всего</span>
                        </div>
                        <div className="admin-stat-pill">
                            <span className="admin-stat-value">{activeCount}</span>
                            <span className="admin-stat-label">активных</span>
                        </div>
                    </div>
                </div>

                <form className="admin-inline-form" onSubmit={handleCreate}>
                    <label className="admin-inline-field">
                        <span className="admin-inline-label">Логин</span>
                        <input value={login} onChange={(e) => setLogin(e.target.value)} required disabled={!isAdmin} />
                    </label>
                    <label className="admin-inline-field">
                        <span className="admin-inline-label">Пароль</span>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="new-password"
                            disabled={!isAdmin}
                        />
                    </label>
                    <label className="admin-inline-field">
                        <span className="admin-inline-label">ФИО</span>
                        <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Имя" disabled={!isAdmin} />
                    </label>
                    <label className="admin-inline-field admin-inline-field--narrow">
                        <span className="admin-inline-label">Роль</span>
                        <select value={role} onChange={(e) => setRole(e.target.value as typeof role)} disabled={!isAdmin}>
                            <option value="admin">Администратор</option>
                            <option value="sysadmin">Сисадмин</option>
                        </select>
                    </label>
                    <div className="admin-inline-actions">
                        <button type="submit" className="btn-primary" disabled={!isAdmin} title={!isAdmin ? 'Только администратор' : undefined}>
                            Создать
                        </button>
                    </div>
                </form>

                <div className="admin-table-toolbar">
                    <label className="admin-search-field">
                        <span className="admin-inline-label">Поиск</span>
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Логин или ФИО..."
                        />
                    </label>
                    <div className="admin-toolbar-actions admin-toolbar-actions--compact">
                        <span className="admin-inline-label admin-toolbar-label-spacer" aria-hidden="true">
                            {'\u00A0'}
                        </span>
                        <button
                            type="button"
                            className="btn-ghost admin-toolbar-btn btn-icon"
                            disabled={loading}
                            onClick={() => void load()}
                            aria-label="Обновить список"
                            title="Обновить список"
                        >
                            <IconSync />
                        </button>
                    </div>
                </div>

                {resetUserId ? (
                    <div className="card card--nested admin-password-reset">
                        <p>Новый пароль для пользователя</p>
                        <label>
                            <span className="admin-inline-label">Новый пароль</span>
                            <input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} />
                        </label>
                        <div className="admin-password-reset-actions">
                            <button type="button" className="btn-primary" disabled={!isAdmin} onClick={() => void applyPasswordReset()}>
                                Сохранить пароль
                            </button>
                            <button type="button" className="btn-ghost" onClick={() => setResetUserId(null)}>
                                Отмена
                            </button>
                        </div>
                    </div>
                ) : null}

                <div className="table-wrap admin-table-wrap">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th className="table-col-center">Логин</th>
                                <th className="table-col-center">ФИО</th>
                                <th className="table-col-center">Роль</th>
                                <th className="table-col-center">Статус</th>
                                <th className="table-col-center">Создан</th>
                                <th className="table-col-center table-col-actions table-col-actions--compact">Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="admin-table-empty">
                                        Загрузка…
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="admin-table-empty">
                                        Нет записей
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((u) => (
                                    <tr
                                        key={u.id}
                                        className={[
                                            !u.isActive ? 'row-disabled' : '',
                                            editingId === u.id ? 'admin-table-row--editing' : '',
                                        ]
                                            .filter(Boolean)
                                            .join(' ') || undefined}
                                    >
                                        <td className="table-col-center">{u.login}</td>
                                        <td className="table-col-center admin-table-cell--input">
                                            {editingId === u.id ? (
                                                <input
                                                    value={editDraft.fullName}
                                                    onChange={(e) => setEditDraft((d) => ({ ...d, fullName: e.target.value }))}
                                                    disabled={!isAdmin}
                                                />
                                            ) : (
                                                u.name || '—'
                                            )}
                                        </td>
                                        <td className="table-col-center admin-table-cell--input">
                                            {editingId === u.id ? (
                                                isCurrentUser(u) ? (
                                                    u.role === 'admin' ? (
                                                        'Администратор'
                                                    ) : (
                                                        'Сисадмин'
                                                    )
                                                ) : (
                                                    <select
                                                        value={editDraft.role}
                                                        onChange={(e) =>
                                                            setEditDraft((d) => ({ ...d, role: e.target.value as typeof d.role }))
                                                        }
                                                        disabled={!isAdmin}
                                                    >
                                                        <option value="admin">Администратор</option>
                                                        <option value="sysadmin">Сисадмин</option>
                                                    </select>
                                                )
                                            ) : u.role === 'admin' ? (
                                                'Администратор'
                                            ) : (
                                                'Сисадмин'
                                            )}
                                        </td>
                                        <td className="table-col-center">
                                            <span className={`status-badge ${u.isActive ? 'status-badge--on' : 'status-badge--off'}`}>
                                                {u.isActive ? 'активен' : 'отключён'}
                                            </span>
                                        </td>
                                        <td className="table-col-center table-col--nowrap">
                                            {new Date(u.createdAt).toLocaleString('ru-RU')}
                                        </td>
                                        <td className="table-col-center table-col-actions table-col-actions--compact">
                                            <div className="admin-row-actions admin-row-actions--users">
                                                {editingId === u.id ? (
                                                    <>
                                                        <button
                                                            type="button"
                                                            className="btn-icon-accent btn-compact btn-icon"
                                                            disabled={!isAdmin}
                                                            onClick={() => void saveEdit()}
                                                            aria-label="Сохранить"
                                                            title="Сохранить"
                                                        >
                                                            <IconCheck />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn-danger btn-compact btn-icon"
                                                            onClick={() => setEditingId(null)}
                                                            aria-label="Отмена"
                                                            title="Отмена"
                                                        >
                                                            <IconClose />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button
                                                            type="button"
                                                            className="btn-icon-accent btn-compact btn-icon"
                                                            disabled={!isAdmin}
                                                            onClick={() => startEdit(u)}
                                                            aria-label="Изменить"
                                                            title="Изменить"
                                                        >
                                                            <IconEdit />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={
                                                                u.isActive
                                                                    ? 'btn-danger btn-compact btn-icon'
                                                                    : 'btn-icon-accent btn-compact btn-icon'
                                                            }
                                                            disabled={!isAdmin || (isCurrentUser(u) && u.isActive)}
                                                            aria-label={u.isActive ? 'Отключить' : 'Включить'}
                                                            title={
                                                                isCurrentUser(u) && u.isActive
                                                                    ? 'Нельзя отключить свою учётную запись'
                                                                    : u.isActive
                                                                      ? 'Отключить'
                                                                      : 'Включить'
                                                            }
                                                            onClick={() => void toggleActive(u)}
                                                        >
                                                            <IconPower />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn-ghost btn-compact btn-icon"
                                                            disabled={!isAdmin}
                                                            onClick={() => setResetUserId(u.id)}
                                                            aria-label="Сброс пароля"
                                                            title="Сброс пароля"
                                                        >
                                                            <IconLock />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </>
    );
}
