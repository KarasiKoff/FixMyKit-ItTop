import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    fetchRepairRequests,
    isRepairRequestSynced,
    suggestRepairRequests,
    syncAllUnsynchronizedRepairRequests,
    syncRepairRequestTracker,
    type RepairRequestSuggestField,
} from '../api/repairRequests';
import { FilterCombobox } from '../components/FilterCombobox';
import { ScrollToTopButton } from '../components/ScrollToTopButton';
import { ListPagination } from '../components/ListPagination';
import { SortableTh } from '../components/SortableTh';
import { useToast } from '../hooks/useToast';
import { RepairRequest } from '../types/repairRequest';
import type { PageSize, RepairRequestSortBy, SortDir } from '../types/listQuery';
import { formatApiError } from '../utils/formatApiError';
import { repairRequestStatusLabel, repairRequestStatusPillClass } from '../utils/statusDisplay';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { AttachmentClipIcon } from '../components/AttachmentClipIcon';
import { yandexTrackerIssueWebHref } from '../utils/yandexTracker';
import { attachmentClipIsActionable, attachmentClipTone } from '../utils/attachmentSyncDisplay';
import { useRepairRequestSse } from '../hooks/useRepairRequestSse';

type RequestFilters = {
    device: string;
    applicant: string;
    status: '' | 'open' | 'in_progress' | 'needs_info' | 'closed';
};

const DEFAULT_SORT: RepairRequestSortBy = 'created_at';
const DEFAULT_DIR: SortDir = 'desc';

const EMPTY_FILTERS: RequestFilters = { device: '', applicant: '', status: '' };

function deviceLabel(request: RepairRequest): string {
    if (request.audienceName) {
        return `Кабинет: ${request.audienceName}`;
    }
    if (request.audienceId != null) {
        return `Кабинет #${request.audienceId}`;
    }
    if (request.deviceInventoryNumber) {
        return request.deviceInventoryNumber;
    }
    if (request.deviceName) {
        return request.deviceName;
    }
    return request.deviceId ?? '—';
}

