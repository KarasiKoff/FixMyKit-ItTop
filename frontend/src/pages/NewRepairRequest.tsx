import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AttachmentUploader, type AttachmentDraft } from '../components/AttachmentUploader';
import { draftsToFiles } from '../utils/attachmentDrafts';
import { CabinetRepairForm } from '../components/CabinetRepairForm';
import { RepairRequestForm } from '../components/RepairRequestForm';
import { RepairSubmitSuccess } from '../components/RepairSubmitSuccess';
import { FormSubmitOverlay } from '../components/ui/FormSubmitOverlay';
import { LoadingPanel } from '../components/ui/LoadingPanel';
import { useAuth } from '../hooks/useAuth';
import { usePublicIntegration } from '../context/public-integration-context';
import { useToast } from '../hooks/useToast';
import { fetchAudiences, type AudienceDto } from '../api/audiences';
import { fetchDevices, fetchPublicDeviceById } from '../api/devices';
import { createRepairRequest as submitRepairRequest, fetchPublicAudienceRepairSummary } from '../api/repairRequests';
import { Device } from '../types/device';
import type { PublicAudienceInfo, RepairRequest } from '../types/repairRequest';
import { formatApiError } from '../utils/formatApiError';
import {
    integrationDisplayName,
    issueCreatedInIntegrationLabel,
    sendToIntegrationLabel,
    syncWithIntegrationLabel,
} from '../utils/externalIntegrationCopy';
import { repairSubmitOverlayMessage } from '../utils/repairSubmitMessages';
import { isUuid } from '../utils/uuid';

type RequestTarget = 'device' | 'cabinet';

