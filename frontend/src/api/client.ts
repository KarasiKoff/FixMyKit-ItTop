import { clearLegacyAuthToken, logout } from './auth';

export class ApiError extends Error {
    status: number;
    detail: unknown;

    constructor(status: number, detail: unknown) {
        super(typeof detail === 'string' ? detail : `API request failed with status ${status}`);
        this.status = status;
        this.detail = detail;
    }
}

export type ApiRequestOptions = RequestInit & { skipAuth?: boolean };

export function apiBaseUrl(): string {
    const raw = import.meta.env.VITE_API_BASE_URL;
    if (raw === undefined || raw === null || String(raw).trim() === '') {
        return '';
    }
    return String(raw).replace(/\/+$/, '');
}

export function resolveApiUrl(path: string): string {
    if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;
    }
    const base = apiBaseUrl();
    return base === '' ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function apiRequest<T>(path: string, init: ApiRequestOptions = {}): Promise<T> {
    const { skipAuth, ...rest } = init;
    const method = (rest.method ?? 'GET').toUpperCase();
    const headers = new Headers(rest.headers);

    if (rest.body && !headers.has('Content-Type') && !(rest.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(resolveApiUrl(path), {
        ...rest,
        method,
        headers,
        credentials: skipAuth ? 'same-origin' : 'include',
    });

    if (response.status === 204) {
        return undefined as T;
    }

    const contentType = response.headers.get('content-type') ?? '';
    const payload = contentType.includes('application/json') ? await response.json() : await response.text();

    if (!response.ok) {
        if (response.status === 401 && !skipAuth) {
            clearLegacyAuthToken();
            try {
                await logout();
            } catch {
                /* cookie already invalid */
            }
        }
        throw new ApiError(
            response.status,
            typeof payload === 'object' && payload !== null && 'detail' in payload ? payload.detail : payload,
        );
    }

    return payload as T;
}
