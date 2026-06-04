import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchDevices } from '../api/devices';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DevicesListBulkBar } from '../components/devices/DevicesListBulkBar';
import { DevicesListFilters, type DeviceFilters } from '../components/devices/DevicesListFilters';
import { DevicesListTable } from '../components/devices/DevicesListTable';
import { ScrollToTopButton } from '../components/ScrollToTopButton';
import { ListPagination } from '../components/ListPagination';
import { QrSheetSettingsModal } from '../components/QrSheetSettingsModal';
import { qrPrintTargetFromDevice } from '../utils/qrGenerator';
import { useAppData } from '../hooks/useAppData';
import { useToast } from '../hooks/useToast';
import { Device } from '../types/device';
import type { DeviceSortBy, SortDir } from '../types/listQuery';
import { formatApiError } from '../utils/formatApiError';
import { usePaginatedList } from '../hooks/usePaginatedList';

const DEFAULT_SORT: DeviceSortBy = 'inventory_number';
const DEFAULT_DIR: SortDir = 'asc';

const EMPTY_FILTERS: DeviceFilters = {
    inventoryNumber: '',
    name: '',
    category: '',
    room: '',
    responsible: '',
    status: '',
};

export function DevicesList() {
    const navigate = useNavigate();
    const { removeDevice } = useAppData();
    const { showError, showSuccess } = useToast();

    const {
        items,
        total,
        fetching,
        error,
        page,
        pageSize,
        sortBy,
        sortDir,
        draftFilters,
        setDraftFilters,
        applyFilters,
        filtersPending,
        setPage,
        setPageSize,
        handleSort,
        reload,
    } = usePaginatedList<Device, DeviceFilters, DeviceSortBy>({
        emptyFilters: EMPTY_FILTERS,
        defaultSort: DEFAULT_SORT,
        defaultDir: DEFAULT_DIR,
        load: async ({ filters, page: p, pageSize: ps, sortBy: sb, sortDir: sd }) =>
            fetchDevices({
                inventory_number: filters.inventoryNumber || undefined,
                name: filters.name || undefined,
                category: filters.category || undefined,
                room: filters.room || undefined,
                responsible: filters.responsible || undefined,
                repair_status: filters.status || undefined,
                sort_by: sb,
                sort_dir: sd,
                limit: ps,
                offset: (p - 1) * ps,
            }),
    });

    const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());
    const [sheetModalOpen, setSheetModalOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [deleteTargets, setDeleteTargets] = useState<Device[] | null>(null);

    const selectedDevicesList = useMemo(() => items.filter((d) => selectedDevices.has(d.id)), [items, selectedDevices]);
    const selectedQrTargets = useMemo(() => selectedDevicesList.map(qrPrintTargetFromDevice), [selectedDevicesList]);

    const handleSelectAll = () => {
        if (selectedDevices.size === items.length) {
            setSelectedDevices(new Set());
        } else {
            setSelectedDevices(new Set(items.map((d) => d.id)));
        }
    };

    const handleSelectDevice = (id: string) => {
        const next = new Set(selectedDevices);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedDevices(next);
    };

    function openDevice(id: string) {
        navigate(`/devices/${id}`);
    }

    function requestDelete(targets: Device[], event?: React.MouseEvent) {
        event?.stopPropagation();
        if (targets.length === 0) {
            return;
        }
        setDeleteTargets(targets);
    }

    async function executeDelete() {
        if (!deleteTargets?.length) {
            return;
        }
        const count = deleteTargets.length;
        setDeleting(true);
        try {
            for (const device of deleteTargets) {
                await removeDevice(device.id);
            }
            setSelectedDevices((prev) => {
                const next = new Set(prev);
                for (const device of deleteTargets) {
                    next.delete(device.id);
                }
                return next;
            });
            showSuccess(count === 1 ? 'Устройство удалено' : `Удалено устройств: ${count}`);
            setDeleteTargets(null);
            await reload();
        } catch (err) {
            showError(formatApiError(err));
        } finally {
            setDeleting(false);
        }
    }

    const deleteDialogTitle =
        deleteTargets?.length === 1 ? 'Удалить устройство?' : `Удалить устройства (${deleteTargets?.length ?? 0})?`;

    const deleteDialogMessage =
        deleteTargets?.length === 1 ? (
            <>
                <p>Будут безвозвратно удалены все заявки и история ремонтов по этому устройству.</p>
                <p className="confirm-dialog__target">
                    <strong>{deleteTargets[0].name}</strong>
                    {deleteTargets[0].inventoryNumber ? ` · ${deleteTargets[0].inventoryNumber}` : null}
                </p>
            </>
        ) : (
            <>
                <p>Будут безвозвратно удалены заявки и история ремонтов по каждому выбранному устройству.</p>
                <ul className="confirm-dialog__list">
                    {deleteTargets?.slice(0, 6).map((device) => (
                        <li key={device.id}>
                            {device.name}
                            {device.inventoryNumber ? ` · ${device.inventoryNumber}` : ''}
                        </li>
                    ))}
                    {deleteTargets && deleteTargets.length > 6 ? <li>и ещё {deleteTargets.length - 6}</li> : null}
                </ul>
            </>
        );

    return (
        <main className="page">
            <h2>Список устройств</h2>
            {error && <p className="error-text">{error}</p>}
            <DevicesListFilters
                draft={draftFilters}
                filtersPending={filtersPending}
                setDraftFilters={setDraftFilters}
                onApply={applyFilters}
            />
            <ListPagination
                page={page}
                pageSize={pageSize}
                total={total}
                loading={fetching}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                }}
            />
            <DevicesListBulkBar
                count={selectedDevices.size}
                deleting={deleting}
                onOpenQrSheet={() => setSheetModalOpen(true)}
                onDeleteSelected={() => requestDelete(selectedDevicesList)}
            />
            <DevicesListTable
                items={items}
                total={total}
                sortBy={sortBy}
                sortDir={sortDir}
                selectedIds={selectedDevices}
                deleting={deleting}
                onSort={handleSort}
                onSelectAll={handleSelectAll}
                onSelectOne={handleSelectDevice}
                onOpen={openDevice}
                onDelete={requestDelete}
            />
            <QrSheetSettingsModal
                open={sheetModalOpen}
                onClose={() => setSheetModalOpen(false)}
                items={selectedQrTargets}
                variant="device"
            />
            <ConfirmDialog
                open={deleteTargets !== null}
                title={deleteDialogTitle}
                message={deleteDialogMessage}
                confirmLabel="Удалить"
                cancelLabel="Отмена"
                confirmVariant="danger"
                busy={deleting}
                onConfirm={() => void executeDelete()}
                onCancel={() => {
                    if (!deleting) {
                        setDeleteTargets(null);
                    }
                }}
            />
            <ScrollToTopButton />
        </main>
    );
}
