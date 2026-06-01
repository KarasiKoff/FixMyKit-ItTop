export type RepairRequest = {
    id: string;
    deviceId: string;
    requesterName: string;
    description: string;
    status: 'new' | 'in_progress' | 'closed';
    takenBySysadmin: boolean;
    isPublished: boolean;
    createdAt: string;
    ticketId?: string;
    ticketKey?: string;
    ticketUrl?: string;
    lastSyncedAt?: string;
    deviceInventoryNumber?: string;
    deviceName?: string;
    hasAttachments?: boolean;
    attachmentsSyncStatus?: 'none' | 'partial' | 'complete';
    attachmentsCount?: number;
};

export type TrackerAttachment = {
    id: string;
    name: string;
    kind: 'image' | 'video';
    mimetype?: string | null;
    size?: number | null;
    hasThumbnail: boolean;
    createdAt?: string | null;
};

export type RepairRequestDetail = RepairRequest & {
    resolutionNote?: string | null;
    resolutionDesc?: string | null;
    closedAt?: string | null;
    closedByUserId?: string | null;
    closedByTrackerDisplay?: string | null;
};

export type PublicRepairRequestItem = {
    id: string;
    description: string;
    status: 'open' | 'in_progress' | 'closed';
    createdAt: string;
    closedAt?: string | null;
    resolutionNote?: string | null;
    applicantName?: string | null;
};

export type PublicDeviceInfo = {
    id: string;
    inventoryNumber: string;
    name: string;
    category?: { id: string; name: string } | null;
    audience?: { id: number; name: string } | null;
};

export type PublicRepairSummary = {
    device: PublicDeviceInfo;
    activeRequest: PublicRepairRequestItem | null;
    hasUnpublishedActive: boolean;
    history: PublicRepairRequestItem[];
};
