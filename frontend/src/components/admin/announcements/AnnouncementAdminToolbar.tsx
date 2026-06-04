import React from 'react';

type AnnouncementAdminToolbarProps = {
    busy: boolean;
    saving: boolean;
    resetting: boolean;
    onSave: () => void;
    onResetDismissals: () => void;
};

export function AnnouncementAdminToolbar({
    busy,
    saving,
    resetting,
    onSave,
    onResetDismissals,
}: AnnouncementAdminToolbarProps) {
    return (
        <footer className="card site-announcements-admin-toolbar">
            <p className="site-announcements-admin-toolbar__hint muted-text">
                «Сбросить закрыто» вернёт плашки тем, кто нажал × на важных объявлениях.
            </p>
            <div className="site-announcements-admin-toolbar__actions">
                <button
                    type="button"
                    className="btn-primary site-announcements-admin-toolbar__btn"
                    disabled={busy}
                    onClick={onSave}
                >
                    {saving ? 'Сохранение…' : 'Сохранить'}
                </button>
                <button
                    type="button"
                    className="btn-ghost site-announcements-admin-toolbar__btn"
                    disabled={busy}
                    onClick={onResetDismissals}
                >
                    {resetting ? 'Сброс…' : 'Сбросить «закрыто» у всех'}
                </button>
            </div>
        </footer>
    );
}
