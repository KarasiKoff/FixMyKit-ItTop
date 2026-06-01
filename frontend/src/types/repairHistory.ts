export type RepairHistoryEntry = {
    id: string;
    deviceId: string;
    repairRequestId?: string;
    oldStatus?: 'not_in_repair' | 'in_repair';
    newStatus?: 'not_in_repair' | 'in_repair';
    note?: string;
    createdAt: string;
    ticketKey?: string;
    ticketUrl?: string;
};
