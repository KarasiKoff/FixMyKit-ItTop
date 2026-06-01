import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Device } from '../types/device';

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
    onSubmit,
}: {
    devices: Device[];
    initialDeviceId?: string;
    deviceSelectDisabled?: boolean;
    nameRequired?: boolean;
    childrenAfterDescription?: React.ReactNode;
    onSubmit: (data: FormData) => void | Promise<void>;
}) {
    const [deviceId, setDeviceId] = useState(initialDeviceId ?? devices[0]?.id ?? '');
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [personalDataConsent, setPersonalDataConsent] = useState(false);

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

    return (
        <form
            className="repair-request-form"
            onSubmit={async (event) => {
                event.preventDefault();
                if (!deviceId) {
                    return;
                }
                if (nameRequired && (!name.trim() || !personalDataConsent)) {
                    return;
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
                }
            }}
        >
            <label>
                Устройство
                <select
                    value={deviceId}
                    onChange={(event) => setDeviceId(event.target.value)}
                    required
                    disabled={devices.length === 0 || deviceSelectDisabled}
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
            <div className="repair-request-form-actions">
                <button
                    type="submit"
                    className="btn-primary"
                    disabled={devices.length === 0 || (nameRequired && !personalDataConsent)}
                >
                    Отправить заявку
                </button>
                {nameRequired ? (
                    <label className="repair-consent-field">
                        <input
                            type="checkbox"
                            checked={personalDataConsent}
                            onChange={(e) => setPersonalDataConsent(e.target.checked)}
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
