import React, { useCallback, useEffect, useRef, useState } from 'react';
import { fetchRepairRequestComments, postRepairRequestComment } from '../api/repairRequests';
import type { PublicIntegration } from '../types/integration';
import { useToast } from '../hooks/useToast';
import { RepairRequestComment } from '../types/repairRequestComment';
import {
    commentAppearsInIntegrationHint,
    integrationDisplayName,
    syncWithIntegrationLabel,
} from '../utils/externalIntegrationCopy';
import { formatApiError } from '../utils/formatApiError';
import { authorInitials, formatCommentTime, normalizeCommentBodyForDisplay } from '../utils/commentDisplay';

type Props = {
    requestId: string;
    integration: PublicIntegration;
    canPostComment: boolean;
    refreshKey?: string;
    embedded?: boolean;
};

function CommentItem({ item }: { item: RepairRequestComment }) {
    const author = item.authorDisplayName || item.authorLogin || 'Пользователь';
    const body = normalizeCommentBodyForDisplay(item.body);
    return (
        <li className="repair-comment">
            <div className="repair-comment__avatar" aria-hidden="true">
                {authorInitials(author)}
            </div>
            <article className="repair-comment__bubble">
                <header className="repair-comment__head">
                    <span className="repair-comment__author">{author}</span>
                    <time
                        className="repair-comment__time"
                        dateTime={item.createdAt}
                        title={new Date(item.createdAt).toLocaleString('ru-RU')}
                    >
                        {formatCommentTime(item.createdAt)}
                    </time>
                </header>
                <p className="repair-comment__text">{body}</p>
            </article>
        </li>
    );
}

export function RepairRequestComments({
    requestId,
    integration,
    canPostComment,
    refreshKey,
    embedded = false,
}: Props) {
    const { showSuccess, showError } = useToast();
    const [items, setItems] = useState<RepairRequestComment[]>([]);
    const [loading, setLoading] = useState(true);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const prevItemsLengthRef = useRef(0);
    const integrationName = integrationDisplayName(integration);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const loaded = await fetchRepairRequestComments(requestId);
            const sorted = [...loaded].sort(
                (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
            );
            setItems(sorted);
        } catch (err) {
            showError(formatApiError(err));
        } finally {
            setLoading(false);
        }
    }, [requestId, showError]);

    useEffect(() => {
        void load();
    }, [load, refreshKey]);

    useEffect(() => {
        if (loading) {
            return;
        }
        if (items.length > prevItemsLengthRef.current) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        prevItemsLengthRef.current = items.length;
    }, [items.length, loading]);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        const trimmed = text.trim();
        if (!trimmed || sending) {
            return;
        }
        if (!canPostComment) {
            showError(`Сначала синхронизируйте заявку с ${integrationName}`);
            return;
        }
        setSending(true);
        try {
            const created = await postRepairRequestComment(requestId, trimmed);
            setItems((prev) => [...prev, created]);
            setText('');
            showSuccess('Комментарий отправлен');
            requestAnimationFrame(() => {
                bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            });
        } catch (err) {
            showError(formatApiError(err));
        } finally {
            setSending(false);
        }
    }

    const body = (
        <>
            <h3 className="repair-comments-block__title">Комментарии</h3>
            {integration.enabled && !canPostComment ? (
                <p className="repair-comments-hint muted-text">
                    Чтобы писать комментарии, сначала синхронизируйте заявку с {integrationName}
                </p>
            ) : null}

            <div className="repair-comments-stream" aria-live="polite">
                {loading ? (
                    <p className="repair-comments-feed__placeholder muted-text">Загрузка…</p>
                ) : items.length === 0 ? (
                    <div className="repair-comments-empty">
                        <p className="repair-comments-empty__title">Пока пусто</p>
                        <p className="repair-comments-empty__hint muted-text">
                            {integration.enabled
                                ? commentAppearsInIntegrationHint(integration)
                                : 'Напишите комментарий — он появится в ленте заявки'}
                        </p>
                    </div>
                ) : (
                    <ul className="repair-comments-list">
                        {items.map((item) => (
                            <CommentItem key={item.id} item={item} />
                        ))}
                    </ul>
                )}
            </div>

            <form className="repair-comments-compose" onSubmit={(e) => void submit(e)}>
                <label className="repair-comments-compose__label" htmlFor="repair-comment-input">
                    Новый комментарий
                </label>
                <textarea
                    id="repair-comment-input"
                    className="repair-comments-compose__input"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={3}
                    placeholder={
                        canPostComment
                            ? integration.enabled
                                ? `Сообщение для заявителя и задачи в ${integrationName}…`
                                : 'Сообщение для заявителя…'
                            : syncWithIntegrationLabel(integration)
                    }
                    disabled={!canPostComment || sending}
                />
                <button
                    type="submit"
                    className="repair-pill-btn repair-pill-btn--filled"
                    disabled={!canPostComment || sending || !text.trim()}
                >
                    {sending ? 'Отправка…' : 'Отправить'}
                </button>
            </form>
            <div ref={bottomRef} className="repair-comments-bottom-anchor" aria-hidden="true" />
        </>
    );

    if (embedded) {
        return <div className="repair-comments-embedded">{body}</div>;
    }

    return <section className="card card-form card--narrow-device repair-comments-panel">{body}</section>;
}
