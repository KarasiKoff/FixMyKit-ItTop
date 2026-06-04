import type { ActiveAnnouncement } from '../api/announcements';
import { renderAnnouncementMarkdownHtml } from '../utils/announcementMarkdown';

const SEVERITY_LABEL: Record<ActiveAnnouncement['severity'], string> = {
    info: 'Информация',
    warning: 'Внимание',
    danger: 'Важно',
};

function AnnouncementIcon({ severity }: { severity: ActiveAnnouncement['severity'] }) {
    if (severity === 'danger') {
        return (
            <svg className="site-announcement__icon-svg" viewBox="0 0 24 24" aria-hidden="true">
                <path
                    fill="currentColor"
                    d="M12 2 1 21h22L12 2zm0 4.2 7.35 12.8H4.65L12 6.2zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"
                />
            </svg>
        );
    }
    if (severity === 'warning') {
        return (
            <svg className="site-announcement__icon-svg" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor" d="M1 21h22L12 2 1 21zm11-3h-2v-2h2v2zm0-8h-2v5h2V10z" />
            </svg>
        );
    }
    return (
        <svg className="site-announcement__icon-svg" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 14h-2v-5h2v5zm0-7h-2V7h2v2z" />
        </svg>
    );
}

export type SiteAnnouncementCardProps = {
    item: Pick<ActiveAnnouncement, 'message' | 'severity' | 'audience' | 'link_url' | 'emoji'>;
    onDismiss?: () => void;
    dismissible?: boolean;
};

export function SiteAnnouncementCard({ item, onDismiss, dismissible = false }: SiteAnnouncementCardProps) {
    const showStaffBadge = item.audience === 'admins_only';
    const markdownHtml = renderAnnouncementMarkdownHtml(item.message);

    return (
        <article className={`site-announcement site-announcement--${item.severity}`} role="status">
            <span className="site-announcement__icon" aria-hidden="true">
                {item.emoji ? (
                    <span className="site-announcement__emoji">{item.emoji}</span>
                ) : (
                    <AnnouncementIcon severity={item.severity} />
                )}
            </span>
            <div className="site-announcement__body">
                <div className="site-announcement__head">
                    <span className="site-announcement__label">{SEVERITY_LABEL[item.severity]}</span>
                    {showStaffBadge ? (
                        <span className="site-announcement__staff-badge">Только для сотрудников</span>
                    ) : null}
                </div>
                <div
                    className="site-announcement__text site-announcement__markdown"
                    dangerouslySetInnerHTML={{ __html: markdownHtml }}
                />
                {item.link_url ? (
                    <a
                        className="site-announcement__link"
                        href={item.link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Подробнее
                    </a>
                ) : null}
            </div>
            {dismissible && onDismiss ? (
                <button
                    type="button"
                    className="site-announcement__dismiss"
                    aria-label="Скрыть объявление"
                    onClick={onDismiss}
                >
                    ×
                </button>
            ) : null}
        </article>
    );
}
