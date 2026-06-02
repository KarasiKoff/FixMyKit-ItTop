import React, { useCallback, useEffect, useState } from 'react';
import { fetchRepairRequestComments, postRepairRequestComment } from '../api/repairRequests';
import { useToast } from '../context/ToastContext';
import { RepairRequestComment } from '../types/repairRequestComment';
import { formatApiError } from '../utils/formatApiError';
import { authorInitials, formatCommentTime, normalizeCommentBodyForDisplay } from '../utils/commentDisplay';

type Props = {
    requestId: string;
    hasTrackerTicket: boolean;
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
                    <time className="repair-comment__time" dateTime={item.createdAt} title={new Date(item.createdAt).toLocaleString('ru-RU')}>
                        {formatCommentTime(item.createdAt)}
                    </time>
                </header>
                <p className="repair-comment__text">{body}</p>
            </article>
        </li>
    );
}

export function RepairRequestComments({ requestId, hasTrackerTicket, refreshKey, embedded = false }: Props) {
    const { showSuccess, showError } = useToast();
    const [items, setItems] = useState<RepairRequestComment[]>([]);
    const [loading, setLoading] = useState(true);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [visibleCount, setVisibleCount] = useState(10);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const loaded = await fetchRepairRequestComments(requestId);
            const sorted = [...loaded].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setItems(sorted);
            setVisibleCount(10);
        } catch (err) {
            showError(formatApiError(err));
        } finally {
            setLoading(false);
        }
    }, [requestId, showError]);

    useEffect(() => {
        void load();
    }, [load, refreshKey]);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        const trimmed = text.trim();
        if (!trimmed || sending) {
            return;
        }
        if (!hasTrackerTicket) {
            showError('Сначала синхронизируйте заявку с Трекером');
            return;
        }
        setSending(true);
        try {
            const created = await postRepairRequestComment(requestId, trimmed);
            setItems((prev) => [created, ...prev]);
            setVisibleCount((prev) => Math.max(prev, 10));
            setText('');
            showSuccess('Комментарий отправлен');
        } catch (err) {
            showError(formatApiError(err));
        } finally {
            setSending(false);
        }
    }

    const visibleItems = items.slice(0, visibleCount);
    const canShowMore = items.length > visibleCount;

    const body = (
        <>
            <h3 className="repair-comments-block__title">Комментарии</h3>
            {!hasTrackerTicket ? (
                <p className="repair-comments-hint muted-text">
                    Чтобы писать комментарии, сначала синхронизируйте заявку с Yandex Tracker
                </p>
            ) : null}

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
                        hasTrackerTicket
                            ? 'Сообщение для заявителя и задачи в Трекере…'
                            : 'Сначала синхронизируйте с Трекером'
                    }
                    disabled={!hasTrackerTicket || sending}
                />
                <button
                    type="submit"
                    className="repair-pill-btn repair-pill-btn--filled"
                    disabled={!hasTrackerTicket || sending || !text.trim()}
                >
                    {sending ? 'Отправка…' : 'Отправить'}
                </button>
            </form>

            <div className="repair-comments-stream" aria-live="polite">
                {loading ? (
                    <p className="repair-comments-feed__placeholder muted-text">Загрузка…</p>
                ) : items.length === 0 ? (
                    <div className="repair-comments-empty">
                        <p className="repair-comments-empty__title">Пока пусто</p>
                        <p className="repair-comments-empty__hint muted-text">
                            Напишите комментарий — он появится здесь и в задаче Yandex Tracker
                        </p>
                    </div>
                ) : (
                    <>
                        <ul className="repair-comments-list">
                            {visibleItems.map((item) => (
                                <CommentItem key={item.id} item={item} />
                            ))}
                        </ul>
                        {canShowMore ? (
                            <button
                                type="button"
                                className="btn-ghost btn-compact repair-comments-show-more"
                                onClick={() => setVisibleCount((prev) => prev + 10)}
                            >
                                Показать ещё
                            </button>
                        ) : null}
                    </>
                )}
            </div>
        </>
    );

    if (embedded) {
        return <div className="repair-comments-embedded">{body}</div>;
    }

    return (
        <section className="card card-form card--narrow-device repair-comments-panel">
            {body}
        </section>
    );
}
