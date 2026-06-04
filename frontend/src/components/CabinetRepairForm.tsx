import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AudienceDto } from '../api/audiences';
import { RepairFormLockedTarget } from './RepairFormLockedTarget';

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
    busy = false,
    onSubmit,
}: {
    audiences: AudienceDto[];
    initialAudienceId?: string;
    audienceSelectDisabled?: boolean;
    nameRequired?: boolean;
    childrenAfterDescription?: React.ReactNode;
    busy?: boolean;
    onSubmit: (data: FormData) => void | Promise<void>;
}) {
    const [audienceId, setAudienceId] = useState(
        initialAudienceId != null ? String(initialAudienceId) : audiences[0] ? String(audiences[0].id) : '',
    );
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [personalDataConsent, setPersonalDataConsent] = useState(false);
    const [internalBusy, setInternalBusy] = useState(false);
    const isBusy = busy || internalBusy;

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
    const selectedAudience = audiences.find((a) => String(a.id) === audienceId);
    const lockedTargetDisplay =
        audienceSelectDisabled && audiences.length > 0 ? selectedAudience?.name?.trim() || '—' : null;

    const formClass = ['repair-request-form', isBusy ? 'repair-request-form--busy' : ''].filter(Boolean).join(' ');

    return (
        <form
            className={formClass}
            aria-busy={isBusy}
            onSubmit={async (event) => {
                event.preventDefault();
                if (isBusy || !audienceId) {
                    return;
                }
                if (nameRequired && (!name.trim() || !personalDataConsent)) {
                    return;
                }
                const manageBusy = !busy;
                if (manageBusy) {
                    setInternalBusy(true);
                }
                try {
                    await Promise.resolve(onSubmit({ audienceId: parsedId.trim(), name, description }));
                    setDescription('');
                    if (nameRequired) {
                        setName('');
                        setPersonalDataConsent(false);
                    }
                } catch {
                    /* ошибку показывает родитель */
                } finally {
                    if (manageBusy) {
                        setInternalBusy(false);
                    }
                }
            }}
        >
            <fieldset className="repair-request-form__fields" disabled={isBusy}>
                {lockedTargetDisplay != null ? (
                    <RepairFormLockedTarget caption="Кабинет" value={lockedTargetDisplay} />
                ) : (
                    <label>
                        Кабинет
                        <select
                            value={audienceId}
                            onChange={(event) => setAudienceId(event.target.value)}
                            required
                            disabled={audiences.length === 0}
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
                )}
                {nameRequired ? (
                    <label>
                        Фамилия и имя
                        <input value={name} onChange={(e) => setName(e.target.value)} required />
                    </label>
                ) : null}
                <label>
                    Описание проблемы
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={5} />
                </label>
                {childrenAfterDescription}
            </fieldset>
            <div className="repair-request-form-actions">
                <button
                    type="submit"
                    className="btn-primary"
                    disabled={isBusy || audiences.length === 0 || (nameRequired && !personalDataConsent)}
                >
                    {isBusy ? 'Отправка…' : 'Отправить заявку'}
                </button>
                {nameRequired ? (
                    <label className="repair-consent-field">
                        <input
                            type="checkbox"
                            checked={personalDataConsent}
                            onChange={(e) => setPersonalDataConsent(e.target.checked)}
                            disabled={isBusy}
                        />
                        <span>
                            Нажимая кнопку «Отправить заявку», я даю{' '}
                            <Link to="/privacy" target="_blank" rel="noopener noreferrer">
                                согласие на обработку персональных данных
                            </Link>
                        </span>
                    </label>
                ) : null}
            </div>
        </form>
    );
}
