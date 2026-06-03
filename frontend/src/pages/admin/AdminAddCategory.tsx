import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import {
    createCategory,
    createSubcategory,
    deleteCategory,
    deleteCategoryIcon,
    deleteSubcategory,
    fetchCategories,
    updateCategory,
    updateSubcategory,
    uploadCategoryIcon,
    type CategoryDto,
    type SubcategoryDto,
} from '../../api/categories';
import { IconCheck, IconClose, IconEdit, IconTrash } from '../../components/admin/AdminDashboardIcons';
import { useCategoryIconSrc } from '../../hooks/useCategoryIconSrc';
import { formatApiError } from '../../utils/formatApiError';

const ICON_ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml,.svg';
const ICON_HINT = 'PNG, JPEG, WebP, SVG · до 1 МБ';

function CategoryRowIcon({ id, hasIcon }: { id: string; hasIcon: boolean }) {
    const src = useCategoryIconSrc(id, hasIcon);
    return (
        <img
            src={src}
            alt=""
            className="category-name-cell__icon"
            draggable={false}
        />
    );
}

function NewIconPicker({
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
            title={ICON_HINT}
        >
            <span className="category-new-icon-btn__icon" aria-hidden>
                {fileName ? '📎' : '🖼'}
            </span>
            <span className="category-new-icon-btn__text">{fileName ?? 'Выбрать иконку'}</span>
            <input
                ref={inputRef}
                type="file"
                accept={ICON_ACCEPT}
                disabled={disabled}
                style={{ display: 'none' }}
                onChange={(e) => onPick(e.target.files?.[0] ?? null)}
            />
        </label>
    );
}

function EditIconPicker({
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
        <div className={`category-edit-icon-field${hasIcon ? ' category-edit-icon-field--has-icon' : ''}${disabled ? ' row-disabled' : ''}`}>
            <label className="category-edit-icon-field__label" title={hasIcon ? 'Нажмите чтобы сменить иконку' : ICON_HINT}>
                {hasIcon ? (
                    <img src={iconSrc} alt="иконка категории" draggable={false} />
                ) : (
                    <span>🖼 Иконка</span>
                )}
                <input
                    ref={inputRef}
                    type="file"
                    accept={ICON_ACCEPT}
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

function SubcategoriesEditor({
    category,
    isAdmin,
    onReload,
}: {
    category: CategoryDto;
    isAdmin: boolean;
    onReload: () => Promise<void>;
}) {
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

function CategoryEditModal({
    category,
    isAdmin,
    busy,
    onBusyChange,
    onClose,
    onReload,
}: {
    category: CategoryDto;
    isAdmin: boolean;
    busy: boolean;
    onBusyChange: (busy: boolean) => void;
    onClose: () => void;
    onReload: () => Promise<void>;
}) {
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
                        className="btn-primary"
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

export function AdminAddCategory() {
    const { showSuccess, showError } = useToast();
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    const [rows, setRows] = useState<CategoryDto[]>([]);
    const [newName, setNewName] = useState('');
    const [newIconFile, setNewIconFile] = useState<File | null>(null);
    const newIconInputRef = useRef<HTMLInputElement>(null);
    const [loading, setLoading] = useState(true);
    const [modalCategoryId, setModalCategoryId] = useState<string | null>(null);
    const [modalBusy, setModalBusy] = useState(false);

    const modalCategory = modalCategoryId ? rows.find((r) => r.id === modalCategoryId) ?? null : null;

    async function reload() {
        setLoading(true);
        try {
            const items = await fetchCategories();
            setRows(items);
        } catch (err) {
            showError(formatApiError(err));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void reload();
    }, []);

    async function handleAdd(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!isAdmin) return;
        const n = newName.trim();
        if (!n) return;
        try {
            const created = await createCategory(n);
            if (newIconFile) await uploadCategoryIcon(created.id, newIconFile);
            setNewName('');
            setNewIconFile(null);
            if (newIconInputRef.current) newIconInputRef.current.value = '';
            showSuccess('Категория добавлена');
            await reload();
        } catch (err) {
            showError(formatApiError(err));
        }
    }

    function openEditModal(row: CategoryDto) {
        setModalCategoryId(row.id);
    }

    function closeEditModal() {
        if (modalBusy) return;
        setModalCategoryId(null);
    }

    async function removeRow(row: CategoryDto) {
        if (!isAdmin) return;
        if (!window.confirm(`Удалить категорию «${row.name}»? У связанных устройств поле категории будет сброшено.`)) {
            return;
        }
        try {
            await deleteCategory(row.id);
            if (modalCategoryId === row.id) setModalCategoryId(null);
            showSuccess('Категория удалена');
            await reload();
        } catch (err) {
            showError(formatApiError(err));
        }
    }

    const sortedRows = [...rows].sort((a, b) => a.name.localeCompare(b.name, 'ru'));

    return (
        <main className="page page--centered">
            <div className="admin-page-head admin-page-head--edges">
                <Link to="/admin" className="admin-back-link">
                    ← К админке
                </Link>
                <h2 className="page-title">Категории</h2>
            </div>

            <section className="card admin-crud-sheet">
                <form className="admin-inline-form admin-inline-form--tight admin-category-page-form" onSubmit={handleAdd}>
                    <label className="admin-inline-field admin-inline-field--grow">
                        <span className="admin-inline-label">Название</span>
                        <input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="Например: Ноутбуки"
                            required
                            disabled={!isAdmin}
                        />
                    </label>
                    <div className="admin-inline-field admin-category-icon-field">
                        <span className="admin-inline-label">Иконка</span>
                        <NewIconPicker
                            inputRef={newIconInputRef}
                            fileName={newIconFile?.name ?? null}
                            onPick={setNewIconFile}
                            disabled={!isAdmin}
                        />
                    </div>
                    <div className="admin-inline-actions">
                        <button type="submit" className="btn-primary" disabled={!isAdmin}>
                            Добавить
                        </button>
                    </div>
                </form>

                {loading ? (
                    <p className="admin-crud-empty muted-text">Загрузка…</p>
                ) : sortedRows.length === 0 ? (
                    <p className="admin-crud-empty muted-text">Категории не добавлены</p>
                ) : (
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
                                                    onClick={() => openEditModal(row)}
                                                    aria-label="Изменить"
                                                    title="Изменить"
                                                >
                                                    <IconEdit />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn-danger btn-compact btn-icon"
                                                    disabled={!isAdmin}
                                                    onClick={() => void removeRow(row)}
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
                )}
            </section>

            {modalCategory ? (
                <CategoryEditModal
                    category={modalCategory}
                    isAdmin={isAdmin}
                    busy={modalBusy}
                    onBusyChange={setModalBusy}
                    onClose={closeEditModal}
                    onReload={reload}
                />
            ) : null}
        </main>
    );
}
