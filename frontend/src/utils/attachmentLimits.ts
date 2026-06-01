export type AttachmentLimits = {
    maxPerRequest: number;
    maxBytes: number;
};

/** Запасной вариант, пока API недоступен (совпадает с дефолтом бэкенда). */
export const DEFAULT_ATTACHMENT_LIMITS: AttachmentLimits = {
    maxPerRequest: 10,
    maxBytes: 1024 * 1024 * 1024,
};

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|heic|heif|bmp|tiff?)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|avi|mkv|ogv)$/i;

export function formatMaxAttachmentSize(bytes: number): string {
    const gb = 1024 ** 3;
    const mb = 1024 ** 2;
    if (bytes >= gb && bytes % gb === 0) {
        return `${bytes / gb} ГБ`;
    }
    if (bytes >= gb) {
        return `${(bytes / gb).toFixed(1).replace(/\.0$/, '')} ГБ`;
    }
    if (bytes >= mb && bytes % mb === 0) {
        return `${bytes / mb} МБ`;
    }
    if (bytes >= mb) {
        return `${Math.round(bytes / mb)} МБ`;
    }
    return `${bytes} Б`;
}

export function isAllowedAttachmentFile(file: File): boolean {
    const t = (file.type || '').toLowerCase();
    if (t.startsWith('image/') || t.startsWith('video/')) {
        if (t.startsWith('audio/')) {
            return false;
        }
        return true;
    }
    const name = file.name.toLowerCase();
    return IMAGE_EXT.test(name) || VIDEO_EXT.test(name);
}

export function attachmentPreviewKind(file: File): 'image' | 'video' | 'other' {
    const t = (file.type || '').toLowerCase();
    if (t.startsWith('video/') || VIDEO_EXT.test(file.name)) {
        return 'video';
    }
    if (t.startsWith('image/') || IMAGE_EXT.test(file.name)) {
        return 'image';
    }
    return 'other';
}
