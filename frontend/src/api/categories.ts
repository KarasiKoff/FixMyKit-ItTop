import { apiRequest, resolveApiUrl, ApiError } from './client';
import { getStoredAuthToken } from './auth';

export type CategoryDto = {
    id: string;
    name: string;
    is_active: boolean;
    created_at: string;
    has_icon: boolean;
};

export async function fetchCategories(isActive?: boolean) {
    const q = isActive === undefined ? '' : `?is_active=${isActive}`;
    const response = await apiRequest<{ items: CategoryDto[] }>(`/api/categories${q}`);
    return response.items;
}

export async function createCategory(name: string) {
    return apiRequest<CategoryDto>('/api/categories', {
        method: 'POST',
        body: JSON.stringify({ name }),
    });
}

export async function updateCategory(id: string, payload: { name?: string; is_active?: boolean }) {
    return apiRequest<CategoryDto>(`/api/categories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    });
}

export async function deleteCategory(id: string) {
    await apiRequest<void>(`/api/categories/${id}`, { method: 'DELETE' });
}

/** Загрузка или замена иконки (multipart). Только админ. */
export async function uploadCategoryIcon(id: string, file: File) {
    const token = getStoredAuthToken();
    const body = new FormData();
    body.append('file', file);
    const response = await fetch(resolveApiUrl(`/api/categories/${id}/icon`), {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body,
    });
    if (!response.ok) {
        const text = await response.text();
        let detail: unknown = text;
        try {
            const j = JSON.parse(text) as { detail?: unknown };
            if (j && typeof j === 'object' && 'detail' in j) detail = j.detail;
        } catch {
            /* ignore */
        }
        throw new ApiError(response.status, detail);
    }
    return response.json() as Promise<CategoryDto>;
}

export async function deleteCategoryIcon(id: string) {
    return apiRequest<CategoryDto>(`/api/categories/${id}/icon`, { method: 'DELETE' });
}

export async function fetchCategoryIconBlob(categoryId: string): Promise<Blob | null> {
    const token = getStoredAuthToken();
    const response = await fetch(resolveApiUrl(`/api/categories/${categoryId}/icon`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (response.status === 404) return null;
    if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
    }
    return response.blob();
}
