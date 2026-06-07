import { describe, expect, it } from 'vitest';

import {
    DEFAULT_ATTACHMENT_LIMITS,
    attachmentPreviewKind,
    formatMaxAttachmentSize,
    isAllowedAttachmentFile,
} from './attachmentLimits';

function file(name: string, type = ''): File {
    return new File(['x'], name, { type });
}

describe('formatMaxAttachmentSize', () => {
    it('formats whole gigabytes', () => {
        expect(formatMaxAttachmentSize(1024 ** 3)).toBe('1 ГБ');
        expect(formatMaxAttachmentSize(2 * 1024 ** 3)).toBe('2 ГБ');
    });

    it('formats megabytes', () => {
        expect(formatMaxAttachmentSize(10 * 1024 ** 2)).toBe('10 МБ');
    });
});

describe('isAllowedAttachmentFile', () => {
    it('allows images and videos by mime', () => {
        expect(isAllowedAttachmentFile(file('a.png', 'image/png'))).toBe(true);
        expect(isAllowedAttachmentFile(file('a.mp4', 'video/mp4'))).toBe(true);
    });

    it('rejects audio', () => {
        expect(isAllowedAttachmentFile(file('a.mp3', 'audio/mpeg'))).toBe(false);
    });

    it('allows by extension when mime empty', () => {
        expect(isAllowedAttachmentFile(file('photo.JPG'))).toBe(true);
        expect(isAllowedAttachmentFile(file('clip.webm'))).toBe(true);
    });

    it('rejects unknown extensions', () => {
        expect(isAllowedAttachmentFile(file('doc.pdf', 'application/pdf'))).toBe(false);
    });
});

describe('attachmentPreviewKind', () => {
    it('detects preview kind', () => {
        expect(attachmentPreviewKind(file('a.jpg', 'image/jpeg'))).toBe('image');
        expect(attachmentPreviewKind(file('a.mp4', 'video/mp4'))).toBe('video');
        expect(attachmentPreviewKind(file('a.pdf'))).toBe('other');
    });
});

describe('DEFAULT_ATTACHMENT_LIMITS', () => {
    it('matches backend defaults', () => {
        expect(DEFAULT_ATTACHMENT_LIMITS.maxPerRequest).toBe(10);
        expect(DEFAULT_ATTACHMENT_LIMITS.maxBytes).toBe(1024 ** 3);
    });
});
