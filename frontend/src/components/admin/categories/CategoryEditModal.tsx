import React, { useEffect, useRef, useState } from 'react';
import {
    deleteCategoryIcon,
    updateCategory,
    uploadCategoryIcon,
    type CategoryDto,
} from '../../../api/categories';
import { EditIconPicker } from './CategoryIconPickers';
import { SubcategoriesEditor } from './SubcategoriesEditor';
import { useToast } from '../../../hooks/useToast';
import { formatApiError } from '../../../utils/formatApiError';

type CategoryEditModalProps = {
    category: CategoryDto;
    isAdmin: boolean;
    busy: boolean;
    onBusyChange: (busy: boolean) => void;
    onClose: () => void;
    onReload: () => Promise<void>;
};

export function CategoryEditModal({
    category,
    isAdmin,
    busy,
    onBusyChange,
    onClose,
    onReload,
}: CategoryEditModalProps) {
    const { showSuccess, showError } = useToast();
    const [editName, setEditName] = useState(category.name);
    const rowIconInputRef = useRef<HTMLInputElement>(null);
    const [hasIcon, setHasIcon] = useState(category.has_icon);

    useEffect(() => {
        setEditName(category.name);
        setHasIcon(category.has_icon);
    }, [category.id, category.name, category.has_icon]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !busy) {
                onClose();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [busy, onClose]);

    async function handleSave() {
        if (!isAdmin) return;
        const n = editName.trim();
        if (!n) return;
        onBusyChange(true);
        try {
            await updateCategory(category.id, { name: n });
            showSuccess('Категория сохранена');
            await onReload();
            onClose();
        } catch (err) {
            showError(formatApiError(err));
        } finally {
            onBusyChange(false);
        }
    }

    async function onPickRowIcon(fileList: FileList | null) {
        if (!isAdmin || !fileList?.[0]) return;
        onBusyChange(true);
        try {
            const updated = await uploadCategoryIcon(category.id, fileList[0]);
            setHasIcon(updated.has_icon);
            if (rowIconInputRef.current) rowIconInputRef.current.value = '';
            showSuccess('Иконка обновлена');
            await onReload();
        } catch (err) {
            showError(formatApiError(err));
        } finally {
            onBusyChange(false);
        }
    }

    async function onRemoveIcon() {
        if (!isAdmin) return;
        if (!window.confirm('Удалить иконку категории?')) return;
        onBusyChange(true);
        try {
            await deleteCategoryIcon(category.id);
            setHasIcon(false);
            showSuccess('Иконка удалена');
            await onReload();
        } catch (err) {
            showError(formatApiError(err));
        } finally {
            onBusyChange(false);
        }
    }

    return (
        <div
            className="modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="category-edit-modal-title"
            onClick={() => {
                if (!busy) onClose();
            }}
        >
            <div className="modal-panel category-edit-modal card" onClick={(e) => e.stopPropagation()}>
                <div className="modal-panel__head">
                    <h3 id="category-edit-modal-title">Редактирование категории</h3>
                    <button
                        type="button"
                        className="modal-panel__close"
                        disabled={busy}
                        onClick={onClose}
                        aria-label="Закрыть"
                    >
                        ✕
                    </button>
                </div>

                <label className="admin-device-field">
                    <span className="admin-inline-label">Название</span>
                    <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        disabled={!isAdmin || busy}
                        autoFocus
                    />
                </label>

                {isAdmin ? (
                    <div className="admin-inline-field category-edit-modal__icon-field">
                        <span className="admin-inline-label">Иконка</span>
                        <EditIconPicker
                            categoryId={category.id}
                            hasIcon={hasIcon}
                            inputRef={rowIconInputRef}
                            onPick={(files) => void onPickRowIcon(files)}
                            onRemove={() => void onRemoveIcon()}
                            disabled={busy}
                        />
                    </div>
                ) : null}

                <SubcategoriesEditor category={category} isAdmin={isAdmin} onReload={onReload} />

                <div className="modal-panel__actions">
                    <button type="button" className="modal-panel__btn-ghost" disabled={busy} onClick={onClose}>
                        Отмена
                    </button>
                    <button
                        type="button"
                        className="btn-primary btn-compact"
                        disabled={!isAdmin || busy || !editName.trim()}
                        onClick={() => void handleSave()}
                    >
                        {busy ? 'Сохранение…' : 'Сохранить'}
                    </button>
                </div>
            </div>
        </div>
    );
}
