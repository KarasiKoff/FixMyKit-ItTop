import { apiRequest } from './client';

export async function fetchPublicAudienceByName(name: string) {
    const params = new URLSearchParams({ name: name.trim() });
    return apiRequest<{ id: string; name: string }>(
        `/api/public/audiences/by-name?${params.toString()}`,
        { skipAuth: true },
    );
}

export async function shortenPublicUrl(url: string) {
    return apiRequest<{ url: string; short_url: string }>('/api/public/shorten-url', {
        method: 'POST',
        body: JSON.stringify({ url }),
        skipAuth: true,
    });
}
