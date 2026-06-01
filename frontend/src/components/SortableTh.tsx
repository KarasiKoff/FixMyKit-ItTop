import React from 'react';
import type { SortDir } from '../types/listQuery';

type SortableThProps = {
    label: string;
    sortKey: string;
    activeSortBy: string;
    sortDir: SortDir;
    onSort: (key: string) => void;
    className?: string;
};

export function SortableTh({ label, sortKey, activeSortBy, sortDir, onSort, className }: SortableThProps) {
    const active = activeSortBy === sortKey;
    const arrow = active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

    return (
        <th className={className}>
            <button type="button" className="sortable-th-btn" onClick={() => onSort(sortKey)}>
                {label}
                <span className="sortable-th-arrow" aria-hidden>
                    {arrow}
                </span>
            </button>
        </th>
    );
}
