import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ANNOUNCEMENT_POLL_MS, fetchActiveAnnouncements, type ActiveAnnouncement } from '../api/announcements';
import { useAuth } from '../hooks/useAuth';
import { dismissAnnouncement, isAnnouncementDismissed } from '../utils/announcementDismiss';
import { ConfirmDialog } from './ConfirmDialog';
import { SiteAnnouncementCard } from './SiteAnnouncementCard';

function filterDismissed(items: ActiveAnnouncement[], dismissEpoch: number): ActiveAnnouncement[] {
    void dismissEpoch;
    return items.filter((item) => !isAnnouncementDismissed(item.slot, item.dismiss_version ?? 1));
}

export function SiteAnnouncementBanners() {
    const { pathname } = useLocation();
    const { isAuthenticated, isLoading, user } = useAuth();
    const [items, setItems] = useState<ActiveAnnouncement[]>([]);
    const [carouselIndex, setCarouselIndex] = useState(0);
    const [entered, setEntered] = useState(false);
    const [dismissVersion, setDismissVersion] = useState(0);
    const [dismissConfirmOpen, setDismissConfirmOpen] = useState(false);
    const [pendingDismiss, setPendingDismiss] = useState<ActiveAnnouncement | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetchActiveAnnouncements();
            setItems(res.items);
        } catch {
            setItems([]);
        }
    }, []);

    useEffect(() => {
        if (isLoading) {
            return;
        }
        void load();
        const timer = window.setInterval(() => void load(), ANNOUNCEMENT_POLL_MS);
        return () => window.clearInterval(timer);
    }, [isLoading, isAuthenticated, user?.role, load]);

    useEffect(() => {
        setEntered(true);
    }, []);

    const visible = useMemo(() => filterDismissed(items, dismissVersion), [items, dismissVersion]);

    useEffect(() => {
        if (carouselIndex >= visible.length) {
            setCarouselIndex(Math.max(0, visible.length - 1));
        }
    }, [visible.length, carouselIndex]);

    function closeDismissConfirm() {
        setDismissConfirmOpen(false);
        setPendingDismiss(null);
    }

    function requestDismiss(item: ActiveAnnouncement) {
        if (item.severity === 'danger') {
            setPendingDismiss(item);
            setDismissConfirmOpen(true);
            return;
        }
        dismissAnnouncement(item.slot, item.dismiss_version ?? 1);
        setDismissVersion((v) => v + 1);
    }

    function confirmDismiss() {
        if (!pendingDismiss) {
            return;
        }
        dismissAnnouncement(pendingDismiss.slot, pendingDismiss.dismiss_version ?? 1);
        closeDismissConfirm();
        setDismissVersion((v) => v + 1);
    }

    if (pathname === '/login') {
        return null;
    }

    if (visible.length === 0 && !dismissConfirmOpen) {
        return null;
    }

    const showCarousel = visible.length > 1;
    const active = visible[carouselIndex] ?? visible[0];

    return (
        <>
            {visible.length > 0 ? (
                <div
                    className={`site-announcements${entered ? ' site-announcements--entered' : ''}`}
                    role="region"
                    aria-label="Объявления"
                >
                    <div className="site-announcements__inner">
                        {showCarousel ? (
                            <div className="site-announcements-carousel">
                                <div className="site-announcements-carousel__nav">
                                    <button
                                        type="button"
                                        className="site-announcements-carousel__arrow"
                                        aria-label="Предыдущее объявление"
                                        disabled={carouselIndex <= 0}
                                        onClick={() => setCarouselIndex((i) => Math.max(0, i - 1))}
                                    >
                                        ‹
                                    </button>
                                    <span className="site-announcements-carousel__counter">
                                        {carouselIndex + 1} / {visible.length}
                                    </span>
                                    <button
                                        type="button"
                                        className="site-announcements-carousel__arrow"
                                        aria-label="Следующее объявление"
                                        disabled={carouselIndex >= visible.length - 1}
                                        onClick={() => setCarouselIndex((i) => Math.min(visible.length - 1, i + 1))}
                                    >
                                        ›
                                    </button>
                                </div>
                                <div className="site-announcements-carousel__dots" role="tablist">
                                    {visible.map((item, idx) => (
                                        <button
                                            key={item.slot}
                                            type="button"
                                            role="tab"
                                            aria-selected={idx === carouselIndex}
                                            aria-label={`Объявление ${idx + 1}`}
                                            className={
                                                idx === carouselIndex
                                                    ? 'site-announcements-carousel__dot site-announcements-carousel__dot--active'
                                                    : 'site-announcements-carousel__dot'
                                            }
                                            onClick={() => setCarouselIndex(idx)}
                                        />
                                    ))}
                                </div>
                            </div>
                        ) : null}
                        {active ? (
                            <SiteAnnouncementCard item={active} dismissible onDismiss={() => requestDismiss(active)} />
                        ) : null}
                    </div>
                </div>
            ) : null}

            <ConfirmDialog
                open={dismissConfirmOpen && pendingDismiss !== null}
                title="Скрыть важное объявление?"
                message={
                    <p>Плашка исчезнет только у вас в этом браузере. Администратор может снова показать её всем.</p>
                }
                confirmLabel="Скрыть"
                cancelLabel="Оставить"
                confirmVariant="danger"
                onConfirm={confirmDismiss}
                onCancel={closeDismissConfirm}
            />
        </>
    );
}
