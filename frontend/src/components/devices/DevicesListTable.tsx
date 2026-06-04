import React from 'react';
import { Link } from 'react-router-dom';
import { SortableTh } from '../SortableTh';
import { IconTrash } from '../admin/AdminDashboardIcons';
import { Device } from '../../types/device';
import type { DeviceSortBy, SortDir } from '../../types/listQuery';
import { deviceRepairStatusLabel, deviceRepairStatusPillClass } from '../../utils/statusDisplay';

type DevicesListTableProps = {
    items: Device[];
    total: number;
    sortBy: DeviceSortBy;
    sortDir: SortDir;
    selectedIds: Set<string>;
    deleting: boolean;
    onSort: (key: string) => void;
    onSelectAll: () => void;
    onSelectOne: (id: string) => void;
    onOpen: (id: string) => void;
    onDelete: (devices: Device[], event?: React.MouseEvent) => void;
};

export function DevicesListTable({
    items,
    total,
    sortBy,
    sortDir,
    selectedIds,
    deleting,
    onSort,
    onSelectAll,
    onSelectOne,
    onOpen,
    onDelete,
}: DevicesListTableProps) {
    return (
        <section className="card">
            <h3>Оборудование ({total})</h3>
            <div className="table-wrap">
                <table className="requests-table">
                    <thead>
                        <tr>
                            <th className="table-col-center">
                                <input
                                    type="checkbox"
                                    checked={selectedIds.size === items.length && items.length > 0}
                                    onChange={onSelectAll}
                                />
                            </th>
                            <SortableTh
                                label="Инв. номер"
                                sortKey="inventory_number"
                                activeSortBy={sortBy}
                                sortDir={sortDir}
                                onSort={onSort}
                                className="table-col-center"
                            />
                            <SortableTh
                                label="Название"
                                sortKey="name"
                                activeSortBy={sortBy}
                                sortDir={sortDir}
                                onSort={onSort}
                                className="table-col-center"
                            />
                            <SortableTh
                                label="Категория"
                                sortKey="category_name"
                                activeSortBy={sortBy}
                                sortDir={sortDir}
                                onSort={onSort}
                                className="table-col-center"
                            />
                            <SortableTh
                                label="Подкатегория"
                                sortKey="subcategory_name"
                                activeSortBy={sortBy}
                                sortDir={sortDir}
                                onSort={onSort}
                                className="table-col-center"
                            />
                            <SortableTh
                                label="Кабинет"
                                sortKey="audience_name"
                                activeSortBy={sortBy}
                                sortDir={sortDir}
                                onSort={onSort}
                                className="table-col-center"
                            />
                            <SortableTh
                                label="Ответственный"
                                sortKey="responsible_name"
                                activeSortBy={sortBy}
                                sortDir={sortDir}
                                onSort={onSort}
                                className="table-col-center"
                            />
                            <SortableTh
                                label="Статус"
                                sortKey="repair_status"
                                activeSortBy={sortBy}
                                sortDir={sortDir}
                                onSort={onSort}
                                className="table-col-center"
                            />
                            <th className="table-col-center">Карточка</th>
                            <th className="table-col-center table-col--narrow">
                                <span className="visually-hidden">Удалить</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((device) => (
                            <tr
                                key={device.id}
                                className="requests-row-clickable"
                                tabIndex={0}
                                onClick={() => onOpen(device.id)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        onOpen(device.id);
                                    }
                                }}
                            >
                                <td className="table-col-center" onClick={(event) => event.stopPropagation()}>
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.has(device.id)}
                                        onChange={() => onSelectOne(device.id)}
                                    />
                                </td>
                                <td className="table-col-center">{device.inventoryNumber}</td>
                                <td className="table-col-center">{device.name}</td>
                                <td className="table-col-center">{device.category}</td>
                                <td className="table-col-center">{device.subcategory || '—'}</td>
                                <td className="table-col-center">{device.room}</td>
                                <td className="table-col-center">{device.responsible}</td>
                                <td className="status-cell table-col-center">
                                    <span className={deviceRepairStatusPillClass(device.status)}>
                                        {deviceRepairStatusLabel(device.status)}
                                    </span>
                                </td>
                                <td
                                    className="table-col-center requests-row-actions-cell"
                                    onClick={(event) => event.stopPropagation()}
                                >
                                    <Link to={`/devices/${device.id}`} onClick={(event) => event.stopPropagation()}>
                                        Открыть
                                    </Link>
                                </td>
                                <td
                                    className="table-col-center requests-row-actions-cell"
                                    onClick={(event) => event.stopPropagation()}
                                >
                                    <button
                                        type="button"
                                        className="btn-danger btn-compact btn-icon"
                                        disabled={deleting}
                                        onClick={(event) => onDelete([device], event)}
                                        aria-label="Удалить"
                                        title="Удалить"
                                    >
                                        <IconTrash />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
