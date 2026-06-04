import React, { useCallback } from 'react';
import { suggestDevices } from '../../api/devices';
import { FilterCombobox } from '../FilterCombobox';
import { Device } from '../../types/device';
import type { DeviceSuggestField } from '../../types/listQuery';
import { deviceRepairStatusLabel } from '../../utils/statusDisplay';

export type DeviceFilters = {
    inventoryNumber: string;
    name: string;
    category: string;
    room: string;
    responsible: string;
    status: '' | Device['status'];
};

type DevicesListFiltersProps = {
    draft: DeviceFilters;
    filtersPending: boolean;
    setDraftFilters: React.Dispatch<React.SetStateAction<DeviceFilters>>;
    onApply: () => void;
};

export function DevicesListFilters({ draft, filtersPending, setDraftFilters, onApply }: DevicesListFiltersProps) {
    const suggest = useCallback((field: DeviceSuggestField) => {
        return (query: string) => suggestDevices(field, query);
    }, []);

    const patch = (partial: Partial<DeviceFilters>) => setDraftFilters((p) => ({ ...p, ...partial }));

    return (
        <section className="card">
            <h3>Поиск и фильтрация</h3>
            <p className="filter-hint">
                Поиск по части текста (например, «303» найдёт 303-1 и 303-GIFD). Инв. номер ищет также в названии.
            </p>
            <div className="grid grid-filters">
                <FilterCombobox
                    label="Инв. номер"
                    value={draft.inventoryNumber}
                    placeholder="Инвентарный номер"
                    onChange={(v) => patch({ inventoryNumber: v })}
                    fetchSuggestions={suggest('inventory_number')}
                />
                <FilterCombobox
                    label="Название"
                    value={draft.name}
                    placeholder="Название устройства"
                    onChange={(v) => patch({ name: v })}
                    fetchSuggestions={suggest('name')}
                />
                <FilterCombobox
                    label="Категория / подкатегория"
                    value={draft.category}
                    placeholder="Категория или подкатегория"
                    onChange={(v) => patch({ category: v })}
                    fetchSuggestions={suggest('category')}
                />
                <FilterCombobox
                    label="Кабинет"
                    value={draft.room}
                    placeholder="Кабинет"
                    onChange={(v) => patch({ room: v })}
                    fetchSuggestions={suggest('room')}
                />
                <FilterCombobox
                    label="Ответственный"
                    value={draft.responsible}
                    placeholder="ФИО или логин"
                    onChange={(v) => patch({ responsible: v })}
                    fetchSuggestions={suggest('responsible')}
                />
                <div className="filter-select-field">
                    <span className="filter-combobox-label">Статус</span>
                    <select
                        className={`filter-select-field-input${draft.status === '' ? ' is-empty' : ''}`}
                        value={draft.status}
                        onChange={(event) =>
                            patch({ status: event.target.value as DeviceFilters['status'] })
                        }
                    >
                        <option value="">Любой статус</option>
                        <option value="not_in_repair">{deviceRepairStatusLabel('not_in_repair')}</option>
                        <option value="in_repair">{deviceRepairStatusLabel('in_repair')}</option>
                    </select>
                </div>
            </div>
            <div className="filter-actions">
                <button type="button" className="btn-primary btn-compact" disabled={!filtersPending} onClick={onApply}>
                    Применить фильтры
                </button>
            </div>
        </section>
    );
}
