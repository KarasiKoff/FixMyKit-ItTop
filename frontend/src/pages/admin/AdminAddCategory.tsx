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

/** Пикер иконки для формы создания — высота совпадает с обычным input */
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

/** Пикер иконки для режима редактирования — компактный, ✕ в углу */
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
                    onClick={(e) => { e.stopPropagation(); onRemove(); }}
                    title="Удалить иконку"
                    aria-label="Удалить иконку"
                >
                    ✕
                </button>
            ) : null}
        </div>
    );
}

function SubcategoriesCell({
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

    async function saveEdit() {
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
        <div className="subcategory-admin-cell">
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
                                                onClick={() => void saveEdit()}
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

export function AdminAddCategory() {
    const { showSuccess, showError } = useToast();
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    const [rows, setRows] = useState<CategoryDto[]>([]);
    const [newName, setNewName] = useState('');
    const [newIconFile, setNewIconFile] = useState<File | null>(null);
    const newIconInputRef = useRef<HTMLInputElement>(null);
    const [loading, setLoading] = useState(true);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const rowIconInputRef = useRef<HTMLInputElement>(null);

    const editingRow = editingId ? rows.find((r) => r.id === editingId) : null;

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

    function startEdit(row: CategoryDto) {
        setEditingId(row.id);
        setEditName(row.name);
    }

    function cancelEdit() {
        setEditingId(null);
        if (rowIconInputRef.current) rowIconInputRef.current.value = '';
    }

    async function saveEdit() {
        if (!isAdmin || !editingId) return;
        const n = editName.trim();
        if (!n) return;
        try {
            await updateCategory(editingId, { name: n });
            setEditingId(null);
            showSuccess('Сохранено');
            await reload();
        } catch (err) {
            showError(formatApiError(err));
        }
    }

    async function removeRow(row: CategoryDto) {
        if (!isAdmin) return;
        if (!window.confirm(`Удалить категорию «${row.name}»? У связанных устройств поле категории будет сброшено.`)) return;
        try {
            await deleteCategory(row.id);
            if (editingId === row.id) setEditingId(null);
            showSuccess('Категория удалена');
            await reload();
        } catch (err) {
            showError(formatApiError(err));
        }
    }

    async function onPickRowIcon(fileList: FileList | null) {
        if (!isAdmin || !editingId || !fileList?.[0]) return;
        try {
            await uploadCategoryIcon(editingId, fileList[0]);
            if (rowIconInputRef.current) rowIconInputRef.current.value = '';
            showSuccess('Иконка обновлена');
            await reload();
        } catch (err) {
            showError(formatApiError(err));
        }
    }

    async function onRemoveIcon() {
        if (!isAdmin || !editingId) return;
        if (!window.confirm('Удалить иконку категории?')) return;
        try {
            await deleteCategoryIcon(editingId);
            showSuccess('Иконка удалена');
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
                                <th className="table-col-start">Подкатегории</th>
                                <th className="table-col-center table-col--narrow">Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                                {sortedRows.map((row) => (
                                    <tr key={row.id} className={editingId === row.id ? 'admin-table-row--editing' : undefined}>
                                        <td className="table-col-start admin-table-cell--input">
                                            {editingId === row.id ? (
                                                <input
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    disabled={!isAdmin}
                                                    autoFocus
                                                />
                                            ) : (
                                                <span className="category-name-cell">
                                                    {row.has_icon && <CategoryRowIcon id={row.id} hasIcon={row.has_icon} />}
                                                    {row.name}
                                                </span>
                                            )}
                                        </td>
                                        <td className="table-col-start admin-table-cell--subcategories">
                                            <SubcategoriesCell
                                                category={row}
                                                isAdmin={isAdmin}
                                                onReload={reload}
                                            />
                                        </td>
                                        <td className="table-col-center table-col--narrow">
                                            <div className="admin-row-actions">
                                                {editingId === row.id ? (
                                                    <>
                                                        <button
                                                            type="button"
                                                            className="btn-icon-accent btn-compact btn-icon"
                                                            disabled={!isAdmin}
                                                            onClick={() => void saveEdit()}
                                                            aria-label="Сохранить"
                                                            title="Сохранить"
                                                        >
                                                            <IconCheck />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn-danger btn-compact btn-icon"
                                                            onClick={cancelEdit}
                                                            aria-label="Отмена"
                                                            title="Отмена"
                                                        >
                                                            <IconClose />
                                                        </button>
                                                        {isAdmin ? (
                                                            <EditIconPicker
                                                                categoryId={editingId}
                                                                hasIcon={editingRow?.has_icon ?? false}
                                                                inputRef={rowIconInputRef}
                                                                onPick={(files) => void onPickRowIcon(files)}
                                                                onRemove={() => void onRemoveIcon()}
                                                            />
                                                        ) : null}
                                                    </>
                                                ) : (
                                                    <>
                                                        <button
                                                            type="button"
                                                            className="btn-icon-accent btn-compact btn-icon"
                                                            disabled={!isAdmin}
                                                            onClick={() => startEdit(row)}
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
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
                )}
            </section>
        </main>
    );
}
