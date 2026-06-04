import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AnnouncementAdminToolbar } from '../../components/admin/announcements/AnnouncementAdminToolbar';
import { AnnouncementSlotEditor } from '../../components/admin/announcements/AnnouncementSlotEditor';
import { useAdminAnnouncements } from '../../hooks/useAdminAnnouncements';
import { useAuth } from '../../hooks/useAuth';

export function AdminAnnouncementsPage() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const {
        slots,
        loading,
        saving,
        resetting,
        clock,
        busy,
        updateSlot,
        handleSave,
        handleResetDismissals,
    } = useAdminAnnouncements(isAdmin);

    if (!isAdmin) {
        return <Navigate to="/admin" replace />;
    }

    return (
        <main className="page page--wide site-announcements-admin-page">
            <div className="admin-page-head admin-page-head--edges">
                <Link to="/admin" className="admin-back-link">
                    ← В админку
                </Link>
            </div>
            <h2 className="page-title site-announcements-admin-page__title">Объявления на сайте</h2>

            {loading ? (
                <p className="muted-text">Загрузка…</p>
            ) : (
                <>
                    <div className="site-announcements-admin-grid">
                        <AnnouncementSlotEditor
                            slot={1}
                            value={slots[0]}
                            disabled={busy}
                            clock={clock}
                            onChange={(next) => updateSlot(1, next)}
                        />
                        <AnnouncementSlotEditor
                            slot={2}
                            value={slots[1]}
                            disabled={busy}
                            clock={clock}
                            onChange={(next) => updateSlot(2, next)}
                        />
                    </div>
                    <AnnouncementAdminToolbar
                        busy={busy}
                        saving={saving}
                        resetting={resetting}
                        onSave={() => void handleSave()}
                        onResetDismissals={() => void handleResetDismissals()}
                    />
                </>
            )}
        </main>
    );
}
