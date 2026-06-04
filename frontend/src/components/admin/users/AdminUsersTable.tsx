import React, { useState } from 'react';
import { adminResetUserPassword, updateUser, type UserListItem } from '../../../api/users';
import { formatApiError } from '../../../utils/formatApiError';
import {
    IconCheck,
    IconClose,
    IconEdit,
    IconLock,
    IconPower,
} from '../AdminDashboardIcons';

type AdminUsersTableProps = {
    users: UserListItem[];
    fetching: boolean;
    isAdmin: boolean;
    currentUserId: string | undefined;
    onReload: () => void;
    onError: (message: string) => void; // уже отформатировано
    onSuccess: (message: string) => void;
};

export function AdminUsersTable({
    users,
    fetching,
    isAdmin,
    currentUserId,
    onReload,
    onError,
    onSuccess,
}: AdminUsersTableProps) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editDraft, setEditDraft] = useState({ fullName: '', role: 'admin' as 'admin' | 'sysadmin' });
    const [resetUserId, setResetUserId] = useState<string | null>(null);
    const [resetPassword, setResetPassword] = useState('');

    function startEdit(u: UserListItem) {
        setEditingId(u.id);
        setEditDraft({ fullName: u.name === u.login ? '' : u.name, role: u.role });
    }

    const isCurrentUser = (u: UserListItem) => Boolean(currentUserId && u.id === currentUserId);

    async function saveEdit() {
        if (!isAdmin || !editingId) {
            return;
        }
        const editingSelf = Boolean(currentUserId && editingId === currentUserId);
        try {
            await updateUser(editingId, {
                full_name: editDraft.fullName.trim() || null,
                ...(editingSelf ? {} : { role: editDraft.role }),
            });
            setEditingId(null);
            onSuccess('Сохранено');
            onReload();
        } catch (err) {
            onError(formatApiError(err));
        }
    }

    async function toggleActive(u: UserListItem) {
        if (!isAdmin) {
            return;
        }
        if (isCurrentUser(u) && u.isActive) {
            onError('Нельзя отключить свою учётную запись');
            return;
        }
        try {
            await updateUser(u.id, { is_active: !u.isActive });
            onSuccess(u.isActive ? 'Пользователь отключён' : 'Пользователь включён');
            onReload();
        } catch (err) {
            onError(formatApiError(err));
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
            onSuccess('Пароль обновлён');
        } catch (err) {
            onError(formatApiError(err));
        }
    }

    return (
        <>
            {resetUserId ? (
                <div className="card card--nested admin-password-reset">
                    <p>Новый пароль для пользователя</p>
                    <label>
                        <span className="admin-inline-label">Новый пароль</span>
                        <input
                            type="password"
                            value={resetPassword}
                            onChange={(e) => setResetPassword(e.target.value)}
                        />
                    </label>
                    <div className="admin-password-reset-actions">
                        <button
                            type="button"
                            className="btn-primary"
                            disabled={!isAdmin}
                            onClick={() => void applyPasswordReset()}
                        >
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
                        {fetching && users.length === 0 ? (
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
                            users.map((u) => (
                                <tr
                                    key={u.id}
                                    className={
                                        [
                                            !u.isActive ? 'row-disabled' : '',
                                            editingId === u.id ? 'admin-table-row--editing' : '',
                                        ]
                                            .filter(Boolean)
                                            .join(' ') || undefined
                                    }
                                >
                                    <td className="table-col-center">{u.login}</td>
                                    <td className="table-col-center admin-table-cell--input">
                                        {editingId === u.id ? (
                                            <input
                                                value={editDraft.fullName}
                                                onChange={(e) =>
                                                    setEditDraft((d) => ({ ...d, fullName: e.target.value }))
                                                }
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
                                                        setEditDraft((d) => ({
                                                            ...d,
                                                            role: e.target.value as typeof d.role,
                                                        }))
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
                                        <span
                                            className={`status-badge ${u.isActive ? 'status-badge--on' : 'status-badge--off'}`}
                                        >
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
        </>
    );
}
