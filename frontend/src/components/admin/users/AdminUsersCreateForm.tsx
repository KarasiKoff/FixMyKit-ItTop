import React, { useState } from 'react';
import { createUser } from '../../../api/users';
import { formatApiError } from '../../../utils/formatApiError';

type AdminUsersCreateFormProps = {
    disabled: boolean;
    onCreated: () => void;
    onError: (message: string) => void;
    onSuccess: (message: string) => void;
};

export function AdminUsersCreateForm({ disabled, onCreated, onError, onSuccess }: AdminUsersCreateFormProps) {
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [trackerUserEmail, setTrackerUserEmail] = useState('');
    const [role, setRole] = useState<'admin' | 'sysadmin'>('sysadmin');

    async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (disabled || !login.trim() || !password.trim()) {
            return;
        }
        try {
            await createUser({
                login: login.trim(),
                password,
                role,
                full_name: fullName.trim() || null,
                tracker_user_email: trackerUserEmail.trim() || null,
            });
            setLogin('');
            setPassword('');
            setFullName('');
            setTrackerUserEmail('');
            setRole('sysadmin');
            onSuccess('Пользователь создан');
            onCreated();
        } catch (err) {
            onError(formatApiError(err));
        }
    }

    return (
        <div className="admin-users-create">
            <h4 className="admin-users-create__title">Новый пользователь</h4>
            <form className="admin-inline-form admin-users-create__form" onSubmit={handleCreate}>
            <label className="admin-inline-field">
                <span className="admin-inline-label">Логин</span>
                <input value={login} onChange={(e) => setLogin(e.target.value)} required disabled={disabled} />
            </label>
            <label className="admin-inline-field">
                <span className="admin-inline-label">Пароль</span>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    disabled={disabled}
                />
            </label>
            <label className="admin-inline-field">
                <span className="admin-inline-label">ФИО</span>
                <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Имя"
                    disabled={disabled}
                />
            </label>
            <label className="admin-inline-field admin-inline-field--email">
                <span className="admin-inline-label">Email трекера</span>
                <input
                    type="email"
                    value={trackerUserEmail}
                    onChange={(e) => setTrackerUserEmail(e.target.value)}
                    placeholder="user@company.com"
                    disabled={disabled}
                />
            </label>
            <label className="admin-inline-field admin-inline-field--narrow">
                <span className="admin-inline-label">Роль</span>
                <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as typeof role)}
                    disabled={disabled}
                >
                    <option value="admin">Администратор</option>
                    <option value="sysadmin">Сисадмин</option>
                </select>
            </label>
            <div className="admin-inline-actions">
                <button
                    type="submit"
                    className="btn-primary btn-compact"
                    disabled={disabled}
                    title={disabled ? 'Только администратор' : undefined}
                >
                    Создать
                </button>
            </div>
            </form>
        </div>
    );
}
