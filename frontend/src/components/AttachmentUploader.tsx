import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAttachmentLimits } from '../context/AttachmentLimitsContext';
import { attachmentPreviewKind, formatMaxAttachmentSize, isAllowedAttachmentFile } from '../utils/attachmentLimits';

export type AttachmentDraft = {
    id: string;
    file: File;
    previewUrl: string | null;
    kind: 'image' | 'video' | 'other';
};

function newDraft(file: File): AttachmentDraft {
    const kind = attachmentPreviewKind(file);
    const previewUrl = kind === 'image' || kind === 'video' ? URL.createObjectURL(file) : null;
    return { id: `${file.name}-${file.size}-${file.lastModified}`, file, previewUrl, kind };
}

export function AttachmentUploader({
    files,
    onChange,
    maxFiles: maxFilesOverride,
    maxBytes: maxBytesOverride,
    disabled = false,
    label = 'Фото и видео',
}: {
    files: AttachmentDraft[];
    onChange: (next: AttachmentDraft[]) => void;
    maxFiles?: number;
    maxBytes?: number;
    disabled?: boolean;
    label?: string;
}) {
    const { limits } = useAttachmentLimits();
    const maxFiles = maxFilesOverride ?? limits.maxPerRequest;
    const maxBytes = maxBytesOverride ?? limits.maxBytes;
    const maxSizeLabel = formatMaxAttachmentSize(maxBytes);

    const inputRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [trimNotice, setTrimNotice] = useState<string | null>(null);

    const remaining = maxFiles - files.length;

    useEffect(() => {
        if (files.length > maxFiles) {
            const kept = files.slice(0, maxFiles);
            const removed = files.slice(maxFiles);
            for (const item of removed) {
                if (item.previewUrl) {
                    URL.revokeObjectURL(item.previewUrl);
                }
            }
            onChange(kept);
            setTrimNotice(`Лимит ${maxFiles} файлов: лишние удалены.`);
        }
    }, [maxFiles, files, onChange]);

    useEffect(() => {
        return () => {
            for (const item of files) {
                if (item.previewUrl) {
                    URL.revokeObjectURL(item.previewUrl);
                }
            }
        };
    }, [files]);

    const hint = useMemo(() => {
        return `До ${maxFiles} файлов, максимум ${maxSizeLabel} каждый. Фото и видео.`;
    }, [maxFiles, maxSizeLabel]);

    function addFiles(list: FileList | File[]) {
        setError(null);
        setTrimNotice(null);
        const incoming = Array.from(list);
        if (incoming.length === 0) {
            return;
        }

        const slotsLeft = maxFiles - files.length;
        if (slotsLeft <= 0) {
            return;
        }

        const batch = incoming.slice(0, slotsLeft);
        const droppedCount = incoming.length - batch.length;

        const next = [...files];
        let added = 0;
        for (const file of batch) {
            if (!isAllowedAttachmentFile(file)) {
                setError('Допустимы только фото и видео.');
                return;
            }
            if (file.size > maxBytes) {
                setError(`Файл больше ${maxSizeLabel}.`);
                return;
            }
            const draft = newDraft(file);
            if (next.some((d) => d.id === draft.id)) {
                continue;
            }
            next.push(draft);
            added += 1;
        }

        if (added > 0 || droppedCount > 0) {
            onChange(next);
        }
        if (droppedCount > 0) {
            setTrimNotice(`Лимит ${maxFiles} файлов: не добавлено ${droppedCount}.`);
        }
    }

    function removeDraft(id: string) {
        setTrimNotice(null);
        const target = files.find((f) => f.id === id);
        if (target?.previewUrl) {
            URL.revokeObjectURL(target.previewUrl);
        }
        onChange(files.filter((f) => f.id !== id));
    }

    return (
        <div className="attachment-uploader">
            <div className="attachment-uploader__head">
                <span className="attachment-uploader__label">{label}</span>
                <span className="attachment-uploader__hint">{hint}</span>
            </div>
            {files.length > 0 ? (
                <ul className="attachment-uploader__previews">
                    {files.map((item) => (
                        <li key={item.id} className="attachment-uploader__preview">
                            {item.kind === 'image' && item.previewUrl ? (
                                <img src={item.previewUrl} alt="" className="attachment-uploader__thumb" />
                            ) : item.kind === 'video' && item.previewUrl ? (
                                <video
                                    src={item.previewUrl}
                                    className="attachment-uploader__thumb"
                                    muted
                                    playsInline
                                    preload="metadata"
                                />
                            ) : (
                                <span className="attachment-uploader__file-icon" aria-hidden="true">
                                    ▶
                                </span>
                            )}
                            <span className="attachment-uploader__name" title={item.file.name}>
                                {item.file.name}
                            </span>
                            <button
                                type="button"
                                className="attachment-uploader__remove"
                                disabled={disabled}
                                onClick={() => removeDraft(item.id)}
                                aria-label={`Удалить ${item.file.name}`}
                            >
                                ×
                            </button>
                        </li>
                    ))}
                </ul>
            ) : null}
            {remaining > 0 ? (
                <div
                    className="attachment-uploader__dropzone"
                    role="button"
                    tabIndex={0}
                    onClick={() => inputRef.current?.click()}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            inputRef.current?.click();
                        }
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                        e.preventDefault();
                        if (!disabled) {
                            addFiles(e.dataTransfer.files);
                        }
                    }}
                >
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        hidden
                        disabled={disabled}
                        onChange={(e) => {
                            if (e.target.files) {
                                addFiles(e.target.files);
                            }
                            e.target.value = '';
                        }}
                    />
                    <span>Добавить файлы ({remaining} осталось)</span>
                </div>
            ) : null}
            <p className="attachment-uploader__privacy" role="note">
                Пожалуйста, убедитесь, что на загружаемых скриншотах и фото нет конфиденциальной информации, паролей или
                персональных данных третьих лиц.
            </p>
            {trimNotice ? <p className="attachment-uploader__notice">{trimNotice}</p> : null}
            {error ? <p className="attachment-uploader__error">{error}</p> : null}
        </div>
    );
}

export function draftsToFiles(drafts: AttachmentDraft[]): File[] {
    return drafts.map((d) => d.file);
}
