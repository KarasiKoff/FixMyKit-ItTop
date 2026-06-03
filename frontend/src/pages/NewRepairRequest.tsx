import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AttachmentUploader, draftsToFiles, type AttachmentDraft } from '../components/AttachmentUploader';
import { CabinetRepairForm } from '../components/CabinetRepairForm';
import { RepairRequestForm } from '../components/RepairRequestForm';
import { useAppData } from '../context/AppDataContext';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import { fetchAudiences, type AudienceDto } from '../api/audiences';
import { fetchPublicDeviceById } from '../api/devices';
import { createRepairRequest as submitRepairRequest, fetchPublicAudienceRepairSummary } from '../api/repairRequests';
import { Device } from '../types/device';
import type { PublicAudienceInfo, RepairRequest } from '../types/repairRequest';
import { formatApiError } from '../utils/formatApiError';
import { isUuid } from '../utils/uuid';

type RequestTarget = 'device' | 'cabinet';

export function NewRepairRequest() {
    const { isAuthenticated, user } = useAuth();
    const { showSuccess, showError } = useToast();
    const { devices, refresh, isLoading: appDataLoading } = useAppData();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const deviceIdRaw = searchParams.get('deviceId');
    const preselectedDeviceId = isUuid(deviceIdRaw) ? deviceIdRaw!.trim() : undefined;
    const audienceIdRaw = searchParams.get('audienceId');
    const preselectedAudienceId = isUuid(audienceIdRaw) ? audienceIdRaw!.trim() : undefined;

    const lockedTarget: RequestTarget | null = preselectedAudienceId
        ? 'cabinet'
        : preselectedDeviceId
          ? 'device'
          : null;

    const [requestTarget, setRequestTarget] = useState<RequestTarget>(lockedTarget ?? 'device');

    const [publicDevice, setPublicDevice] = useState<Device | null>(null);
    const [publicAudience, setPublicAudience] = useState<PublicAudienceInfo | null>(null);
    const [publicLoading, setPublicLoading] = useState(false);
    const [publicError, setPublicError] = useState<string | null>(null);
    const [guestDone, setGuestDone] = useState(false);
    const [sendToTracker, setSendToTracker] = useState(true);
    const [attachmentDrafts, setAttachmentDrafts] = useState<AttachmentDraft[]>([]);
    const [audiences, setAudiences] = useState<AudienceDto[]>([]);
    const [audiencesLoading, setAudiencesLoading] = useState(false);

    useEffect(() => {
        if (lockedTarget) {
            setRequestTarget(lockedTarget);
        }
    }, [lockedTarget]);

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
        if (isAuthenticated || !preselectedDeviceId || requestTarget !== 'device') {
            if (!preselectedDeviceId) {
                setPublicDevice(null);
            }
            if (requestTarget !== 'device') {
                setPublicError(null);
                setPublicLoading(false);
            }
            if (!isAuthenticated || requestTarget !== 'device') {
                return;
            }
        }

        let cancelled = false;
        setPublicLoading(true);
        setPublicError(null);
        fetchPublicDeviceById(preselectedDeviceId!)
            .then((d) => {
                if (!cancelled) setPublicDevice(d);
            })
            .catch((err) => {
                if (!cancelled) {
                    setPublicDevice(null);
                    setPublicError(formatApiError(err));
                }
            })
            .finally(() => {
                if (!cancelled) setPublicLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [isAuthenticated, preselectedDeviceId, requestTarget]);

    useEffect(() => {
        if (
            isAuthenticated ||
            !preselectedAudienceId ||
            requestTarget !== 'cabinet'
        ) {
            if (preselectedAudienceId == null) {
                setPublicAudience(null);
            }
            return;
        }

        let cancelled = false;
        setPublicLoading(true);
        setPublicError(null);
        fetchPublicAudienceRepairSummary(preselectedAudienceId)
            .then((s) => {
                if (!cancelled) setPublicAudience(s.audience);
            })
            .catch((err) => {
                if (!cancelled) {
                    setPublicAudience(null);
                    setPublicError(formatApiError(err));
                }
            })
            .finally(() => {
                if (!cancelled) setPublicLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [isAuthenticated, preselectedAudienceId, requestTarget]);

    useEffect(() => {
        if (!isAuthenticated) {
            return;
        }
        let cancelled = false;
        setAudiencesLoading(true);
        fetchAudiences()
            .then((items) => {
                if (!cancelled) setAudiences(items);
            })
            .catch(() => {
                if (!cancelled) setAudiences([]);
            })
            .finally(() => {
                if (!cancelled) setAudiencesLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [isAuthenticated]);

    useEffect(() => {
        if (isAuthenticated) {
            setGuestDone(false);
        }
    }, [isAuthenticated]);

    const lockedGuest =
        !isAuthenticated &&
        Boolean(
            (requestTarget === 'device' && preselectedDeviceId) ||
                (requestTarget === 'cabinet' && Boolean(preselectedAudienceId)),
        );

    const displayDevices: Device[] = useMemo(() => {
        if (lockedGuest && publicDevice) {
            return [publicDevice];
        }
        return devices;
    }, [lockedGuest, publicDevice, devices]);

    const displayAudiences: AudienceDto[] = useMemo(() => {
        if (lockedGuest && publicAudience) {
            return [{ id: publicAudience.id, name: publicAudience.name }];
        }
        return audiences;
    }, [lockedGuest, publicAudience, audiences]);

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

    const hasGuestTarget =
        Boolean(preselectedDeviceId) || Boolean(preselectedAudienceId);

    async function submitDevice(data: { deviceId: string; name: string; description: string }) {
        const files = draftsToFiles(attachmentDrafts);
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
    }

    async function submitCabinet(data: { audienceId: string; name: string; description: string }) {
        const files = draftsToFiles(attachmentDrafts);
        if (isAuthenticated) {
            const created = await submitRepairRequest({
                audienceId: data.audienceId,
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
                audienceId: data.audienceId,
                requesterName: data.name,
                description: data.description,
                files,
            });
            showSuccess('Заявка отправлена');
            setAttachmentDrafts([]);
            setGuestDone(true);
        }
    }

    async function handleDeviceSubmit(data: { deviceId: string; name: string; description: string }) {
        try {
            await submitDevice(data);
        } catch (err) {
            showError(formatApiError(err));
            throw err;
        }
    }

    async function handleCabinetSubmit(data: { audienceId: string; name: string; description: string }) {
        try {
            await submitCabinet(data);
        } catch (err) {
            showError(formatApiError(err));
            throw err;
        }
    }

    if (!isAuthenticated && !hasGuestTarget) {
        return (
            <main className="page page--wide">
                <h2>Новая заявка на ремонт</h2>
                <section className="card card-form card--narrow-device">
                    <p>
                        Чтобы создать заявку, отсканируйте QR-код на устройстве или на табличке кабинета — откроется
                        эта страница с уже выбранным объектом.
                    </p>
                    <p>
                        <Link to="/scan">Перейти к сканированию QR</Link>
                    </p>
                </section>
            </main>
        );
    }

    if (!isAuthenticated && hasGuestTarget && publicLoading) {
        return (
            <main className="page page--wide">
                <h2>Новая заявка на ремонт</h2>
                <section className="card card-form card--narrow-device">
                    <p>Загрузка…</p>
                </section>
            </main>
        );
    }

    if (!isAuthenticated && hasGuestTarget && publicError) {
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

    if (isAuthenticated && (appDataLoading || (requestTarget === 'cabinet' && audiencesLoading))) {
        return (
            <main className="page page--wide">
                <h2>Новая заявка на ремонт</h2>
                <section className="card card-form card--narrow-device">
                    <p>Загрузка…</p>
                </section>
            </main>
        );
    }

    const attachmentBlock = <AttachmentUploader files={attachmentDrafts} onChange={setAttachmentDrafts} />;

    return (
        <main className="page page--wide">
            <h2>Новая заявка на ремонт</h2>
            <section className="card card-form card--narrow-device">
                {isAuthenticated && lockedTarget == null ? (
                    <div className="repair-filters-row" style={{ marginBottom: 16 }}>
                        <label>
                            Объект заявки
                            <select
                                value={requestTarget}
                                onChange={(e) => setRequestTarget(e.target.value as RequestTarget)}
                            >
                                <option value="device">Устройство</option>
                                <option value="cabinet">Кабинет</option>
                            </select>
                        </label>
                    </div>
                ) : null}

                {isAuthenticated && requestTarget === 'device' ? (
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

                {requestTarget === 'cabinet' ? (
                    <CabinetRepairForm
                        audiences={displayAudiences}
                        initialAudienceId={preselectedAudienceId}
                        audienceSelectDisabled={lockedGuest}
                        nameRequired={!isAuthenticated}
                        onSubmit={handleCabinetSubmit}
                        childrenAfterDescription={attachmentBlock}
                    />
                ) : (
                    <RepairRequestForm
                        devices={filteredDevices}
                        initialDeviceId={preselectedDeviceId}
                        deviceSelectDisabled={lockedGuest}
                        nameRequired={!isAuthenticated}
                        onSubmit={handleDeviceSubmit}
                        childrenAfterDescription={attachmentBlock}
                    />
                )}

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
