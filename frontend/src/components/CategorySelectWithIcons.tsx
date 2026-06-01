import React, { useEffect, useRef, useState } from 'react';
import sadCatUrl from '../icon/sad-cat.svg';
import type { CategoryDto } from '../api/categories';
import { useCategoryIconSrc } from '../hooks/useCategoryIconSrc';

function OptionIcon({ categoryId, hasIcon }: { categoryId: string; hasIcon: boolean }) {
    const src = useCategoryIconSrc(categoryId, hasIcon);
    return <img src={src} alt="" className="category-select__opt-icon" draggable={false} />;
}

type Props = {
    categories: CategoryDto[];
    value: string;
    onChange: (categoryId: string) => void;
    disabled?: boolean;
    label?: string;
};

export function CategorySelectWithIcons({ categories, value, onChange, disabled, label = 'Категория' }: Props) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    const selected = categories.find((c) => c.id === value);
    const selectedLabel = selected?.name ?? '—';

    useEffect(() => {
        if (!open) return;
        function onDoc(e: MouseEvent) {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);

    return (
        <label className="admin-device-field category-select">
            <span className="admin-inline-label">{label}</span>
            <div className={`category-select__root${disabled ? ' category-select__root--disabled' : ''}`} ref={rootRef}>
                <button
                    type="button"
                    className="category-select__trigger"
                    disabled={disabled}
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    onClick={() => !disabled && setOpen((o) => !o)}
                >
                    <span className="category-select__trigger-inner">
                        {value ? (
                            <OptionIcon categoryId={value} hasIcon={Boolean(selected?.has_icon)} />
                        ) : (
                            <img src={sadCatUrl} alt="" className="category-select__opt-icon" draggable={false} />
                        )}
                        <span className="category-select__trigger-text">{selectedLabel}</span>
                    </span>
                    <span className="category-select__chevron" aria-hidden>
                        ▾
                    </span>
                </button>
                {open && (
                    <ul className="category-select__panel" role="listbox">
                        <li role="option" aria-selected={value === ''}>
                            <button
                                type="button"
                                className="category-select__option"
                                onClick={() => {
                                    onChange('');
                                    setOpen(false);
                                }}
                            >
                                <img src={sadCatUrl} alt="" className="category-select__opt-icon" draggable={false} />
                                <span>—</span>
                            </button>
                        </li>
                        {categories.map((c) => (
                            <li key={c.id} role="option" aria-selected={value === c.id}>
                                <button
                                    type="button"
                                    className="category-select__option"
                                    onClick={() => {
                                        onChange(c.id);
                                        setOpen(false);
                                    }}
                                >
                                    <OptionIcon categoryId={c.id} hasIcon={c.has_icon} />
                                    <span>{c.name}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </label>
    );
}
