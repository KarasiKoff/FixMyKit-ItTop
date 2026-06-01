import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { createAudience, deleteAudience, fetchAudiences, updateAudience, type AudienceDto } from '../../api/audiences';
import { IconCheck, IconClose, IconEdit, IconTrash } from '../../components/admin/AdminDashboardIcons';
import { ScrollToTopButton } from '../../components/ScrollToTopButton';
import { formatApiError } from '../../utils/formatApiError';

export function AdminAddRoom() {
    const { showSuccess, showError } = useToast();
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    const [rows, setRows] = useState<AudienceDto[]>([]);
    const [newRoom, setNewRoom] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editNumber, setEditNumber] = useState('');
    const [loading, setLoading] = useState(true);

    async function reload() {
        setLoading(true);
        try {
            const items = await fetchAudiences();
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
        if (!isAdmin) {
            return;
        }
        const n = newRoom.trim();
        if (!n) {
            return;
        }
        try {
            await createAudience(n);
            setNewRoom('');
            showSuccess('Кабинет добавлен');
            await reload();
        } catch (err) {
            showError(formatApiError(err));
        }
    }

    function startEdit(row: AudienceDto) {
        setEditingId(row.id);
        setEditNumber(row.name);
    }

    async function saveEdit() {
        if (!isAdmin || editingId === null) {
            return;
        }
        const n = editNumber.trim();
        if (!n) {
            return;
        }
        try {
            await updateAudience(editingId, { name: n });
            setEditingId(null);
            showSuccess('Сохранено');
            await reload();
        } catch (err) {
            showError(formatApiError(err));
        }
    }

    async function removeRow(row: AudienceDto) {
        if (!isAdmin) {
            return;
        }
        if (
            !window.confirm(
                `Удалить кабинет «${row.name}»? Все устройства в этом кабинете будут удалены вместе с заявками и историей.`,
            )
        ) {
            return;
        }
        try {
            await deleteAudience(row.id);
            if (editingId === row.id) {
                setEditingId(null);
            }
            showSuccess('Кабинет и связанные устройства удалены');
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
                <h2 className="page-title">Кабинеты</h2>
            </div>

            <section className="card admin-crud-sheet">
                <form className="admin-inline-form admin-inline-form--room" onSubmit={handleAdd}>
                    <label className="admin-inline-field admin-inline-field--grow">
                        <span className="admin-inline-label">Номер кабинета</span>
                        <input
                            value={newRoom}
                            onChange={(e) => setNewRoom(e.target.value)}
                            placeholder="Например: 305"
                            disabled={!isAdmin}
                        />
                    </label>
                    <div className="admin-inline-actions">
                        <button type="submit" className="btn-primary" disabled={!isAdmin}>
                            Добавить
                        </button>
                    </div>
                </form>

                <div className="table-wrap admin-table-wrap">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th className="table-col-start">Номер / название</th>
                                <th className="table-col-center table-col--narrow">Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr className="admin-table-placeholder-row">
                                    <td colSpan={2}>Загрузка…</td>
                                </tr>
                            ) : sortedRows.length === 0 ? (
                                <tr className="admin-table-placeholder-row">
                                    <td colSpan={2} />
                                </tr>
                            ) : (
                                sortedRows.map((row) => (
                                    <tr key={row.id} className={editingId === row.id ? 'admin-table-row--editing' : undefined}>
                                        <td className="table-col-start admin-table-cell--input">
                                            {editingId === row.id ? (
                                                <input value={editNumber} onChange={(e) => setEditNumber(e.target.value)} disabled={!isAdmin} />
                                            ) : (
                                                row.name
                                            )}
                                        </td>
                                        <td className="table-col-center table-col--narrow">
                                            <div
                                                className={
                                                    editingId === row.id
                                                        ? 'admin-row-actions'
                                                        : 'admin-row-actions admin-row-actions--grid'
                                                }
                                            >
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
                                                            onClick={() => setEditingId(null)}
                                                            aria-label="Отмена"
                                                            title="Отмена"
                                                        >
                                                            <IconClose />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Link
                                                            to={`/admin/room/${row.id}/map`}
                                                            className="btn-ghost btn-compact admin-row-actions__full"
                                                        >
                                                            Карта
                                                        </Link>
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
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
            <ScrollToTopButton />
        </main>
    );
}
