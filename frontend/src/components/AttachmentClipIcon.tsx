import React from 'react';
import type { AttachmentClipTone } from '../utils/attachmentSyncDisplay';

function IconPaperclip() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M16.5 10.5V6.75a4.5 4.5 0 0 0-9 0v11.25a3 3 0 0 0 6 0V8.25"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
            />
        </svg>
    );
}

export function AttachmentClipIcon({
    tone,
    onSync,
    syncing = false,
    disabled = false,
}: {
    tone: AttachmentClipTone;
    onSync?: () => void;
    syncing?: boolean;
    disabled?: boolean;
}) {
    const title =
        tone === 'complete'
            ? 'Все файлы в Трекере'
            : tone === 'partial'
              ? 'Часть файлов не в Трекере — нажмите, чтобы синхронизировать'
              : 'Файлы не в Трекере — нажмите, чтобы синхронизировать';

    if (syncing) {
        return (
            <span
                className="attachment-clip-icon attachment-clip-icon--syncing"
                title="Синхронизация вложений…"
                aria-busy="true"
            >
                <span className="attachment-clip-icon__spinner" aria-hidden="true" />
            </span>
        );
    }

    if (onSync) {
        return (
            <button
                type="button"
                className={`attachment-clip-icon attachment-clip-icon--btn attachment-clip-icon--${tone}`}
                title={title}
                aria-label={title}
                disabled={disabled}
                onClick={(e) => {
                    e.stopPropagation();
                    onSync();
                }}
            >
                <IconPaperclip />
            </button>
        );
    }

    return (
        <span className={`attachment-clip-icon attachment-clip-icon--${tone}`} title={title}>
            <IconPaperclip />
        </span>
    );
}
