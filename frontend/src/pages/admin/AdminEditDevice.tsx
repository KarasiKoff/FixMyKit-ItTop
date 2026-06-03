import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { useAppData } from '../../context/AppDataContext';
import { fetchDeviceById, updateDevice } from '../../api/devices';
import { fetchCategories, type CategoryDto } from '../../api/categories';
import { CategorySelectWithIcons } from '../../components/CategorySelectWithIcons';
import { fetchAudiences, type AudienceDto } from '../../api/audiences';
import { fetchUsers, type UserListItem } from '../../api/users';
import { Device } from '../../types/device';
import { deviceRepairStatusLabel } from '../../utils/statusDisplay';
import { formatApiError } from '../../utils/formatApiError';

export function AdminEditDevice() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { showSuccess, showError } = useToast();
    const { refresh } = useAppData();

    const [categories, setCategories] = useState<CategoryDto[]>([]);
    const [audiences, setAudiences] = useState<AudienceDto[]>([]);
    const [usersList, setUsersList] = useState<UserListItem[]>([]);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [inventoryNumber, setInventoryNumber] = useState('');
    const [name, setName] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [serialNumber, setSerialNumber] = useState('');
    const [audienceId, setAudienceId] = useState<string>('');
    const [responsibleId, setResponsibleId] = useState('');
    const [status, setStatus] = useState<Device['status']>('not_in_repair');

    useEffect(() => {
        if (!id) return;
        let cancelled = false;

        void Promise.all([
            fetchDeviceById(id),
            fetchCategories(),
            fetchAudiences(),
            fetchUsers({ limit: 100 }),
        ])
            .then(([device, cats, auds, usersRes]) => {
                if (cancelled) return;
                setInventoryNumber(device.inventoryNumber);
                setName(device.name);
                setCategoryId(device.categoryId ?? '');
                setSerialNumber(device.serialNumber ?? '');
                setAudienceId(device.audienceId != null ? String(device.audienceId) : '');
                setResponsibleId(device.responsibleId ?? '');
                setStatus(device.status);
                setCategories(cats);
                setAudiences(auds);
                setUsersList(usersRes.items);
                setLoadError(null);
            })
            .catch((err) => {
                if (!cancelled) setLoadError(formatApiError(err));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [id]);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!id) return;
        if (!inventoryNumber.trim() || !name.trim()) return;

        setSaving(true);
        try {
            await updateDevice(id, {
                inventory_number: inventoryNumber.trim(),
                name: name.trim(),
                serial_number: serialNumber.trim() || null,
                category_id: categoryId || null,
                audience_id: audienceId || null,
                responsible_id: responsibleId || null,
                repair_status: status,
            });
            await refresh();
            showSuccess('Устройство обновлено');
            navigate(`/devices/${id}`);
        } catch (err) {
            showError(formatApiError(err));
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <main className="page page--centered">
                <p className="muted-text">Загрузка…</p>
            </main>
        );
    }

    return (
        <main className="page page--wide">
            <div className="admin-page-head admin-page-head--edges">
                <Link to={`/devices/${id ?? ''}`} className="admin-back-link">
                    ← К устройству
                </Link>
                <h2 className="page-title">Редактировать устройство</h2>
            </div>

            <section className="card card-form card--narrow-device">
                {loadError ? <p className="error-text">{loadError}</p> : null}
                <form className="admin-device-form" onSubmit={handleSubmit}>
                    <label className="admin-device-field">
                        <span className="admin-inline-label">Инвентарный номер</span>
                        <input
                            value={inventoryNumber}
                            onChange={(e) => setInventoryNumber(e.target.value)}
                            required
                            disabled={saving}
                        />
                    </label>
                    <label className="admin-device-field">
                        <span className="admin-inline-label">Название</span>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ноутбук Lenovo T14"
                            required
                            disabled={saving}
                        />
                    </label>
                    <CategorySelectWithIcons
                        categories={categories}
                        value={categoryId}
                        onChange={setCategoryId}
                        disabled={saving || Boolean(loadError)}
                    />
                    <label className="admin-device-field">
                        <span className="admin-inline-label">Серийный номер</span>
                        <input
                            value={serialNumber}
                            onChange={(e) => setSerialNumber(e.target.value)}
                            placeholder="LNV-T14-2391"
                            disabled={saving}
                        />
                    </label>
                    <label className="admin-device-field">
                        <span className="admin-inline-label">Кабинет</span>
                        <select
                            value={audienceId}
                            onChange={(e) => setAudienceId(e.target.value)}
                            disabled={saving}
                        >
                            <option value="">—</option>
                            {audiences.map((a) => (
                                <option key={a.id} value={String(a.id)}>
                                    {a.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="admin-device-field">
                        <span className="admin-inline-label">Ответственный</span>
                        <select
                            value={responsibleId}
                            onChange={(e) => setResponsibleId(e.target.value)}
                            disabled={saving}
                        >
                            <option value="">—</option>
                            {usersList.map((u) => (
                                <option key={u.id} value={u.id}>
                                    {u.name === u.login ? u.login : `${u.name} (${u.login})`}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="admin-device-field">
                        <span className="admin-inline-label">Статус</span>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value as Device['status'])}
                            disabled={saving}
                        >
                            <option value="not_in_repair">{deviceRepairStatusLabel('not_in_repair')}</option>
                            <option value="in_repair">{deviceRepairStatusLabel('in_repair')}</option>
                        </select>
                    </label>
                    <div className="admin-device-actions">
                        <Link to={`/devices/${id ?? ''}`} className="btn-ghost" tabIndex={saving ? -1 : 0}>
                            Отмена
                        </Link>
                        <button type="submit" className="btn-primary" disabled={saving}>
                            {saving ? 'Сохранение…' : 'Сохранить изменения'}
                        </button>
                    </div>
                </form>
            </section>
        </main>
    );
}
