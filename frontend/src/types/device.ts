export type Device = {
    id: string;
    inventoryNumber: string;
    name: string;
    category: string;
    categoryId: string | null;
    subcategory: string;
    subcategoryId: string | null;
    serialNumber: string;
    room: string;
    audienceId: string | null;
    responsible: string;
    responsibleId: string | null;
    status: 'not_in_repair' | 'in_repair';
    note: string | null;
};
