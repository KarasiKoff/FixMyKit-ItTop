import { useEffect, useState } from 'react';
import { createDevice } from '../api/devices';
import {
    categoryRequiresSubcategory,
    subcategoriesForDeviceForm,
    fetchCategories,
    type CategoryDto,
} from '../api/categories';
import { fetchAudiences, type AudienceDto } from '../api/audiences';
import { fetchUsers, type UserListItem } from '../api/users';
import { Device } from '../types/device';
import { useToast } from './useToast';
import { formatApiError } from '../utils/formatApiError';
import {
    BULK_COUNT_MIN,
    clampBulkCount,
    nextBulkDeviceIndex,
    nextBulkSerialIndex,
} from '../utils/deviceBulkNaming';

export function useAdminAddDeviceForm() {
    const { showSuccess, showError } = useToast();

    const [categories, setCategories] = useState<CategoryDto[]>([]);
    const [audiences, setAudiences] = useState<AudienceDto[]>([]);
    const [usersList, setUsersList] = useState<UserListItem[]>([]);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [inventoryNumber, setInventoryNumber] = useState('');
    const [name, setName] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [subcategoryId, setSubcategoryId] = useState('');
    const [serialNumber, setSerialNumber] = useState('');
    const [audienceId, setAudienceId] = useState<string>('');
    const [responsibleId, setResponsibleId] = useState('');
    const [status, setStatus] = useState<Device['status']>('not_in_repair');
    const [note, setNote] = useState('');
    const [bulkMode, setBulkMode] = useState(false);
    const [bulkCount, setBulkCount] = useState(16);

    const selectedAudience = audiences.find((a) => String(a.id) === audienceId);
    const selectedCategory = categories.find((c) => c.id === categoryId);
    const subcategoryOptions = subcategoriesForDeviceForm(selectedCategory, subcategoryId);
    const subcategoryRequired = categoryRequiresSubcategory(selectedCategory);

    useEffect(() => {
        let cancelled = false;
        void Promise.all([fetchCategories(), fetchAudiences(), fetchUsers({ limit: 100 })])
            .then(([cats, auds, usersRes]) => {
                if (cancelled) {
                    return;
                }
                setCategories(cats);
                setAudiences(auds);
                setUsersList(usersRes.items);
                setLoadError(null);
                if (cats[0]) {
                    setCategoryId((prev) => prev || cats[0].id);
                }
                if (auds[0]) {
                    setAudienceId((prev) => prev || String(auds[0].id));
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    setLoadError(formatApiError(err));
                }
            });
        return () => {
            cancelled = true;
        };
    }, []);

    function handleCategoryChange(nextCategoryId: string) {
        setCategoryId(nextCategoryId);
        setSubcategoryId('');
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (subcategoryRequired && !subcategoryId) {
            showError('Выберите подкатегорию для этой категории');
            return;
        }

        const serialPrefix = serialNumber.trim();
        const sharedPayload = {
            category_id: categoryId || null,
            subcategory_id: subcategoryId || null,
            audience_id: audienceId || null,
            responsible_id: responsibleId || null,
            repair_status: status,
            note: note.trim() || null,
        };

        try {
            if (bulkMode) {
                const roomName = selectedAudience?.name?.trim();
                if (!roomName) {
                    showError('Выберите кабинет для массового добавления');
                    return;
                }

                const startIndex = await nextBulkDeviceIndex(roomName);
                const serialStartIndex = serialPrefix ? await nextBulkSerialIndex(serialPrefix) : null;
                let created = 0;

                for (let i = 0; i < bulkCount; i += 1) {
                    const label = `${roomName}-${startIndex + i}`;
                    await createDevice({
                        inventory_number: label,
                        name: label,
                        serial_number: serialStartIndex !== null ? `${serialPrefix}-${serialStartIndex + i}` : null,
                        ...sharedPayload,
                    });
                    created += 1;
                }

                showSuccess(
                    created === 1
                        ? 'Устройство добавлено'
                        : `Добавлено устройств: ${created} (${roomName}-${startIndex} … ${roomName}-${startIndex + created - 1})`,
                );
            } else {
                if (!inventoryNumber.trim() || !name.trim()) {
                    return;
                }
                await createDevice({
                    inventory_number: inventoryNumber.trim(),
                    name: name.trim(),
                    serial_number: serialPrefix || null,
                    ...sharedPayload,
                });
                showSuccess('Устройство добавлено');
                setInventoryNumber('');
                setName('');
                setSerialNumber('');
                setNote('');
                setStatus('not_in_repair');
            }
        } catch (err) {
            showError(formatApiError(err));
        }
    }

    return {
        loadError,
        categories,
        audiences,
        usersList,
        inventoryNumber,
        setInventoryNumber,
        name,
        setName,
        categoryId,
        subcategoryId,
        setSubcategoryId,
        serialNumber,
        setSerialNumber,
        audienceId,
        setAudienceId,
        responsibleId,
        setResponsibleId,
        status,
        setStatus,
        note,
        setNote,
        bulkMode,
        setBulkMode,
        bulkCount,
        setBulkCount: (value: number) => setBulkCount(clampBulkCount(value)),
        selectedAudience,
        subcategoryOptions,
        subcategoryRequired,
        handleCategoryChange,
        handleSubmit,
        bulkCountMin: BULK_COUNT_MIN,
    };
}
