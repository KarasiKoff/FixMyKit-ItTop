import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

type Props = {
    onClose?: () => void;
};

export function AccountMenuContent({ onClose }: Props) {
    const { user, signOut } = useAuth();

    if (!user) {
        return null;
    }

    const roleLabel = user.role === 'admin' ? 'Администратор' : 'Системный администратор';

    return (
        <>
            <div className="topbar-account-meta">
                <div>
                    <span className="muted-text topbar-account-meta-label">Логин</span>
                    {user.login ?? '—'}
                </div>
                <div>
                    <span className="muted-text topbar-account-meta-label">Отображаемое имя</span>
                    {user.name}
                </div>
                <div>
                    <span className="muted-text topbar-account-meta-label">Роль</span>
                    {roleLabel}
                </div>
            </div>
            <div className="topbar-account-actions">
                <NavLink
                    to="/admin/password"
                    className="btn-ghost btn-compact topbar-account-action"
                    role="menuitem"
                    onClick={onClose}
                >
                    Сменить пароль
                </NavLink>
                <button
                    type="button"
                    className="btn-ghost btn-compact topbar-account-action"
                    onClick={() => {
                        onClose?.();
                        signOut();
                    }}
                >
                    Выйти
                </button>
            </div>
        </>
    );
}
