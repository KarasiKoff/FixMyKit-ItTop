import React from 'react';
import type { CategoryDto } from '../../../api/categories';
import { IconEdit, IconTrash } from '../AdminDashboardIcons';
import { CategoryRowIcon } from './CategoryRowIcon';

type CategoriesTableProps = {
    rows: CategoryDto[];
    isAdmin: boolean;
    onEdit: (row: CategoryDto) => void;
    onDelete: (row: CategoryDto) => void;
};

export function CategoriesTable({ rows, isAdmin, onEdit, onDelete }: CategoriesTableProps) {
    const sortedRows = [...rows].sort((a, b) => a.name.localeCompare(b.name, 'ru'));

    return (
        <div className="table-wrap admin-table-wrap">
            <table className="admin-table">
                <thead>
                    <tr>
                        <th className="table-col-start">Название</th>
                        <th className="table-col-center table-col--narrow">Действия</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedRows.map((row) => (
                        <tr key={row.id}>
                            <td className="table-col-start">
                                <span className="category-name-cell">
                                    {row.has_icon && <CategoryRowIcon id={row.id} hasIcon={row.has_icon} />}
                                    {row.name}
                                </span>
                            </td>
                            <td className="table-col-center table-col--narrow">
                                <div className="admin-row-actions">
                                    <button
                                        type="button"
                                        className="btn-icon-accent btn-compact btn-icon"
                                        disabled={!isAdmin}
                                        onClick={() => onEdit(row)}
                                        aria-label="Изменить"
                                        title="Изменить"
                                    >
                                        <IconEdit />
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-danger btn-compact btn-icon"
                                        disabled={!isAdmin}
                                        onClick={() => void onDelete(row)}
                                        aria-label="Удалить"
                                        title="Удалить"
                                    >
                                        <IconTrash />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
