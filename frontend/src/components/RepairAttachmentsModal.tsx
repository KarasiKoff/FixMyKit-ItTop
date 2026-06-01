import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    fetchRepairRequestAttachments,
    repairAttachmentContentUrl,
} from '../api/repairRequestAttachments';
import { getStoredAuthToken } from '../api/auth';
import type { TrackerAttachment } from '../types/repairRequest';
import { formatApiError } from '../utils/formatApiError';

type MediaStatus = 'idle' | 'loading' | 'ready' | 'error';

type MediaEntry = {
    status: MediaStatus;
    blobUrl: string | null;
};

async function loadBlobUrl(
    requestId: string,
    item: TrackerAttachment,
    variant: 'content' | 'thumbnail' = 'content',
): Promise<string> {
    const useThumb = variant === 'thumbnail' && item.hasThumbnail && item.kind === 'image';
    const url = repairAttachmentContentUrl(requestId, item.id, useThumb ? 'thumbnail' : 'content');
    const token = getStoredAuthToken();
    const headers: HeadersInit = {};
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(url, { headers });
    if (!res.ok) {
        throw new Error('load_failed');
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
}

function IconReload() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M4 12a8 8 0 0 1 13.2-6M20 12a8 8 0 0 1-13.2 6"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
            />
            <path
                d="M17 4h3v3M4 20v-3h3"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function LoadingSpinner({ label }: { label?: string }) {
    return (
        <div className="attachments-modal__spinner-wrap" role="status">
            <div className="attachments-modal__spinner" />
            {label ? <p className="attachments-modal__spinner-label">{label}</p> : null}
        </div>
    );
}

function emptyMediaMap(ids: string[]): Record<string, MediaEntry> {
    const next: Record<string, MediaEntry> = {};
    for (const id of ids) {
        next[id] = { status: 'idle', blobUrl: null };
    }
    return next;
}

function revokeMediaMap(map: Record<string, MediaEntry>) {
    for (const entry of Object.values(map)) {
        if (entry.blobUrl) {
            URL.revokeObjectURL(entry.blobUrl);
        }
    }
}

export function RepairAttachmentsModal({
    requestId,
    open,
    onClose,
}: {
    requestId: string;
    open: boolean;
    onClose: () => void;
}) {
    const [items, setItems] = useState<TrackerAttachment[]>([]);
    const [index, setIndex] = useState(0);
    const [listLoading, setListLoading] = useState(false);
    const [listError, setListError] = useState<string | null>(null);
    const [mediaById, setMediaById] = useState<Record<string, MediaEntry>>({});
    const [reloadingId, setReloadingId] = useState<string | null>(null);
    const mediaByIdRef = useRef(mediaById);
    mediaByIdRef.current = mediaById;

    const active = items[index] ?? null;
    const activeMedia = active ? mediaById[active.id] : undefined;

    const loadList = useCallback(async () => {
        setListLoading(true);
        setListError(null);
        try {
            const list = await fetchRepairRequestAttachments(requestId);
            setItems(list);
            setIndex(0);
            revokeMediaMap(mediaByIdRef.current);
            setMediaById(emptyMediaMap(list.map((i) => i.id)));
        } catch (err) {
            setListError(formatApiError(err));
            setItems([]);
            revokeMediaMap(mediaByIdRef.current);
            setMediaById({});
        } finally {
            setListLoading(false);
        }
    }, [requestId]);

    useEffect(() => {
        if (!open) {
            return;
        }
        void loadList();
    }, [open, loadList]);

    useEffect(() => {
        if (!open) {
            revokeMediaMap(mediaByIdRef.current);
            setMediaById({});
            setItems([]);
            setIndex(0);
            setListError(null);
        }
    }, [open]);

    useEffect(() => {
        return () => {
            revokeMediaMap(mediaByIdRef.current);
        };
    }, []);

    useEffect(() => {
        if (!open || items.length === 0) {
            return;
        }

        let cancelled = false;

        setMediaById((prev) => {
            const next = { ...prev };
            for (const item of items) {
                next[item.id] = { status: 'loading', blobUrl: prev[item.id]?.blobUrl ?? null };
            }
            return next;
        });

        void Promise.all(
            items.map(async (item) => {
                try {
                    const blobUrl = await loadBlobUrl(requestId, item, 'content');
                    if (cancelled) {
                        URL.revokeObjectURL(blobUrl);
                        return;
                    }
                    setMediaById((prev) => {
                        const old = prev[item.id]?.blobUrl;
                        if (old && old !== blobUrl) {
                            URL.revokeObjectURL(old);
                        }
                        return {
                            ...prev,
                            [item.id]: { status: 'ready', blobUrl },
                        };
                    });
                } catch {
                    if (cancelled) {
                        return;
                    }
                    setMediaById((prev) => ({
                        ...prev,
                        [item.id]: { status: 'error', blobUrl: null },
                    }));
                }
            }),
        );

        return () => {
            cancelled = true;
        };
    }, [open, items, requestId]);

    const reloadCurrent = useCallback(async () => {
        if (!active) {
            return;
        }
        const itemId = active.id;
        setReloadingId(itemId);
        setMediaById((prev) => {
            const old = prev[itemId]?.blobUrl;
            if (old) {
                URL.revokeObjectURL(old);
            }
            return { ...prev, [itemId]: { status: 'loading', blobUrl: null } };
        });
        try {
            const blobUrl = await loadBlobUrl(requestId, active, 'content');
            setMediaById((prev) => ({
                ...prev,
                [itemId]: { status: 'ready', blobUrl },
            }));
        } catch {
            setMediaById((prev) => ({
                ...prev,
                [itemId]: { status: 'error', blobUrl: null },
            }));
        } finally {
            setReloadingId(null);
        }
    }, [active, requestId]);

    useEffect(() => {
        if (!open) {
            return;
        }
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') {
                onClose();
            }
            if (e.key === 'ArrowLeft' && items.length > 1) {
                setIndex((i) => (i - 1 + items.length) % items.length);
            }
            if (e.key === 'ArrowRight' && items.length > 1) {
                setIndex((i) => (i + 1) % items.length);
            }
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, items.length, onClose]);

    if (!open) {
        return null;
    }

    const showStage = !listLoading && items.length > 0 && !listError;
    const isActiveLoading =
        activeMedia?.status === 'loading' || activeMedia?.status === 'idle' || reloadingId === active?.id;
    const isActiveReady = activeMedia?.status === 'ready' && activeMedia.blobUrl;
    const isActiveError = activeMedia?.status === 'error' && !isActiveLoading;

    return (
        <div className="attachments-modal-backdrop" role="presentation" onClick={onClose}>
            <div
                className="attachments-modal"
                role="dialog"
                aria-modal="true"
                aria-label="Вложения заявки"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="attachments-modal__header">
                    <h3>Вложения</h3>
                    <button type="button" className="btn-ghost" onClick={onClose}>
                        Закрыть
                    </button>
                </header>

                {listLoading ? (
                    <div className="attachments-modal__viewport">
                        <LoadingSpinner label="Загрузка списка…" />
                    </div>
                ) : null}

                {listError ? <p className="attachments-modal__error">{listError}</p> : null}

                {!listLoading && items.length === 0 && !listError ? (
                    <div className="attachments-modal__viewport">
                        <p className="attachments-modal__status">В Трекере пока нет вложений.</p>
                    </div>
                ) : null}

                {showStage ? (
                    <>
                        <div className="attachments-modal__viewport">
                            {isActiveLoading ? <LoadingSpinner label="Загрузка…" /> : null}
                            {isActiveError ? (
                                <div className="attachments-modal__load-failed">
                                    <p className="attachments-modal__load-failed-text">Не удалось загрузить</p>
                                    <button
                                        type="button"
                                        className="attachments-modal__reload-btn"
                                        aria-label="Повторить загрузку"
                                        disabled={reloadingId === active?.id}
                                        onClick={() => void reloadCurrent()}
                                    >
                                        <IconReload />
                                    </button>
                                </div>
                            ) : null}
                            {isActiveReady && active ? (
                                active.kind === 'video' ? (
                                    <video
                                        key={active.id}
                                        src={activeMedia.blobUrl!}
                                        controls
                                        className="attachments-modal__media"
                                    />
                                ) : (
                                    <img
                                        key={active.id}
                                        src={activeMedia.blobUrl!}
                                        alt={active.name}
                                        className="attachments-modal__media"
                                    />
                                )
                            ) : null}
                        </div>

                        <p className="attachments-modal__caption">
                            {active?.name ?? ''}
                            {items.length > 1 ? ` (${index + 1} / ${items.length})` : ''}
                        </p>

                        {items.length > 1 ? (
                            <div className="attachments-modal__footer">
                                <div className="attachments-modal__nav">
                                    <button
                                        type="button"
                                        className="btn-ghost"
                                        onClick={() => setIndex((i) => (i - 1 + items.length) % items.length)}
                                    >
                                        ←
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-ghost"
                                        onClick={() => setIndex((i) => (i + 1) % items.length)}
                                    >
                                        →
                                    </button>
                                </div>
                                <ul className="attachments-modal__thumbs">
                                    {items.map((item, i) => {
                                        const st = mediaById[item.id]?.status ?? 'idle';
                                        return (
                                            <li key={item.id}>
                                                <button
                                                    type="button"
                                                    className={`attachments-modal__thumb-btn${i === index ? ' attachments-modal__thumb-btn--active' : ''}${st === 'ready' ? ' attachments-modal__thumb-btn--ready' : ''}${st === 'error' ? ' attachments-modal__thumb-btn--error' : ''}`}
                                                    onClick={() => setIndex(i)}
                                                    title={item.name}
                                                >
                                                    <span className="attachments-modal__thumb-name">{item.name}</span>
                                                    {st === 'loading' || st === 'idle' ? (
                                                        <span className="attachments-modal__thumb-dot" aria-hidden="true" />
                                                    ) : null}
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        ) : null}
                    </>
                ) : null}
            </div>
        </div>
    );
}
