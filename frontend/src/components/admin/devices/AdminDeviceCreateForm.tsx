import React from 'react';
import type { AudienceDto } from '../../../api/audiences';
import type { CategoryDto, SubcategoryDto } from '../../../api/categories';
import type { UserListItem } from '../../../api/users';
import { CategorySelectWithIcons } from '../../CategorySelectWithIcons';
import { SubcategorySelect } from '../../SubcategorySelect';
import { Device } from '../../../types/device';
import { deviceRepairStatusLabel } from '../../../utils/statusDisplay';
import { BULK_COUNT_MAX } from '../../../utils/deviceBulkNaming';

type AdminDeviceCreateFormProps = {
    loadError: string | null;
    categories: CategoryDto[];
    audiences: AudienceDto[];
    usersList: UserListItem[];
    inventoryNumber: string;
    name: string;
    categoryId: string;
    subcategoryId: string;
    serialNumber: string;
    audienceId: string;
    responsibleId: string;
    status: Device['status'];
    note: string;
    bulkMode: boolean;
    bulkCount: number;
    bulkCountMin: number;
    selectedAudience: AudienceDto | undefined;
    subcategoryOptions: SubcategoryDto[];
    subcategoryRequired: boolean;
    onInventoryNumberChange: (value: string) => void;
    onNameChange: (value: string) => void;
    onCategoryChange: (id: string) => void;
    onSubcategoryChange: (id: string) => void;
    onSerialNumberChange: (value: string) => void;
    onAudienceChange: (id: string) => void;
    onResponsibleChange: (id: string) => void;
    onStatusChange: (status: Device['status']) => void;
    onNoteChange: (value: string) => void;
    onBulkModeChange: (value: boolean) => void;
    onBulkCountChange: (value: number) => void;
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export function AdminDeviceCreateForm(props: AdminDeviceCreateFormProps) {
    const {
        loadError,
        categories,
        audiences,
        usersList,
        inventoryNumber,
        name,
        categoryId,
        subcategoryId,
        serialNumber,
        audienceId,
        responsibleId,
        status,
        note,
        bulkMode,
        bulkCount,
        bulkCountMin,
        selectedAudience,
        subcategoryOptions,
        subcategoryRequired,
        onInventoryNumberChange,
        onNameChange,
        onCategoryChange,
        onSubcategoryChange,
        onSerialNumberChange,
        onAudienceChange,
        onResponsibleChange,
        onStatusChange,
        onNoteChange,
        onBulkModeChange,
        onBulkCountChange,
        onSubmit,
    } = props;

    return (
        <form className="admin-device-form" onSubmit={onSubmit}>
            <div className="admin-device-bulk-block">
                <label className="checkbox-field admin-device-bulk-toggle">
                    <input type="checkbox" checked={bulkMode} onChange={(e) => onBulkModeChange(e.target.checked)} />
                    <span>Несколько ПК в этом кабинете</span>
                </label>

                {bulkMode ? (
                    <div className="admin-device-field admin-device-bulk-quantity">
                        <span className="admin-inline-label">Количество</span>
                        <input
                            type="range"
                            className="admin-bulk-range"
                            min={bulkCountMin}
                            max={BULK_COUNT_MAX}
                            value={bulkCount}
                            onChange={(e) => onBulkCountChange(Number(e.target.value))}
                        />
                        <div className="admin-bulk-count-row">
                            <input
                                type="number"
                                min={bulkCountMin}
                                max={BULK_COUNT_MAX}
                                value={bulkCount}
                                onChange={(e) => onBulkCountChange(Number(e.target.value) || bulkCountMin)}
                            />
                            <span className="muted-text">шт.</span>
                        </div>
                        <p className="form-hint muted-text">
                            {selectedAudience
                                ? `Имена: ${selectedAudience.name}-1, ${selectedAudience.name}-2, …`
                                : 'Сначала выберите кабинет ниже'}
                        </p>
                    </div>
                ) : null}
            </div>

            {!bulkMode ? (
                <>
                    <label className="admin-device-field">
                        <span className="admin-inline-label">Инвентарный номер</span>
                        <input value={inventoryNumber} onChange={(e) => onInventoryNumberChange(e.target.value)} required />
                    </label>
                    <label className="admin-device-field">
                        <span className="admin-inline-label">Название</span>
                        <input
                            value={name}
                            onChange={(e) => onNameChange(e.target.value)}
                            placeholder="Ноутбук Lenovo T14"
                            required
                        />
                    </label>
                </>
            ) : null}
            <CategorySelectWithIcons
                categories={categories}
                value={categoryId}
                onChange={onCategoryChange}
                disabled={Boolean(loadError)}
            />
            <SubcategorySelect
                subcategories={subcategoryOptions}
                value={subcategoryId}
                onChange={onSubcategoryChange}
                categorySelected={Boolean(categoryId)}
                disabled={Boolean(loadError)}
                required={subcategoryRequired}
            />
            <label className="admin-device-field">
                <span className="admin-inline-label">Серийный номер</span>
                <input
                    value={serialNumber}
                    onChange={(e) => onSerialNumberChange(e.target.value)}
                    placeholder="LNV-T14-2391"
                />
                {bulkMode && serialNumber.trim() ? (
                    <p className="form-hint muted-text">
                        Серийные: {serialNumber.trim()}-1, {serialNumber.trim()}-2, …
                    </p>
                ) : null}
            </label>
            <label className="admin-device-field">
                <span className="admin-inline-label">Кабинет</span>
                <select value={audienceId} onChange={(e) => onAudienceChange(e.target.value)} required={bulkMode}>
                    <option value="">—</option>
                    {audiences.map((a) => (
                        <option key={a.id} value={String(a.id)}>
                            {a.name}
                        </option>
                    ))}
                </select>
            </label>

            <label className="admin-device-field">
                <span className="admin-inline-label">Ответственный</span>
                <select value={responsibleId} onChange={(e) => onResponsibleChange(e.target.value)}>
                    <option value="">—</option>
                    {usersList.map((u) => (
                        <option key={u.id} value={u.id}>
                            {u.name === u.login ? u.login : `${u.name} (${u.login})`}
                        </option>
                    ))}
                </select>
            </label>
            <label className="admin-device-field">
                <span className="admin-inline-label">Статус</span>
                <select value={status} onChange={(e) => onStatusChange(e.target.value as Device['status'])}>
                    <option value="not_in_repair">{deviceRepairStatusLabel('not_in_repair')}</option>
                    <option value="in_repair">{deviceRepairStatusLabel('in_repair')}</option>
                </select>
            </label>
            <label className="admin-device-field">
                <span className="admin-inline-label">Заметка</span>
                <textarea
                    value={note}
                    onChange={(e) => onNoteChange(e.target.value)}
                    rows={3}
                    placeholder="Необязательно: особенности устройства для сисадминов"
                />
            </label>
            <div className="admin-device-actions">
                <button type="submit" className="btn-primary btn-compact" disabled={bulkMode && !selectedAudience}>
                    {bulkMode ? `Добавить ${bulkCount} устройств` : 'Добавить устройство'}
                </button>
            </div>
        </form>
    );
}
