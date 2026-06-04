import React from 'react';
import { NewIconPicker } from './CategoryIconPickers';

type CategoryCreateFormProps = {
    newName: string;
    newIconFile: File | null;
    isAdmin: boolean;
    iconInputRef: React.RefObject<HTMLInputElement>;
    onNameChange: (value: string) => void;
    onIconPick: (file: File | null) => void;
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export function CategoryCreateForm({
    newName,
    newIconFile,
    isAdmin,
    iconInputRef,
    onNameChange,
    onIconPick,
    onSubmit,
}: CategoryCreateFormProps) {

    return (
        <form className="admin-inline-form admin-inline-form--tight admin-category-page-form" onSubmit={onSubmit}>
            <label className="admin-inline-field admin-inline-field--grow">
                <span className="admin-inline-label">Название</span>
                <input
                    value={newName}
                    onChange={(e) => onNameChange(e.target.value)}
                    placeholder="Например: Ноутбуки"
                    required
                    disabled={!isAdmin}
                />
            </label>
            <div className="admin-inline-field admin-category-icon-field">
                <span className="admin-inline-label">Иконка</span>
                <NewIconPicker
                    inputRef={iconInputRef}
                    fileName={newIconFile?.name ?? null}
                    onPick={onIconPick}
                    disabled={!isAdmin}
                />
            </div>
            <div className="admin-inline-actions">
                <button type="submit" className="btn-primary btn-compact" disabled={!isAdmin}>
                    Добавить
                </button>
            </div>
        </form>
    );
}
