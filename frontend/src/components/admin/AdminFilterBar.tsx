import React from 'react';

type AdminFilterBarProps = {
    children: React.ReactNode;
    filtersPending: boolean;
    onApply: () => void;
    hint?: string;
    applyLabel?: string;
    /** Встроить в родительскую карточку без отдельного блока «Фильтры». */
    embedded?: boolean;
    title?: string;
    actions?: React.ReactNode;
};

export function AdminFilterBar({
    children,
    filtersPending,
    onApply,
    hint,
    applyLabel = 'Применить',
    embedded = false,
    title = 'Фильтры',
    actions,
}: AdminFilterBarProps) {
    const className = embedded
        ? 'admin-filter-bar admin-filter-bar--embedded'
        : 'card card--admin-block admin-filter-bar';

    return (
        <section className={className}>
            {!embedded && title ? <h3 className="admin-block-title">{title}</h3> : null}
            {hint ? <p className="filter-hint">{hint}</p> : null}
            <div className="admin-filter-bar__row">
                <div className="admin-filter-bar__fields">{children}</div>
                <div className="admin-filter-bar__actions">
                    <button
                        type="button"
                        className="btn-primary btn-compact"
                        disabled={!filtersPending}
                        onClick={onApply}
                    >
                        {applyLabel}
                    </button>
                    {actions}
                </div>
            </div>
        </section>
    );
}
