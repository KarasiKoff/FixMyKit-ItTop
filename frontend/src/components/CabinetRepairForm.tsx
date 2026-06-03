import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AudienceDto } from '../api/audiences';

type FormData = {
    audienceId: string;
    name: string;
    description: string;
};

export function CabinetRepairForm({
    audiences,
    initialAudienceId,
    audienceSelectDisabled = false,
    nameRequired = false,
    childrenAfterDescription,
    onSubmit,
}: {
    audiences: AudienceDto[];
    initialAudienceId?: string;
    audienceSelectDisabled?: boolean;
    nameRequired?: boolean;
    childrenAfterDescription?: React.ReactNode;
    onSubmit: (data: FormData) => void | Promise<void>;
}) {
    const [audienceId, setAudienceId] = useState(
        initialAudienceId != null ? String(initialAudienceId) : audiences[0] ? String(audiences[0].id) : '',
    );
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [personalDataConsent, setPersonalDataConsent] = useState(false);

    useEffect(() => {
        if (initialAudienceId != null) {
            setAudienceId(String(initialAudienceId));
        }
    }, [initialAudienceId]);

    useEffect(() => {
        if (audiences.length === 0) {
            setAudienceId('');
            return;
        }
        if (!audiences.some((a) => String(a.id) === audienceId)) {
            setAudienceId(String(audiences[0].id));
        }
    }, [audiences, audienceId]);

    const parsedId = audienceId;

    return (
        <form
            className="repair-request-form"
            onSubmit={async (event) => {
                event.preventDefault();
                if (!audienceId) {
                    return;
                }
                if (nameRequired && (!name.trim() || !personalDataConsent)) {
                    return;
                }
                try {
                    await Promise.resolve(
                        onSubmit({ audienceId: parsedId.trim(), name, description }),
                    );
                    setDescription('');
                    if (nameRequired) {
                        setName('');
                        setPersonalDataConsent(false);
                    }
                } catch {
                    /* ошибку показывает родитель */
                }
            }}
        >
            <label>
                Кабинет
                <select
                    value={audienceId}
                    onChange={(event) => setAudienceId(event.target.value)}
                    required
                    disabled={audiences.length === 0 || audienceSelectDisabled}
                >
                    {audiences.length === 0 ? (
                        <option value="">Нет доступных кабинетов</option>
                    ) : (
                        audiences.map((a) => (
                            <option key={a.id} value={a.id}>
                                {a.name}
                            </option>
                        ))
                    )}
                </select>
            </label>
            {nameRequired ? (
                <>
                    <label>
                        ФИО заявителя
                        <input value={name} onChange={(e) => setName(e.target.value)} required />
                    </label>
                    <label className="repair-consent-label">
                        <input
                            type="checkbox"
                            checked={personalDataConsent}
                            onChange={(e) => setPersonalDataConsent(e.target.checked)}
                            required
                        />
                        <span>
                            Согласен на{' '}
                            <Link to="/privacy" target="_blank" rel="noreferrer">
                                обработку персональных данных
                            </Link>
                        </span>
                    </label>
                </>
            ) : null}
            <label>
                Описание проблемы
                <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    rows={5}
                />
            </label>
            {childrenAfterDescription}
            <button type="submit" className="btn-primary" disabled={audiences.length === 0}>
                Отправить заявку
            </button>
        </form>
    );
}
