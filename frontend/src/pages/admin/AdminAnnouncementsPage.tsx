import React, { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
    ANNOUNCEMENT_MESSAGE_MAX,
    fetchAdminAnnouncements,
    resetAnnouncementDismissals,
    saveAdminAnnouncements,
    toAnnouncementSavePayload,
    type AnnouncementSeverity,
    type SiteAnnouncementSlot,
} from '../../api/announcements';
import { SiteAnnouncementCard } from '../../components/SiteAnnouncementCard';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { formatApiError } from '../../utils/formatApiError';
import { datetimeLocalToIso, isoToDatetimeLocal } from '../../utils/announcementDatetime';
import {
    ANNOUNCEMENT_EMOJI_PRESETS,
    ANNOUNCEMENT_TEMPLATES,
    type AnnouncementTemplate,
} from '../../utils/announcementTemplates';

const EMPTY_SLOT = (slot: 1 | 2): SiteAnnouncementSlot => ({
    slot,
    is_enabled: false,
    message: '',
    audience: 'all',
    severity: 'info',
    link_url: null,
    emoji: null,
    starts_at: null,
    ends_at: null,
});

const SEVERITY_OPTIONS: { value: AnnouncementSeverity; label: string }[] = [
    { value: 'info', label: 'Инфо' },
    { value: 'warning', label: 'Внимание' },
    { value: 'danger', label: 'Важно' },
];

function normalizeSlots(slots: SiteAnnouncementSlot[]): SiteAnnouncementSlot[] {
    const bySlot = new Map(slots.map((s) => [s.slot, s]));
    return [EMPTY_SLOT(1), EMPTY_SLOT(2)].map((fallback) => {
        const found = bySlot.get(fallback.slot);
        if (!found) {
            return fallback;
        }
        return {
            ...fallback,
            ...found,
            emoji: found.emoji?.trim() ? found.emoji.trim() : null,
        };
    });
}

function computeActiveNow(slot: SiteAnnouncementSlot, nowMs = Date.now()): boolean {
    if (!slot.is_enabled || !slot.message.trim()) {
        return false;
    }
    if (slot.starts_at && new Date(slot.starts_at).getTime() > nowMs) {
        return false;
    }
    if (slot.ends_at && new Date(slot.ends_at).getTime() < nowMs) {
        return false;
    }
    return true;
}

function formatUpdatedAt(iso: string | null | undefined): string {
    if (!iso) {
        return 'ещё не сохранялось';
    }
    try {
        return new Date(iso).toLocaleString('ru-RU');
    } catch {
        return iso;
    }
}

function slotToPreview(slot: SiteAnnouncementSlot) {
    return {
        message: slot.message.trim() || 'Текст объявления появится здесь',
        severity: slot.severity,
        audience: slot.audience,
        link_url: slot.link_url,
        emoji: slot.emoji,
    };
}

