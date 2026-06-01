export type SortDir = 'asc' | 'desc';

export type DeviceSuggestField = 'inventory_number' | 'name' | 'category' | 'room' | 'responsible';

export type DeviceSortBy =
    | 'inventory_number'
    | 'name'
    | 'category_name'
    | 'audience_name'
    | 'responsible_name'
    | 'repair_status';

export type RepairRequestSortBy = 'created_at' | 'device_inventory_number' | 'applicant_name' | 'status';

export type PageSize = 10 | 20 | 50;
