import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useAdminCategories } from '../../hooks/useAdminCategories';
import { CategoryCreateForm } from '../../components/admin/categories/CategoryCreateForm';
import { CategoriesTable } from '../../components/admin/categories/CategoriesTable';
import { CategoryEditModal } from '../../components/admin/categories/CategoryEditModal';

export function AdminAddCategory() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const {
        rows,
        loading,
        newName,
        setNewName,
        newIconFile,
        setNewIconFile,
        newIconInputRef,
        modalCategory,
        modalBusy,
        setModalBusy,
        reload,
        handleAdd,
        openEditModal,
        closeEditModal,
        removeRow,
    } = useAdminCategories(isAdmin);

    return (
        <main className="page page--centered">
            <div className="admin-page-head admin-page-head--edges">
                <Link to="/admin" className="admin-back-link">
                    ← К админке
                </Link>
                <h2 className="page-title">Категории</h2>
            </div>

            <section className="card admin-crud-sheet">
                <CategoryCreateForm
                    newName={newName}
                    newIconFile={newIconFile}
                    isAdmin={isAdmin}
                    iconInputRef={newIconInputRef}
                    onNameChange={setNewName}
                    onIconPick={setNewIconFile}
                    onSubmit={handleAdd}
                />

                {loading ? (
                    <p className="admin-crud-empty muted-text">Загрузка…</p>
                ) : rows.length === 0 ? (
                    <p className="admin-crud-empty muted-text">Категории не добавлены</p>
                ) : (
                    <CategoriesTable rows={rows} isAdmin={isAdmin} onEdit={openEditModal} onDelete={removeRow} />
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
