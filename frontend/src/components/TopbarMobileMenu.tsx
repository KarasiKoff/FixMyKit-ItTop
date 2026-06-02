import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { UserAccountMenu } from './UserAccountMenu';

function IconMenu() {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M4 7h16M4 12h16M4 17h16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
            />
        </svg>
    );
}

const DRAWER_LINKS: { to: string; label: string; end?: boolean }[] = [
    { to: '/admin', label: 'Админка' },
    { to: '/requests', label: 'Все заявки' },
    { to: '/room-maps', label: 'Карта кабинетов' },
    { to: '/devices', label: 'Оборудование' },
    { to: '/repair', label: 'Заявка' },
    { to: '/scan', label: 'QR' },
];

export function TopbarMobileMenu() {
    const { user } = useAuth();
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!open) {
            return;
        }
        function onKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        }
        document.addEventListener('keydown', onKeyDown);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = prevOverflow;
        };
    }, [open]);

    if (!user) {
        return null;
    }

    const close = () => setOpen(false);

    return (
        <>
            <button
                type="button"
                className="topbar-menu-trigger"
                aria-expanded={open}
                aria-controls="topbar-mobile-drawer"
                aria-label="Открыть меню"
                onClick={() => setOpen(true)}
            >
                <IconMenu />
            </button>
            {open ? (
                <>
                    <button
                        type="button"
                        className="topbar-drawer-backdrop"
                        aria-label="Закрыть меню"
                        onClick={close}
                    />
                    <aside
                        id="topbar-mobile-drawer"
                        className="topbar-drawer"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Навигация"
                    >
                        <div className="topbar-drawer__head">
                            <h2 className="topbar-drawer__title">Меню</h2>
                            <div className="topbar-drawer__head-actions">
                                <UserAccountMenu variant="drawer" onDrawerClose={close} />
                                <button
                                    type="button"
                                    className="topbar-drawer__close btn-ghost btn-compact"
                                    aria-label="Закрыть"
                                    onClick={close}
                                >
                                    ×
                                </button>
                            </div>
                        </div>
                        <nav className="topbar-drawer__nav">
                            {DRAWER_LINKS.map(({ to, label, end }) => (
                                <NavLink
                                    key={to}
                                    to={to}
                                    end={end}
                                    className="topbar-drawer__link"
                                    onClick={close}
                                >
                                    {label}
                                </NavLink>
                            ))}
                        </nav>
                    </aside>
                </>
            ) : null}
        </>
    );
}
