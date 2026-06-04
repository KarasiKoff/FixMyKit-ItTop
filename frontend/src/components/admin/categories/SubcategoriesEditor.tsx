import React, { useState } from 'react';
import {
    createSubcategory,
    deleteSubcategory,
    updateSubcategory,
    type CategoryDto,
    type SubcategoryDto,
} from '../../../api/categories';
import { IconCheck, IconClose, IconEdit, IconTrash } from '../AdminDashboardIcons';
import { useToast } from '../../../hooks/useToast';
import { formatApiError } from '../../../utils/formatApiError';

type SubcategoriesEditorProps = {
    category: CategoryDto;
    isAdmin: boolean;
    onReload: () => Promise<void>;
};

export function SubcategoriesEditor({ category, isAdmin, onReload }: SubcategoriesEditorProps) {
    const { showSuccess, showError } = useToast();
    const [newName, setNewName] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editActive, setEditActive] = useState(true);
    const [busy, setBusy] = useState(false);

    const items = [...(category.subcategories ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'ru'));

    async function handleAdd(event: React.FormEvent) {
        event.preventDefault();
        if (!isAdmin) return;
        const n = newName.trim();
        if (!n) return;
        setBusy(true);
        try {
            await createSubcategory(category.id, n);
            setNewName('');
            showSuccess('Подкатегория добавлена');
            await onReload();
        } catch (err) {
            showError(formatApiError(err));
        } finally {
            setBusy(false);
        }
    }

    function startEdit(sub: SubcategoryDto) {
        setEditingId(sub.id);
        setEditName(sub.name);
        setEditActive(sub.is_active);
    }

    async function saveSubEdit() {
        if (!isAdmin || !editingId) return;
        const n = editName.trim();
        if (!n) return;
        setBusy(true);
        try {
            await updateSubcategory(editingId, { name: n, is_active: editActive });
            setEditingId(null);
            showSuccess('Сохранено');
            await onReload();
        } catch (err) {
            showError(formatApiError(err));
        } finally {
            setBusy(false);
        }
    }

    async function removeSub(sub: SubcategoryDto) {
        if (!isAdmin) return;
        if (!window.confirm(`Удалить подкатегорию «${sub.name}»? У связанных устройств поле будет сброшено.`)) {
            return;
        }
        setBusy(true);
        try {
            await deleteSubcategory(sub.id);
            if (editingId === sub.id) setEditingId(null);
            showSuccess('Подкатегория удалена');
            await onReload();
        } catch (err) {
            showError(formatApiError(err));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="category-edit-modal__subcategories">
            <h4 className="category-edit-modal__section-title">Подкатегории</h4>
            {items.length === 0 ? (
                <p className="muted-text subcategory-admin-cell__empty">Нет подкатегорий</p>
            ) : (
                <ul className="subcategory-admin-list">
                    {items.map((sub) => (
                        <li key={sub.id} className="subcategory-admin-list__item">
                            {editingId === sub.id ? (
                                <>
                                    <input
                                        className="subcategory-admin-list__input"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        disabled={!isAdmin || busy}
                                        autoFocus
                                    />
                                    <label className="subcategory-admin-list__active-toggle">
                                        <input
                                            type="checkbox"
                                            checked={editActive}
                                            onChange={(e) => setEditActive(e.target.checked)}
                                            disabled={!isAdmin || busy}
                                        />
                                        <span>Активна</span>
                                    </label>
                                </>
                            ) : (
                                <span className={sub.is_active ? '' : 'muted-text'}>
                                    {sub.name}
                                    {!sub.is_active ? ' (неактивна)' : ''}
                                </span>
                            )}
                            {isAdmin ? (
                                <div className="subcategory-admin-list__actions">
                                    {editingId === sub.id ? (
                                        <>
                                            <button
                                                type="button"
                                                className="btn-icon-accent btn-compact btn-icon"
                                                disabled={busy}
                                                onClick={() => void saveSubEdit()}
                                                aria-label="Сохранить"
                                                title="Сохранить"
                                            >
                                                <IconCheck />
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-danger btn-compact btn-icon"
                                                onClick={() => setEditingId(null)}
                                                aria-label="Отмена"
                                                title="Отмена"
                                            >
                                                <IconClose />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                type="button"
                                                className="btn-icon-accent btn-compact btn-icon"
                                                disabled={busy}
                                                onClick={() => startEdit(sub)}
                                                aria-label="Изменить"
                                                title="Изменить"
                                            >
                                                <IconEdit />
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-danger btn-compact btn-icon"
                                                disabled={busy}
                                                onClick={() => void removeSub(sub)}
                                                aria-label="Удалить"
                                                title="Удалить"
                                            >
                                                <IconTrash />
                                            </button>
                                        </>
                                    )}
                                </div>
                            ) : null}
                        </li>
                    ))}
                </ul>
            )}
            {isAdmin ? (
                <form className="subcategory-admin-add" onSubmit={handleAdd}>
                    <input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Новая подкатегория"
                        disabled={busy}
                    />
                    <button type="submit" className="btn-compact" disabled={busy || !newName.trim()}>
                        Добавить
                    </button>
                </form>
            ) : null}
        </div>
    );
}
