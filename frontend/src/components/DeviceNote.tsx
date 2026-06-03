import React, { useState } from 'react';
import { updateDevice } from '../api/devices';
import { useToast } from '../context/ToastContext';
import { formatApiError } from '../utils/formatApiError';

type Props = {
    deviceId: string;
    note: string | null;
    onSaved: (note: string | null) => void;
};

function IconPencil() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M4 20h4l10.5-10.5a1.5 1.5 0 0 0-4.24-4.24L3.76 15.76 4 20zm14.71-12.04 1.33-1.33a1.5 1.5 0 0 1 2.12 2.12l-1.33 1.33-2.12-2.12z"
                fill="currentColor"
            />
        </svg>
    );
}

export function DeviceNote({ deviceId, note, onSaved }: Props) {
    const { showSuccess, showError } = useToast();
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const [saving, setSaving] = useState(false);

    const hasNote = Boolean(note?.trim());

    function startEdit() {
        setDraft(note ?? '');
        setEditing(true);
    }

    function cancelEdit() {
        setEditing(false);
        setDraft('');
    }

    async function save() {
        setSaving(true);
        try {
            const trimmed = draft.trim();
            const nextNote = trimmed ? trimmed : null;
            const updated = await updateDevice(deviceId, { note: nextNote });
            onSaved(updated.note);
            setEditing(false);
            showSuccess('Заметка сохранена');
        } catch (err) {
            showError(formatApiError(err));
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="device-note">
            <div className="device-note__head">
                <span className="device-note__label">Заметка</span>
                {!editing ? (
                    <button
                        type="button"
                        className="device-note__edit-btn btn-ghost btn-compact"
                        onClick={startEdit}
                        aria-label={hasNote ? 'Изменить заметку' : 'Добавить заметку'}
                        title={hasNote ? 'Изменить заметку' : 'Добавить заметку'}
                    >
                        <IconPencil />
                        <span>{hasNote ? 'Изменить' : 'Добавить'}</span>
                    </button>
                ) : null}
            </div>

            {editing ? (
                <div className="device-note__editor">
                    <textarea
                        className="device-note__textarea"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        rows={4}
                        placeholder="Особенности устройства, что важно знать сисадминам…"
                        disabled={saving}
                    />
                    <div className="device-note__editor-actions">
                        <button type="button" className="btn-primary" disabled={saving} onClick={() => void save()}>
                            {saving ? 'Сохранение…' : 'Сохранить'}
                        </button>
                        <button type="button" className="btn-ghost" disabled={saving} onClick={cancelEdit}>
                            Отмена
                        </button>
                    </div>
                </div>
            ) : hasNote ? (
                <p className="device-note__text">{note}</p>
            ) : (
                <p className="device-note__empty muted-text">Заметка не добавлена</p>
            )}
        </div>
    );
}
