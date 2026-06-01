import React, { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import avatarImg from '../icon/account-avatar.svg';

export function UserAccountMenu() {
    const { user, signOut } = useAuth();
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!open) {
            return;
        }
        function onDocMouseDown(event: MouseEvent) {
            if (!rootRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', onDocMouseDown);
        return () => document.removeEventListener('mousedown', onDocMouseDown);
    }, [open]);

    if (!user) {
        return null;
    }

    const roleLabel = user.role === 'admin' ? 'Администратор' : 'Системный администратор';

    return (
        <div className="topbar-account" ref={rootRef}>
            <button
                type="button"
                className="topbar-account-trigger"
                aria-expanded={open}
                aria-haspopup="true"
                aria-label={`Меню аккаунта (${user.login ?? user.name})`}
                onClick={() => setOpen((v) => !v)}
            >
                <img src={avatarImg} alt="" className="topbar-account-avatar" />
            </button>
            {open ? (
                <div className="topbar-account-dropdown" role="menu">
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
                            onClick={() => setOpen(false)}
                        >
                            Сменить пароль
                        </NavLink>
                        <button
                            type="button"
                            className="btn-ghost btn-compact topbar-account-action"
                            onClick={() => {
                                setOpen(false);
                                signOut();
                            }}
                        >
                            Выйти
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
