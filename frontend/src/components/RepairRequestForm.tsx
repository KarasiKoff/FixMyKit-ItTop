import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Device } from '../types/device';
import { RepairFormLockedTarget } from './RepairFormLockedTarget';

type FormData = {
    deviceId: string;
    name: string;
    description: string;
};

export function RepairRequestForm({
    devices,
    initialDeviceId,
    deviceSelectDisabled = false,
    nameRequired = false,
    childrenAfterDescription,
    busy = false,
    onSubmit,
}: {
    devices: Device[];
    initialDeviceId?: string;
    deviceSelectDisabled?: boolean;
    nameRequired?: boolean;
    childrenAfterDescription?: React.ReactNode;
    /** Блокировка формы (родитель показывает overlay). */
    busy?: boolean;
    onSubmit: (data: FormData) => void | Promise<void>;
}) {
    const [deviceId, setDeviceId] = useState(initialDeviceId ?? devices[0]?.id ?? '');
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [personalDataConsent, setPersonalDataConsent] = useState(false);
    const [internalBusy, setInternalBusy] = useState(false);
    const isBusy = busy || internalBusy;

    useEffect(() => {
        if (initialDeviceId) {
            setDeviceId(initialDeviceId);
        }
    }, [initialDeviceId]);

    useEffect(() => {
        if (devices.length === 0) {
            setDeviceId('');
            return;
        }

        if (!devices.some((device) => device.id === deviceId)) {
            setDeviceId(devices[0].id);
        }
    }, [devices, deviceId]);

    const selectedDevice = devices.find((device) => device.id === deviceId);
    const lockedTargetDisplay =
        deviceSelectDisabled && devices.length > 0
            ? selectedDevice?.inventoryNumber?.trim() || '—'
            : null;

    const formClass = ['repair-request-form', isBusy ? 'repair-request-form--busy' : ''].filter(Boolean).join(' ');

    return (
        <form
            className={formClass}
            aria-busy={isBusy}
            onSubmit={async (event) => {
                event.preventDefault();
                if (isBusy || !deviceId) {
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
                    await Promise.resolve(onSubmit({ deviceId, name, description }));
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
                    <RepairFormLockedTarget caption="Инв. номер" value={lockedTargetDisplay} />
                ) : (
                    <label>
                        Устройство
                        <select
                            value={deviceId}
                            onChange={(event) => setDeviceId(event.target.value)}
                            required
                            disabled={devices.length === 0}
                        >
                            {devices.length === 0 ? (
                                <option value="">Нет доступных устройств</option>
                            ) : (
                                devices.map((device) => (
                                    <option key={device.id} value={device.id}>
                                        {device.inventoryNumber} — {device.name}
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
                    Описание
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} required />
                </label>
                {childrenAfterDescription}
            </fieldset>
            <div className="repair-request-form-actions">
                <button
                    type="submit"
                    className="btn-primary"
                    disabled={isBusy || devices.length === 0 || (nameRequired && !personalDataConsent)}
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
