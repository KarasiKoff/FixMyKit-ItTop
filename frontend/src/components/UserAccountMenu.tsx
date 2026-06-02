import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { authorInitials } from '../utils/commentDisplay';
import { AccountMenuContent } from './AccountMenuContent';

type Props = {
    variant?: 'topbar' | 'drawer';
    onDrawerClose?: () => void;
};

export function UserAccountMenu({ variant = 'topbar', onDrawerClose }: Props) {
    const { user } = useAuth();
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

    const displayName = user.name?.trim() || user.login?.trim() || 'Пользователь';
    const rootClass =
        variant === 'drawer' ? 'topbar-account topbar-account--drawer' : 'topbar-account topbar-account--desktop';

    function closeDropdown() {
        setOpen(false);
    }

    function closeDropdownAndDrawer() {
        closeDropdown();
        if (variant === 'drawer') {
            onDrawerClose?.();
        }
    }

    return (
        <div className={rootClass} ref={rootRef}>
            <button
                type="button"
                className="topbar-account-trigger"
                aria-expanded={open}
                aria-haspopup="true"
                aria-label={`Меню аккаунта (${user.login ?? user.name})`}
                onClick={() => setOpen((v) => !v)}
            >
                <span className="topbar-account-avatar" aria-hidden="true">
                    {authorInitials(displayName)}
                </span>
            </button>
            {open ? (
                <div className="topbar-account-dropdown" role="menu">
                    <AccountMenuContent onClose={closeDropdownAndDrawer} />
                </div>
            ) : null}
        </div>
    );
}
