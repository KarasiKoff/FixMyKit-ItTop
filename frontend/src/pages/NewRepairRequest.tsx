import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AttachmentUploader, draftsToFiles, type AttachmentDraft } from '../components/AttachmentUploader';
import { RepairRequestForm } from '../components/RepairRequestForm';
import { useAppData } from '../context/AppDataContext';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import { fetchPublicDeviceById } from '../api/devices';
import { createRepairRequest as submitRepairRequest } from '../api/repairRequests';
import { Device } from '../types/device';
import type { RepairRequest } from '../types/repairRequest';
import { formatApiError } from '../utils/formatApiError';

export function NewRepairRequest() {
    const { isAuthenticated, user } = useAuth();
    const { showSuccess, showError } = useToast();
    const { devices, refresh, isLoading: appDataLoading } = useAppData();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const preselectedDeviceId = searchParams.get('deviceId') ?? undefined;

    const [publicDevice, setPublicDevice] = useState<Device | null>(null);
    const [publicLoading, setPublicLoading] = useState(false);
    const [publicError, setPublicError] = useState<string | null>(null);
    const [guestDone, setGuestDone] = useState(false);
    const [sendToTracker, setSendToTracker] = useState(true);
    const [attachmentDrafts, setAttachmentDrafts] = useState<AttachmentDraft[]>([]);

    function notifyAttachmentOutcome(created: RepairRequest, syncToTracker: boolean, hadFiles: boolean) {
        if (!hadFiles) {
            showSuccess('Заявка отправлена');
            return;
        }
        if (!syncToTracker) {
            showSuccess('Заявка отправлена. Файлы сохранены и загрузятся в Трекер после синхронизации.');
            return;
        }
        if (created.attachmentsSyncStatus === 'complete') {
            showSuccess('Заявка отправлена. Все файлы загружены в Трекер.');
            return;
        }
        showError(
            `Заявка создана, но в Трекер загружено не всё (${created.attachmentsCount ?? 0} файл(ов) на сервере). ` +
                'Откройте карточку заявки и нажмите «Синхронизировать с Трекером», либо уменьшите размер файлов (лимит Трекера ~128 МБ).',
        );
    }

    useEffect(() => {
        if (isAuthenticated || !preselectedDeviceId) {
            setPublicDevice(null);
            setPublicError(null);
            setPublicLoading(false);
            return;
        }

        let cancelled = false;
        setPublicLoading(true);
        setPublicError(null);
        fetchPublicDeviceById(preselectedDeviceId)
            .then((d) => {
                if (!cancelled) {
                    setPublicDevice(d);
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    setPublicDevice(null);
                    setPublicError(formatApiError(err));
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setPublicLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [isAuthenticated, preselectedDeviceId]);

    useEffect(() => {
        if (isAuthenticated) {
            setGuestDone(false);
        }
    }, [isAuthenticated]);

    const lockedGuest = !isAuthenticated && Boolean(preselectedDeviceId);
    const displayDevices: Device[] = useMemo(() => {
        if (lockedGuest && publicDevice) {
            return [publicDevice];
        }
        return devices;
    }, [lockedGuest, publicDevice, devices]);

    const [selectedRoom, setSelectedRoom] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');

    const rooms = useMemo(
        () => Array.from(new Set(devices.map((device) => device.room).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ru')),
        [devices],
    );
    const categories = useMemo(
        () => Array.from(new Set(devices.map((device) => device.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ru')),
        [devices],
    );

    const filteredDevices = useMemo(() => {
        if (!isAuthenticated) {
            return displayDevices;
        }
        return devices.filter((device) => {
            const roomMatches = selectedRoom === '' || device.room === selectedRoom;
            const categoryMatches = selectedCategory === '' || device.category === selectedCategory;
            return roomMatches && categoryMatches;
        });
    }, [devices, displayDevices, isAuthenticated, selectedCategory, selectedRoom]);

    async function handleSubmit(data: { deviceId: string; name: string; description: string }) {
        const files = draftsToFiles(attachmentDrafts);
        try {
            if (isAuthenticated) {
                const created = await submitRepairRequest({
                    deviceId: data.deviceId,
                    requesterName: user?.name ?? user?.login ?? '',
                    description: data.description,
                    syncToTracker: sendToTracker,
                    files,
                });
                notifyAttachmentOutcome(created, sendToTracker, files.length > 0);
                setAttachmentDrafts([]);
                await refresh();
            } else {
                await submitRepairRequest({
                    deviceId: data.deviceId,
                    requesterName: data.name,
                    description: data.description,
                    files,
                });
                showSuccess('Заявка отправлена');
                setAttachmentDrafts([]);
                setGuestDone(true);
            }
        } catch (err) {
            showError(formatApiError(err));
            throw err;
        }
    }

    if (!isAuthenticated && !preselectedDeviceId) {
        return (
            <main className="page page--wide">
                <h2>Новая заявка на ремонт</h2>
                <section className="card card-form card--narrow-device">
                    <p>Чтобы создать заявку, отсканируйте QR-код на устройстве — откроется эта страница с уже выбранным оборудованием.</p>
                    <p>
                        <Link to="/scan">Перейти к сканированию QR</Link>
                    </p>
                </section>
            </main>
        );
    }

    if (!isAuthenticated && preselectedDeviceId && publicLoading) {
        return (
            <main className="page page--wide">
                <h2>Новая заявка на ремонт</h2>
                <section className="card card-form card--narrow-device">
                    <p>Загрузка данных об устройстве…</p>
                </section>
            </main>
        );
    }

    if (!isAuthenticated && preselectedDeviceId && publicError) {
        return (
            <main className="page page--wide">
                <h2>Новая заявка на ремонт</h2>
                <section className="card card-form card--narrow-device">
                    <p className="error-text">{publicError}</p>
                    <p>
                        <Link to="/scan">Перейти к сканированию QR</Link>
                    </p>
                </section>
            </main>
        );
    }

    if (isAuthenticated && appDataLoading) {
        return (
            <main className="page page--wide">
                <h2>Новая заявка на ремонт</h2>
                <section className="card card-form card--narrow-device">
                    <p>Загрузка…</p>
                </section>
            </main>
        );
    }

    return (
        <main className="page page--wide">
            <h2>Новая заявка на ремонт</h2>
            <section className="card card-form card--narrow-device">
                {isAuthenticated ? (
                    <div className="repair-filters-row">
                        <label>
                            Кабинет
                            <select value={selectedRoom} onChange={(event) => setSelectedRoom(event.target.value)}>
                                <option value="">Все кабинеты</option>
                                {rooms.map((room) => (
                                    <option key={room} value={room}>
                                        {room}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            Тип устройства
                            <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
                                <option value="">Все категории</option>
                                {categories.map((category) => (
                                    <option key={category} value={category}>
                                        {category}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                ) : null}

                {isAuthenticated ? (
                    <label className="repair-tracker-toggle">
                        <input type="checkbox" checked={sendToTracker} onChange={(e) => setSendToTracker(e.target.checked)} />
                        <span>Отправить заявку в Яндекс Трекер</span>
                    </label>
                ) : null}

                <RepairRequestForm
                    devices={filteredDevices}
                    initialDeviceId={preselectedDeviceId}
                    deviceSelectDisabled={lockedGuest}
                    nameRequired={!isAuthenticated}
                    onSubmit={handleSubmit}
                    childrenAfterDescription={
                        <AttachmentUploader files={attachmentDrafts} onChange={setAttachmentDrafts} />
                    }
                />

                {!isAuthenticated && guestDone ? (
                    <div className="repair-guest-next">
                        <button type="button" className="btn-primary" onClick={() => navigate('/scan')}>
                            Добавить ещё одну заявку (сканирование QR)
                        </button>
                    </div>
                ) : null}
            </section>
        </main>
    );
}
