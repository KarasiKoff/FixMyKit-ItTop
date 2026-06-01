export type Device = {
    id: string;
    inventoryNumber: string;
    name: string;
    category: string;
    categoryId: string | null;
    serialNumber: string;
    room: string;
    audienceId: number | null;
    responsible: string;
    responsibleId: string | null;
    status: 'not_in_repair' | 'in_repair';
    takenBySysadmin: boolean;
};
