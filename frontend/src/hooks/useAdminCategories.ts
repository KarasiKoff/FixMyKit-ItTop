import { useCallback, useEffect, useRef, useState } from 'react';
import {
    createCategory,
    deleteCategory,
    fetchCategories,
    uploadCategoryIcon,
    type CategoryDto,
} from '../api/categories';
import { useToast } from './useToast';
import { formatApiError } from '../utils/formatApiError';

export function useAdminCategories(isAdmin: boolean) {
    const { showSuccess, showError } = useToast();
    const [rows, setRows] = useState<CategoryDto[]>([]);
    const [newName, setNewName] = useState('');
    const [newIconFile, setNewIconFile] = useState<File | null>(null);
    const newIconInputRef = useRef<HTMLInputElement>(null);
    const [loading, setLoading] = useState(true);
    const [modalCategoryId, setModalCategoryId] = useState<string | null>(null);
    const [modalBusy, setModalBusy] = useState(false);

    const modalCategory = modalCategoryId ? (rows.find((r) => r.id === modalCategoryId) ?? null) : null;

    const reload = useCallback(async () => {
        setLoading(true);
        try {
            const items = await fetchCategories();
            setRows(items);
        } catch (err) {
            showError(formatApiError(err));
        } finally {
            setLoading(false);
        }
    }, [showError]);

    useEffect(() => {
        void reload();
    }, [reload]);

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

    return {
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
    };
}
