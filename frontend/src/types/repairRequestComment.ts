export type RepairRequestComment = {
    id: string;
    repairRequestId: string;
    authorUserId: string;
    authorLogin?: string | null;
    authorDisplayName?: string | null;
    trackerAuthorUnlinked?: boolean;
    body: string;
    trackerSynced: boolean;
    createdAt: string;
};