export function RepairRequests() {
    const navigate = useNavigate();
    const { showSuccess, showError } = useToast();

    const [bulkLoading, setBulkLoading] = useState(false);
    const [syncingId, setSyncingId] = useState<string | null>(null);

    const {
        items,
        total,
        fetching,
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
        handleSort: handleSortBase,
        setSortDir,
        reload,
    } = usePaginatedList<RepairRequest, RequestFilters, RepairRequestSortBy>({
        emptyFilters: EMPTY_FILTERS,
        defaultSort: DEFAULT_SORT,
        defaultDir: DEFAULT_DIR,
        load: async ({ filters, page: p, pageSize: ps, sortBy: sb, sortDir: sd }) => {
            try {
                return await fetchRepairRequests({
                    device: filters.device || undefined,
                    applicant: filters.applicant || undefined,
                    status: filters.status || undefined,
                    sort_by: sb,
                    sort_dir: sd,
                    limit: ps,
                    offset: (p - 1) * ps,
                });
            } catch (err) {
                showError(formatApiError(err));
                throw err;
            }
        },
    });

    useRepairRequestSse({
        onEvent: () => {
            void reload({ silent: true });
        },
    });

    const suggest = useCallback((field: RepairRequestSuggestField) => {
        return (query: string) => suggestRepairRequests(field, query);
    }, []);

    function handleSort(key: string) {
        const col = key as RepairRequestSortBy;
        if (sortBy !== col) {
            setPage(1);
            handleSortBase(col);
            if (col === 'created_at') {
                setSortDir('desc');
            }
            return;
        }
        handleSortBase(key);
    }

    async function handleBulkSync() {
        setBulkLoading(true);
        try {
            const res = await syncAllUnsynchronizedRepairRequests();
            showSuccess(`Готово: синхронизировано ${res.synced} из ${res.attempted}, ошибок: ${res.failed}`);
            await reload();
        } catch (err) {
            showError(formatApiError(err));
        } finally {
            setBulkLoading(false);
        }
    }

    async function handleRowSync(id: string) {
        if (syncingId) {
            return;
        }
        setSyncingId(id);
        try {
            await syncRepairRequestTracker(id);
            showSuccess('Синхронизация с Трекером выполнена');
            await reload();
        } catch (err) {
            showError(formatApiError(err));
        } finally {
            setSyncingId(null);
        }
    }

    function goToRequest(id: string) {
        navigate(`/requests/${id}`);
    }

    return (
        <main className="page page--wide">
            <h2>Все заявки</h2>
            <section className="card">
                <h3>Поиск и фильтрация</h3>
                <p className="filter-hint">Поиск по части текста. Поле «Устройство» ищет в инв. номере и названии.</p>
                <div className="grid grid-filters grid-filters--3">
                    <FilterCombobox
                        label="Устройство"
                        value={draftFilters.device}
                        placeholder="Инв. номер или название"
                        onChange={(v) => setDraftFilters((p) => ({ ...p, device: v }))}
                        fetchSuggestions={suggest('device')}
                    />
                    <FilterCombobox
                        label="Заявитель"
                        value={draftFilters.applicant}
                        placeholder="Имя заявителя"
                        onChange={(v) => setDraftFilters((p) => ({ ...p, applicant: v }))}
                        fetchSuggestions={suggest('applicant')}
                    />
                    <div className="filter-select-field">
                        <span className="filter-combobox-label">Статус</span>
                        <select
                            className={`filter-select-field-input${draftFilters.status === '' ? ' is-empty' : ''}`}
                            value={draftFilters.status}
                            onChange={(event) =>
                                setDraftFilters((p) => ({
                                    ...p,
                                    status: event.target.value as RequestFilters['status'],
                                }))
                            }
                        >
                            <option value="">Любой статус</option>
                            <option value="open">{repairRequestStatusLabel('open')}</option>
                            <option value="in_progress">{repairRequestStatusLabel('in_progress')}</option>
                            <option value="needs_info">{repairRequestStatusLabel('needs_info')}</option>
                            <option value="closed">{repairRequestStatusLabel('closed')}</option>
                        </select>
                    </div>
                </div>
                <div className="filter-actions">
                    <button type="button" className="btn-primary" disabled={!filtersPending} onClick={applyFilters}>
                        Применить фильтры
                    </button>
                </div>
            </section>

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

            <section className="card">
                <div className="requests-toolbar">
                    <button
                        type="button"
                        className="btn-primary"
                        disabled={bulkLoading}
                        onClick={() => void handleBulkSync()}
                    >
                        {bulkLoading ? 'Синхронизация…' : 'Синхронизировать все несинхронизированные'}
                    </button>
                </div>
                <div className="table-wrap">
                    <table className="requests-table">
                        <thead>
                            <tr>
                                <SortableTh
                                    label="Дата"
                                    sortKey="created_at"
                                    activeSortBy={sortBy}
                                    sortDir={sortDir}
                                    onSort={handleSort}
                                    className="table-col-center"
                                />
                                <SortableTh
                                    label="Устройство/Кабинет"
                                    sortKey="device_inventory_number"
                                    activeSortBy={sortBy}
                                    sortDir={sortDir}
                                    onSort={handleSort}
                                    className="table-col-center"
                                />
                                <SortableTh
                                    label="Заявитель"
                                    sortKey="applicant_name"
                                    activeSortBy={sortBy}
                                    sortDir={sortDir}
                                    onSort={handleSort}
                                    className="table-col-center"
                                />
                                <SortableTh
                                    label="Статус"
                                    sortKey="status"
                                    activeSortBy={sortBy}
                                    sortDir={sortDir}
                                    onSort={handleSort}
                                    className="table-col-center"
                                />
                                <th className="table-col-center">Трекер</th>
                                <th className="table-col-center" aria-label="Файлы" />
                                <th className="table-col-center table-col--narrow" />
                            </tr>
                        </thead>
                        <tbody>
                            {items.length === 0 && !fetching ? (
                                <tr>
                                    <td colSpan={7}>Заявок пока нет.</td>
                                </tr>
                            ) : (
                                items.map((request) => {
                                    const synced = isRepairRequestSynced(request);
                                    const canSync = !synced && request.status !== 'closed';
                                    const trackerHref = yandexTrackerIssueWebHref(request.ticketKey, request.ticketUrl);
                                    const clipTone = attachmentClipTone(request);
                                    return (
                                        <tr
                                            key={request.id}
                                            className="requests-row-clickable"
                                            tabIndex={0}
                                            onClick={() => goToRequest(request.id)}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault();
                                                    goToRequest(request.id);
                                                }
                                            }}
                                        >
                                            <td className="table-col-center">
                                                {new Date(request.createdAt).toLocaleString('ru-RU')}
                                            </td>
                                            <td className="table-col-center">{deviceLabel(request)}</td>
                                            <td className="table-col-center">{request.requesterName}</td>
                                            <td className="status-cell table-col-center">
                                                <span className={repairRequestStatusPillClass(request.status)}>
                                                    {repairRequestStatusLabel(request.status)}
                                                </span>
                                            </td>
                                            <td className="table-col-center">
                                                {synced ? (request.ticketKey ? request.ticketKey : 'да') : 'нет'}
                                            </td>
                                            <td
                                                className="table-col-center"
                                                onClick={(event) => event.stopPropagation()}
                                                onKeyDown={(event) => event.stopPropagation()}
                                            >
                                                {clipTone ? (
                                                    <AttachmentClipIcon
                                                        tone={clipTone}
                                                        syncing={syncingId === request.id}
                                                        disabled={syncingId !== null && syncingId !== request.id}
                                                        onSync={
                                                            attachmentClipIsActionable(clipTone)
                                                                ? () => void handleRowSync(request.id)
                                                                : undefined
                                                        }
                                                    />
                                                ) : null}
                                            </td>
                                            <td
                                                className="table-cell-actions table-col-center requests-row-actions-cell"
                                                onClick={(event) => event.stopPropagation()}
                                                onKeyDown={(event) => event.stopPropagation()}
                                            >
                                                {trackerHref ? (
                                                    <a
                                                        href={trackerHref}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="btn-ghost btn-compact"
                                                        onClick={(event) => event.stopPropagation()}
                                                    >
                                                        Перейти в Tracker
                                                    </a>
                                                ) : canSync ? (
                                                    <button
                                                        type="button"
                                                        className="btn-ghost btn-compact"
                                                        disabled={syncingId !== null}
                                                        onClick={() => void handleRowSync(request.id)}
                                                    >
                                                        {syncingId === request.id
                                                            ? 'Синхронизация…'
                                                            : 'Синхронизировать'}
                                                    </button>
                                                ) : null}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
            <ScrollToTopButton />
        </main>
    );
}