export function NewRepairRequest() {
    const { isAuthenticated, user } = useAuth();
    const integration = usePublicIntegration();
    const { showSuccess, showError } = useToast();
    const [searchParams] = useSearchParams();
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
    type SubmitSuccessState = {
        targetKind: 'device' | 'cabinet';
        targetId: string;
        targetLabel: string;
        hadFiles: boolean;
        sentToTracker: boolean;
    };
    const [submitSuccess, setSubmitSuccess] = useState<SubmitSuccessState | null>(null);
    const [sendToTracker, setSendToTracker] = useState(true);

    useEffect(() => {
        if (integration.ready) {
            setSendToTracker(integration.enabled);
        }
    }, [integration.enabled, integration.ready]);
    const [attachmentDrafts, setAttachmentDrafts] = useState<AttachmentDraft[]>([]);
    const [devices, setDevices] = useState<Device[]>([]);
    const [devicesLoading, setDevicesLoading] = useState(false);
    const [audiences, setAudiences] = useState<AudienceDto[]>([]);
    const [audiencesLoading, setAudiencesLoading] = useState(false);
    const [submitBusy, setSubmitBusy] = useState(false);

    useEffect(() => {
        if (!isAuthenticated) {
            setDevices([]);
            setDevicesLoading(false);
            return;
        }
        let active = true;
        setDevicesLoading(true);
        fetchDevices({ limit: 50, offset: 0 })
            .then((page) => {
                if (active) {
                    setDevices(page.items);
                }
            })
            .catch((err) => {
                if (active) {
                    showError(formatApiError(err));
                }
            })
            .finally(() => {
                if (active) {
                    setDevicesLoading(false);
                }
            });
        return () => {
            active = false;
        };
    }, [isAuthenticated, showError]);

    useEffect(() => {
        if (lockedTarget) {
            setRequestTarget(lockedTarget);
        }
    }, [lockedTarget]);

    const submitOverlay = useMemo(
        () =>
            repairSubmitOverlayMessage({
                sendToTracker: isAuthenticated && integration.enabled && sendToTracker,
                fileCount: attachmentDrafts.length,
                isGuest: !isAuthenticated,
                integrationLabel: integrationDisplayName(integration),
            }),
        [attachmentDrafts.length, integration, isAuthenticated, sendToTracker],
    );

    async function runSubmit(task: () => Promise<void>) {
        if (submitBusy) {
            return;
        }
        setSubmitBusy(true);
        try {
            await task();
        } finally {
            setSubmitBusy(false);
        }
    }

    function notifyAttachmentOutcome(created: RepairRequest, syncToTracker: boolean, hadFiles: boolean) {
        const trackerName = integrationDisplayName(integration);
        if (!hadFiles) {
            showSuccess('Заявка отправлена');
            return;
        }
        if (!syncToTracker) {
            showSuccess(
                `Заявка отправлена. Файлы сохранены и загрузятся в ${trackerName} после синхронизации.`,
            );
            return;
        }
        if (created.attachmentsSyncStatus === 'complete') {
            showSuccess(`Заявка отправлена. Все файлы загружены в ${trackerName}.`);
            return;
        }
        showError(
            `Заявка создана, но в ${trackerName} загружено не всё (${created.attachmentsCount ?? 0} файл(ов) на сервере). ` +
                `Откройте карточку заявки и нажмите «${syncWithIntegrationLabel(integration)}», либо уменьшите размер файлов.`,
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
        if (isAuthenticated || !preselectedAudienceId || requestTarget !== 'cabinet') {
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
            setSubmitSuccess(null);
        }
    }, [isAuthenticated]);

    const showSuccessScreenAfterSubmit = !isAuthenticated || Boolean(preselectedDeviceId || preselectedAudienceId);

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
        () =>
            Array.from(new Set(devices.map((device) => device.room).filter(Boolean))).sort((a, b) =>
                a.localeCompare(b, 'ru'),
            ),
        [devices],
    );
    const categories = useMemo(
        () =>
            Array.from(new Set(devices.map((device) => device.category).filter(Boolean))).sort((a, b) =>
                a.localeCompare(b, 'ru'),
            ),
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

    const hasGuestTarget = Boolean(preselectedDeviceId) || Boolean(preselectedAudienceId);

    function deviceTargetLabel(deviceId: string): string {
        const d = displayDevices.find((x) => x.id === deviceId);
        if (!d?.inventoryNumber) {
            return '—';
        }
        return d.inventoryNumber;
    }

    function cabinetTargetLabel(audienceId: string): string {
        const a = displayAudiences.find((x) => String(x.id) === audienceId);
        return a?.name?.trim() || '—';
    }

    function completeSubmit(state: SubmitSuccessState) {
        setAttachmentDrafts([]);
        if (showSuccessScreenAfterSubmit) {
            setSubmitSuccess(state);
        }
    }

    async function submitDevice(data: { deviceId: string; name: string; description: string }) {
        const files = draftsToFiles(attachmentDrafts);
        if (isAuthenticated) {
            const created = await submitRepairRequest(
                {
                    deviceId: data.deviceId,
                    requesterName: user?.name ?? user?.login ?? '',
                    description: data.description,
                    syncToTracker: integration.enabled && sendToTracker,
                    files,
                },
                { staff: true },
            );
            if (showSuccessScreenAfterSubmit) {
                completeSubmit({
                    targetKind: 'device',
                    targetId: data.deviceId,
                    targetLabel: deviceTargetLabel(data.deviceId),
                    hadFiles: files.length > 0,
                    sentToTracker: integration.enabled && sendToTracker,
                });
            } else {
                notifyAttachmentOutcome(created, sendToTracker, files.length > 0);
                setAttachmentDrafts([]);
            }
        } else {
            await submitRepairRequest({
                deviceId: data.deviceId,
                requesterName: data.name,
                description: data.description,
                files,
            });
            completeSubmit({
                targetKind: 'device',
                targetId: data.deviceId,
                targetLabel: deviceTargetLabel(data.deviceId),
                hadFiles: files.length > 0,
                sentToTracker: false,
            });
        }
    }

    async function submitCabinet(data: { audienceId: string; name: string; description: string }) {
        const files = draftsToFiles(attachmentDrafts);
        if (isAuthenticated) {
            const created = await submitRepairRequest(
                {
                    audienceId: data.audienceId,
                    requesterName: user?.name ?? user?.login ?? '',
                    description: data.description,
                    syncToTracker: integration.enabled && sendToTracker,
                    files,
                },
                { staff: true },
            );
            if (showSuccessScreenAfterSubmit) {
                completeSubmit({
                    targetKind: 'cabinet',
                    targetId: data.audienceId,
                    targetLabel: cabinetTargetLabel(data.audienceId),
                    hadFiles: files.length > 0,
                    sentToTracker: integration.enabled && sendToTracker,
                });
            } else {
                notifyAttachmentOutcome(created, sendToTracker, files.length > 0);
                setAttachmentDrafts([]);
            }
        } else {
            await submitRepairRequest({
                audienceId: data.audienceId,
                requesterName: data.name,
                description: data.description,
                files,
            });
            completeSubmit({
                targetKind: 'cabinet',
                targetId: data.audienceId,
                targetLabel: cabinetTargetLabel(data.audienceId),
                hadFiles: files.length > 0,
                sentToTracker: false,
            });
        }
    }

    async function handleDeviceSubmit(data: { deviceId: string; name: string; description: string }) {
        await runSubmit(async () => {
            try {
                await submitDevice(data);
            } catch (err) {
                showError(formatApiError(err));
                throw err;
            }
        });
    }

    async function handleCabinetSubmit(data: { audienceId: string; name: string; description: string }) {
        await runSubmit(async () => {
            try {
                await submitCabinet(data);
            } catch (err) {
                showError(formatApiError(err));
                throw err;
            }
        });
    }

    if (!isAuthenticated && !hasGuestTarget) {
        return (
            <main className="page page--wide">
                <h2>Новая заявка на ремонт</h2>
                <section className="card card-form card--narrow-device">
                    <p>
                        Чтобы создать заявку, отсканируйте QR-код на устройстве или на табличке кабинета — откроется эта
                        страница с уже выбранным объектом.
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
                    <LoadingPanel title="Загружаем данные…" detail="Подготавливаем форму заявки." />
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

    if (isAuthenticated && (devicesLoading || (requestTarget === 'cabinet' && audiencesLoading))) {
        return (
            <main className="page page--wide">
                <h2>Новая заявка на ремонт</h2>
                <section className="card card-form card--narrow-device">
                    <LoadingPanel title="Загружаем справочники…" detail="Устройства и кабинеты." />
                </section>
            </main>
        );
    }

    const attachmentBlock = (
        <AttachmentUploader files={attachmentDrafts} onChange={setAttachmentDrafts} disabled={submitBusy} />
    );

    if (submitSuccess) {
        const successLines: string[] = ['Повторно отправлять заявку на этот объект не нужно — она уже принята'];
        if (submitSuccess.hadFiles) {
            successLines.push('Вложения сохранены вместе с заявкой');
        }
        if (submitSuccess.sentToTracker) {
            successLines.push(issueCreatedInIntegrationLabel(integration));
        } else if (!isAuthenticated) {
            successLines.push('Сисадмины обработают заявку в ближайшее время');
        }

        return (
            <main className="page page--centered repair-submit-success-page">
                <RepairSubmitSuccess
                    title="Заявка успешно зарегистрирована"
                    targetCaption={submitSuccess.targetKind === 'device' ? 'Инв. номер' : 'Кабинет'}
                    targetLabel={submitSuccess.targetLabel}
                    lines={successLines}
                    primaryLabel={isAuthenticated ? 'К списку заявок' : 'Сканировать другой QR-код'}
                    primaryTo={isAuthenticated ? '/requests' : '/scan'}
                />
            </main>
        );
    }

    return (
        <main className="page page--wide">
            <FormSubmitOverlay open={submitBusy} title={submitOverlay.title} detail={submitOverlay.detail} />
            <h2>Новая заявка на ремонт</h2>
            <section className="card card-form card--narrow-device">
                {isAuthenticated && lockedTarget == null ? (
                    <div className="repair-filters-row" style={{ marginBottom: 16 }}>
                        <label>
                            Объект заявки
                            <select
                                value={requestTarget}
                                onChange={(e) => setRequestTarget(e.target.value as RequestTarget)}
                                disabled={submitBusy}
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
                            <select
                                value={selectedCategory}
                                onChange={(event) => setSelectedCategory(event.target.value)}
                            >
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

                {isAuthenticated && integration.enabled ? (
                    <label className="repair-tracker-toggle">
                        <input
                            type="checkbox"
                            checked={sendToTracker}
                            onChange={(e) => setSendToTracker(e.target.checked)}
                            disabled={submitBusy}
                        />
                        <span>{sendToIntegrationLabel(integration)}</span>
                    </label>
                ) : null}

                {requestTarget === 'cabinet' ? (
                    <CabinetRepairForm
                        busy={submitBusy}
                        audiences={displayAudiences}
                        initialAudienceId={preselectedAudienceId}
                        audienceSelectDisabled={lockedGuest}
                        nameRequired={!isAuthenticated}
                        onSubmit={handleCabinetSubmit}
                        childrenAfterDescription={attachmentBlock}
                    />
                ) : (
                    <RepairRequestForm
                        busy={submitBusy}
                        devices={filteredDevices}
                        initialDeviceId={preselectedDeviceId}
                        deviceSelectDisabled={lockedGuest}
                        nameRequired={!isAuthenticated}
                        onSubmit={handleDeviceSubmit}
                        childrenAfterDescription={attachmentBlock}
                    />
                )}
            </section>
        </main>
    );
}
