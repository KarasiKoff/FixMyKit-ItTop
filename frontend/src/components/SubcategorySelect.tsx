import React from 'react';
import type { SubcategoryDto } from '../api/categories';

type Props = {
    subcategories: SubcategoryDto[];
    value: string;
    onChange: (subcategoryId: string) => void;
    disabled?: boolean;
    required?: boolean;
    label?: string;
};

export function SubcategorySelect({
    subcategories,
    value,
    onChange,
    disabled,
    required,
    label = 'Подкатегория',
}: Props) {
    if (subcategories.length === 0) {
        return null;
    }

    return (
        <label className="admin-device-field">
            <span className="admin-inline-label">{label}</span>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                required={required}
            >
                <option value="">—</option>
                {subcategories.map((s) => (
                    <option key={s.id} value={s.id}>
                        {s.name}
                    </option>
                ))}
            </select>
        </label>
    );
}
