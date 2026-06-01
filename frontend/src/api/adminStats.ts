import { apiRequest } from './client';

export type AdminStats = {
    dateFrom: string | null;
    dateTo: string | null;
    repairRequests: {
        total: number;
        open: number;
        inProgress: number;
        resolved: number;
        wontFix: number;
        trackerSynced: number;
    };
    catalog: {
        devicesTotal: number;
        categoriesTotal: number;
        audiencesTotal: number;
    };
    devicesByCategory: Array<{
        categoryId: string | null;
        categoryName: string;
        deviceCount: number;
        sharePercent: number;
    }>;
    lastTrackerSyncAt: string | null;
};

type AdminStatsApi = {
    date_from: string | null;
    date_to: string | null;
    repair_requests: {
        total: number;
        open: number;
        in_progress: number;
        resolved: number;
        wont_fix: number;
        tracker_synced: number;
    };
    catalog: {
        devices_total: number;
        categories_total: number;
        audiences_total: number;
    };
    devices_by_category: Array<{
        category_id: string | null;
        category_name: string;
        device_count: number;
        share_percent: number;
    }>;
    last_tracker_sync_at: string | null;
};

function mapStats(data: AdminStatsApi): AdminStats {
    return {
        dateFrom: data.date_from,
        dateTo: data.date_to,
        repairRequests: {
            total: data.repair_requests.total,
            open: data.repair_requests.open,
            inProgress: data.repair_requests.in_progress,
            resolved: data.repair_requests.resolved,
            wontFix: data.repair_requests.wont_fix,
            trackerSynced: data.repair_requests.tracker_synced,
        },
        catalog: {
            devicesTotal: data.catalog.devices_total,
            categoriesTotal: data.catalog.categories_total,
            audiencesTotal: data.catalog.audiences_total,
        },
        devicesByCategory: data.devices_by_category.map((row) => ({
            categoryId: row.category_id,
            categoryName: row.category_name,
            deviceCount: row.device_count,
            sharePercent: row.share_percent,
        })),
        lastTrackerSyncAt: data.last_tracker_sync_at,
    };
}

export async function fetchAdminStats(params?: { dateFrom?: string; dateTo?: string }): Promise<AdminStats> {
    const search = new URLSearchParams();
    if (params?.dateFrom) {
        search.set('date_from', params.dateFrom);
    }
    if (params?.dateTo) {
        search.set('date_to', params.dateTo);
    }
    const qs = search.toString();
    const data = await apiRequest<AdminStatsApi>(`/api/admin/stats${qs ? `?${qs}` : ''}`);
    return mapStats(data);
}
