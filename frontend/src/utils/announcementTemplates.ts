import type { AnnouncementSeverity } from '../api/announcements';

export type AnnouncementTemplate = {
    key: string;
    label: string;
    emoji: string;
    severity: AnnouncementSeverity;
    message: string;
};

export const ANNOUNCEMENT_TEMPLATES: AnnouncementTemplate[] = [
    {
        key: 'internet',
        label: 'Нет интернета',
        emoji: '📡',
        severity: 'warning',
        message:
            'Сегодня возможны **перебои с интернетом** в аудиториях. Заявки через сайт сохраняются и будут обработаны в ближайшее время.',
    },
    {
        key: 'maintenance',
        label: 'Техработы',
        emoji: '🔧',
        severity: 'warning',
        message:
            'Плановые **технические работы**. Часть сервисов может быть временно недоступна. Приносим извинения за неудобства.',
    },
    {
        key: 'tracker',
        label: 'Трекер недоступен',
        emoji: '📋',
        severity: 'danger',
        message:
            '**Яндекс Трекер** сейчас недоступен или отстаёт. Заявки принимаются на сайте, синхронизация с Трекером выполнится позже.',
    },
];

export const ANNOUNCEMENT_EMOJI_PRESETS = ['📡', '🔧', '📋', '⚠️', '🛠️', '💡', '🚧', '✅'] as const;
