import React from 'react';
import { useCategoryIconSrc } from '../../../hooks/useCategoryIconSrc';
import { CATEGORY_ICON_ACCEPT, CATEGORY_ICON_HINT } from '../../../utils/categoryIconConstants';

export function NewIconPicker({
    inputRef,
    fileName,
    onPick,
    disabled,
}: {
    inputRef: React.RefObject<HTMLInputElement>;
    fileName: string | null;
    onPick: (file: File | null) => void;
    disabled?: boolean;
}) {
    return (
        <label
            className={`category-new-icon-btn${disabled ? ' row-disabled' : ''}${fileName ? ' category-new-icon-btn--picked' : ''}`}
            title={CATEGORY_ICON_HINT}
        >
            <span className="category-new-icon-btn__icon" aria-hidden>
                {fileName ? '📎' : '🖼'}
            </span>
            <span className="category-new-icon-btn__text">{fileName ?? 'Выбрать иконку'}</span>
            <input
                ref={inputRef}
                type="file"
                accept={CATEGORY_ICON_ACCEPT}
                disabled={disabled}
                style={{ display: 'none' }}
                onChange={(e) => onPick(e.target.files?.[0] ?? null)}
            />
        </label>
    );
}

export function EditIconPicker({
    categoryId,
    hasIcon,
    inputRef,
    onPick,
    onRemove,
    disabled,
}: {
    categoryId: string;
    hasIcon: boolean;
    inputRef: React.RefObject<HTMLInputElement>;
    onPick: (files: FileList | null) => void;
    onRemove: () => void;
    disabled?: boolean;
}) {
    const iconSrc = useCategoryIconSrc(hasIcon ? categoryId : null, hasIcon);

    return (
        <div
            className={`category-edit-icon-field${hasIcon ? ' category-edit-icon-field--has-icon' : ''}${disabled ? ' row-disabled' : ''}`}
        >
            <label
                className="category-edit-icon-field__label"
                title={hasIcon ? 'Нажмите чтобы сменить иконку' : CATEGORY_ICON_HINT}
            >
                {hasIcon ? <img src={iconSrc} alt="иконка категории" draggable={false} /> : <span>🖼 Иконка</span>}
                <input
                    ref={inputRef}
                    type="file"
                    accept={CATEGORY_ICON_ACCEPT}
                    disabled={disabled}
                    style={{ display: 'none' }}
                    onChange={(e) => onPick(e.target.files)}
                />
            </label>
            {hasIcon && !disabled ? (
                <button
                    type="button"
                    className="category-edit-icon-field__remove"
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    title="Удалить иконку"
                    aria-label="Удалить иконку"
                >
                    ✕
                </button>
            ) : null}
        </div>
    );
}
