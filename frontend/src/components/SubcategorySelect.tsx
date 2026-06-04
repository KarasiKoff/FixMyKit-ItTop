import React from 'react';
import type { SubcategoryDto } from '../api/categories';

type Props = {
    subcategories: SubcategoryDto[];
    value: string;
    onChange: (subcategoryId: string) => void;
    categorySelected: boolean;
    disabled?: boolean;
    required?: boolean;
    label?: string;
};

export function SubcategorySelect({
    subcategories,
    value,
    onChange,
    categorySelected,
    disabled,
    required,
    label = 'Подкатегория',
}: Props) {
    const hasOptions = subcategories.length > 0;
    const selectDisabled = disabled || !categorySelected || !hasOptions;

    return (
        <label className="admin-device-field">
            <span className="admin-inline-label">{label}</span>
            <select
                value={hasOptions ? value : ''}
                onChange={(e) => onChange(e.target.value)}
                disabled={selectDisabled}
                required={required && hasOptions}
            >
                <option value="">—</option>
                {subcategories.map((s) => (
                    <option key={s.id} value={s.id}>
                        {s.name}
                    </option>
                ))}
            </select>
            {!categorySelected ? (
                <p className="form-hint muted-text">Сначала выберите категорию</p>
            ) : !hasOptions ? (
                <p className="form-hint muted-text">У этой категории нет подкатегорий</p>
            ) : null}
        </label>
    );
}
