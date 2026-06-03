import { apiRequest } from './client';

export type LogSource = 'app' | 'error';
export type LogLevelFilter = 'ALL' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL' | 'DEBUG';

export type LogEntry = {
    ts?: string | null;
    level: string;
    logger?: string | null;
    message: string;
    request_id?: string | null;
    exception?: string | null;
    extra?: Record<string, unknown> | null;
    raw?: string | null;
};

export type AdminLogsResponse = {
    source: LogSource;
    level_filter: LogLevelFilter;
    items: LogEntry[];
    files: Record<string, unknown>;
};

export async function fetchAdminLogs(params: {
    source?: LogSource;
    level?: LogLevelFilter;
    search?: string;
    limit?: number;
}): Promise<AdminLogsResponse> {
    const q = new URLSearchParams();
    if (params.source) {
        q.set('source', params.source);
    }
    if (params.level) {
        q.set('level', params.level);
    }
    if (params.search?.trim()) {
        q.set('search', params.search.trim());
    }
    if (params.limit) {
        q.set('limit', String(params.limit));
    }
    const query = q.toString();
    return apiRequest<AdminLogsResponse>(`/api/admin/logs${query ? `?${query}` : ''}`);
}