function SlotEditor({
    slot,
    value,
    onChange,
    disabled,
    clock,
}: {
    slot: 1 | 2;
    value: SiteAnnouncementSlot;
    onChange: (next: SiteAnnouncementSlot) => void;
    disabled: boolean;
    clock: number;
}) {
    const charsLeft = ANNOUNCEMENT_MESSAGE_MAX - value.message.length;
    const showPreview = value.is_enabled || value.message.trim().length > 0;
    const activeNow = computeActiveNow(value, clock);

    function applyTemplate(template: AnnouncementTemplate) {
        onChange({
            ...value,
            message: template.message,
            severity: template.severity,
            emoji: template.emoji,
            is_enabled: true,
        });
    }

    return (
        <div className={`site-announcements-admin-column site-announcements-admin-column--${slot}`}>
            <article className="card site-announcement-editor site-announcement-editor--form">
                <header className="site-announcement-editor__header">
                    <div className="site-announcement-editor__header-top">
                        <h3 className="site-announcement-editor__title">Плашка {slot}</h3>
                        <span
                            className={
                                activeNow
                                    ? 'site-announcement-editor__badge site-announcement-editor__badge--live'
                                    : 'site-announcement-editor__badge site-announcement-editor__badge--idle'
                            }
                        >
                            {activeNow ? 'На сайте' : 'Скрыта'}
                        </span>
                    </div>
                    {value.updated_at || value.updated_by_login ? (
                        <p className="site-announcement-editor__meta">
                            Изменено {formatUpdatedAt(value.updated_at)}
                            {value.updated_by_login ? ` · ${value.updated_by_login}` : ''}
                        </p>
                    ) : null}
                </header>

                <label
                    className={`site-announcement-editor__enable${value.is_enabled ? ' site-announcement-editor__enable--on' : ''}`}
                >
                    <input
                        type="checkbox"
                        checked={value.is_enabled}
                        disabled={disabled}
                        onChange={(e) => onChange({ ...value, is_enabled: e.target.checked })}
                    />
                    <span className="site-announcement-editor__enable-label">Показывать на сайте</span>
                </label>

                <section className="site-announcement-editor__section">
                    <h4 className="site-announcement-editor__section-title">Быстрый старт</h4>
                    <div className="site-announcement-editor__templates">
                        {ANNOUNCEMENT_TEMPLATES.map((template) => (
                            <button
                                key={template.key}
                                type="button"
                                className="site-announcement-editor__template-btn"
                                disabled={disabled}
                                onClick={() => applyTemplate(template)}
                            >
                                <span className="site-announcement-editor__template-emoji" aria-hidden>
                                    {template.emoji}
                                </span>
                                <span>{template.label}</span>
                            </button>
                        ))}
                    </div>
                </section>

                <section className="site-announcement-editor__section">
                    <h4 className="site-announcement-editor__section-title">Иконка</h4>
                    <div className="site-announcement-editor__emoji-panel">
                        <label className="site-announcement-editor__field site-announcement-editor__field--emoji-input">
                            <span className="admin-inline-label">Свой emoji</span>
                            <input
                                type="text"
                                maxLength={16}
                                value={value.emoji ?? ''}
                                disabled={disabled}
                                placeholder="Пусто — стандартная"
                                onChange={(e) => {
                                    const next = e.target.value;
                                    onChange({
                                        ...value,
                                        emoji: next.length > 0 ? next : null,
                                    });
                                }}
                            />
                        </label>
                        <div
                            className="site-announcement-editor__emoji-presets"
                            role="group"
                            aria-label="Пресеты emoji"
                        >
                            {ANNOUNCEMENT_EMOJI_PRESETS.map((emoji) => (
                                <button
                                    key={emoji}
                                    type="button"
                                    className={
                                        value.emoji === emoji
                                            ? 'site-announcement-editor__emoji-btn site-announcement-editor__emoji-btn--active'
                                            : 'site-announcement-editor__emoji-btn'
                                    }
                                    disabled={disabled}
                                    aria-label={`Emoji ${emoji}`}
                                    aria-pressed={value.emoji === emoji}
                                    onClick={() => onChange({ ...value, emoji })}
                                >
                                    {emoji}
                                </button>
                            ))}
                            <button
                                type="button"
                                className="site-announcement-editor__emoji-btn site-announcement-editor__emoji-btn--clear"
                                disabled={disabled}
                                title="Стандартная иконка"
                                aria-pressed={!value.emoji}
                                onClick={() => onChange({ ...value, emoji: null })}
                            >
                                ◇
                            </button>
                        </div>
                    </div>
                </section>

                <section className="site-announcement-editor__section">
                    <h4 className="site-announcement-editor__section-title">Текст</h4>
                    <div className="site-announcement-editor__markdown-help">
                        <span className="admin-inline-label">Как оформить (вводите символы как в примерах)</span>
                        <ul className="site-announcement-editor__markdown-list">
                            <li>
                                <code>**текст**</code>
                                <span>— жирный</span>
                            </li>
                            <li>
                                <code>*текст*</code>
                                <span>— курсив</span>
                            </li>
                            <li>
                                <code>`код`</code>
                                <span>— моноширинный фрагмент</span>
                            </li>
                            <li>
                                <code>[подпись](https://ссылка)</code>
                                <span>— ссылка в тексте</span>
                            </li>
                        </ul>
                        <p className="site-announcement-editor__markdown-example muted-text">
                            Пример: сегодня с 14:00 **плановые работы**, подробности на{' '}
                            <code>[сайте](https://example.com)</code>
                        </p>
                    </div>
                    <label className="site-announcement-editor__field">
                        <span className="admin-inline-label">Сообщение на плашке</span>
                        <textarea
                            className="site-announcement-editor__message-input"
                            rows={4}
                            maxLength={ANNOUNCEMENT_MESSAGE_MAX}
                            value={value.message}
                            disabled={disabled}
                            placeholder="Например: сегодня с 14:00 плановые работы"
                            onChange={(e) => onChange({ ...value, message: e.target.value })}
                        />
                    </label>
                    <p
                        className={`site-announcement-editor__counter${charsLeft < 40 ? ' site-announcement-editor__counter--low' : ''}`}
                    >
                        {charsLeft} символов из {ANNOUNCEMENT_MESSAGE_MAX}
                    </p>
                </section>

                <section className="site-announcement-editor__section">
                    <h4 className="site-announcement-editor__section-title">Ссылка и время</h4>
                    <label className="site-announcement-editor__field">
                        <span className="admin-inline-label">Ссылка «Подробнее»</span>
                        <input
                            type="url"
                            value={value.link_url ?? ''}
                            disabled={disabled}
                            placeholder="https://… (необязательно)"
                            onChange={(e) =>
                                onChange({
                                    ...value,
                                    link_url: e.target.value.trim() ? e.target.value : null,
                                })
                            }
                        />
                    </label>
                    <div className="site-announcement-editor__dates">
                        <label className="site-announcement-editor__field">
                            <span className="admin-inline-label">С</span>
                            <input
                                type="datetime-local"
                                disabled={disabled}
                                value={isoToDatetimeLocal(value.starts_at)}
                                onChange={(e) => onChange({ ...value, starts_at: datetimeLocalToIso(e.target.value) })}
                            />
                        </label>
                        <label className="site-announcement-editor__field">
                            <span className="admin-inline-label">До</span>
                            <input
                                type="datetime-local"
                                disabled={disabled}
                                value={isoToDatetimeLocal(value.ends_at)}
                                onChange={(e) => onChange({ ...value, ends_at: datetimeLocalToIso(e.target.value) })}
                            />
                        </label>
                    </div>
                    <p className="site-announcement-editor__hint">Пустые даты — без ограничения по времени.</p>
                </section>

                <section className="site-announcement-editor__section">
                    <h4 className="site-announcement-editor__section-title">Аудитория и важность</h4>
                    <div className="site-announcement-editor__audience" role="radiogroup" aria-label="Кому показывать">
                        <button
                            type="button"
                            className={
                                value.audience === 'all'
                                    ? 'site-announcement-editor__audience-btn site-announcement-editor__audience-btn--active'
                                    : 'site-announcement-editor__audience-btn'
                            }
                            disabled={disabled}
                            aria-pressed={value.audience === 'all'}
                            onClick={() => onChange({ ...value, audience: 'all' })}
                        >
                            <span className="site-announcement-editor__audience-title">Всем</span>
                            <span className="site-announcement-editor__audience-desc">Гости по QR тоже</span>
                        </button>
                        <button
                            type="button"
                            className={
                                value.audience === 'admins_only'
                                    ? 'site-announcement-editor__audience-btn site-announcement-editor__audience-btn--active'
                                    : 'site-announcement-editor__audience-btn'
                            }
                            disabled={disabled}
                            aria-pressed={value.audience === 'admins_only'}
                            onClick={() => onChange({ ...value, audience: 'admins_only' })}
                        >
                            <span className="site-announcement-editor__audience-title">Сотрудникам</span>
                            <span className="site-announcement-editor__audience-desc">Админы и сисадмины</span>
                        </button>
                    </div>
                    <div className="site-announcement-editor__severity" role="radiogroup" aria-label="Важность">
                        {SEVERITY_OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                className={
                                    value.severity === opt.value
                                        ? `site-announcement-editor__severity-btn site-announcement-editor__severity-btn--${opt.value} site-announcement-editor__severity-btn--active`
                                        : `site-announcement-editor__severity-btn site-announcement-editor__severity-btn--${opt.value}`
                                }
                                disabled={disabled}
                                aria-pressed={value.severity === opt.value}
                                onClick={() => onChange({ ...value, severity: opt.value })}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </section>
            </article>

            <section className="card site-announcement-editor__preview" aria-label={`Превью плашки ${slot}`}>
                <h4 className="site-announcement-editor__section-title">Превью на сайте</h4>
                <div className="site-announcement-editor__preview-frame">
                    {showPreview ? (
                        <SiteAnnouncementCard item={slotToPreview(value)} />
                    ) : (
                        <p className="site-announcement-editor__preview-empty muted-text">
                            Включите показ или введите текст
                        </p>
                    )}
                </div>
            </section>
        </div>
    );
}

export function AdminAnnouncementsPage() {
    const { user } = useAuth();
    const { showSuccess, showError } = useToast();
    const isAdmin = user?.role === 'admin';
    const [slots, setSlots] = useState<SiteAnnouncementSlot[]>([EMPTY_SLOT(1), EMPTY_SLOT(2)]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [clock, setClock] = useState(() => Date.now());

    const load = useCallback(async () => {
        try {
            const res = await fetchAdminAnnouncements();
            setSlots(normalizeSlots(res.slots));
        } catch (err) {
            showError(formatApiError(err));
        } finally {
            setLoading(false);
        }
    }, [showError]);

    useEffect(() => {
        if (!isAdmin) {
            return;
        }
        setLoading(true);
        void load();
    }, [isAdmin, load]);

    useEffect(() => {
        const timer = window.setInterval(() => setClock(Date.now()), 30_000);
        return () => window.clearInterval(timer);
    }, []);

    function updateSlot(slot: 1 | 2, next: SiteAnnouncementSlot) {
        setSlots((prev) => prev.map((s) => (s.slot === slot ? next : s)));
    }

    async function handleSave() {
        for (const s of slots) {
            if (s.is_enabled && !s.message.trim()) {
                showError(`Плашка ${s.slot}: укажите текст или отключите показ`);
                return;
            }
            if (s.starts_at && s.ends_at && new Date(s.starts_at) > new Date(s.ends_at)) {
                showError(`Плашка ${s.slot}: дата «с» позже даты «до»`);
                return;
            }
            const link = s.link_url?.trim();
            if (link && !link.startsWith('http://') && !link.startsWith('https://')) {
                showError(`Плашка ${s.slot}: ссылка должна начинаться с http:// или https://`);
                return;
            }
        }
        setSaving(true);
        try {
            const payload = slots.map((s) => {
                const base = toAnnouncementSavePayload(s);
                return {
                    ...base,
                    message: base.message.trim(),
                    link_url: base.link_url?.trim() || null,
                    emoji: base.emoji?.trim() || null,
                };
            });
            const res = await saveAdminAnnouncements(payload);
            setSlots(normalizeSlots(res.slots));
            showSuccess('Объявления сохранены');
        } catch (err) {
            showError(formatApiError(err));
        } finally {
            setSaving(false);
        }
    }

    async function handleResetDismissals() {
        if (
            !window.confirm(
                'Сбросить «закрыто» у всех пользователей? Скрытые плашки снова появятся у тех, кто нажимал ×.',
            )
        ) {
            return;
        }
        setResetting(true);
        try {
            await resetAnnouncementDismissals();
            showSuccess('Скрытия сброшены — плашки снова видны всем');
            await load();
        } catch (err) {
            showError(formatApiError(err));
        } finally {
            setResetting(false);
        }
    }

    if (!isAdmin) {
        return <Navigate to="/admin" replace />;
    }

    const busy = saving || resetting;

    return (
        <main className="page page--wide site-announcements-admin-page">
            <div className="admin-page-head admin-page-head--edges">
                <Link to="/admin" className="admin-back-link">
                    ← В админку
                </Link>
            </div>
            <h2 className="page-title site-announcements-admin-page__title">Объявления на сайте</h2>

            {loading ? (
                <p className="muted-text">Загрузка…</p>
            ) : (
                <>
                    <div className="site-announcements-admin-grid">
                        <SlotEditor
                            slot={1}
                            value={slots[0]}
                            disabled={busy}
                            clock={clock}
                            onChange={(next) => updateSlot(1, next)}
                        />
                        <SlotEditor
                            slot={2}
                            value={slots[1]}
                            disabled={busy}
                            clock={clock}
                            onChange={(next) => updateSlot(2, next)}
                        />
                    </div>
                    <footer className="card site-announcements-admin-toolbar">
                        <p className="site-announcements-admin-toolbar__hint muted-text">
                            «Сбросить закрыто» вернёт плашки тем, кто нажал × на важных объявлениях.
                        </p>
                        <div className="site-announcements-admin-toolbar__actions">
                            <button
                                type="button"
                                className="btn-primary site-announcements-admin-toolbar__btn"
                                disabled={busy}
                                onClick={() => void handleSave()}
                            >
                                {saving ? 'Сохранение…' : 'Сохранить'}
                            </button>
                            <button
                                type="button"
                                className="btn-ghost site-announcements-admin-toolbar__btn"
                                disabled={busy}
                                onClick={() => void handleResetDismissals()}
                            >
                                {resetting ? 'Сброс…' : 'Сбросить «закрыто» у всех'}
                            </button>
                        </div>
                    </footer>
                </>
            )}
        </main>
    );
}
