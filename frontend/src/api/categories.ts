import { apiRequest, resolveApiUrl, ApiError } from './client';
import { getStoredAuthToken } from './auth';

export type SubcategoryDto = {
    id: string;
    category_id: string;
    name: string;
    is_active: boolean;
    created_at: string;
};

export type CategoryDto = {
    id: string;
    name: string;
    is_active: boolean;
    created_at: string;
    has_icon: boolean;
    subcategories?: SubcategoryDto[];
};

export function activeSubcategories(category: CategoryDto | undefined): SubcategoryDto[] {
    return (category?.subcategories ?? []).filter((s) => s.is_active);
}

export function categoryRequiresSubcategory(category: CategoryDto | undefined): boolean {
    return activeSubcategories(category).length > 0;
}

/** Активные + текущая привязка (если подкатегория уже неактивна). */
export function subcategoriesForDeviceForm(
    category: CategoryDto | undefined,
    currentSubcategoryId: string,
): SubcategoryDto[] {
    const active = activeSubcategories(category);
    if (!currentSubcategoryId) {
        return active;
    }
    const current = (category?.subcategories ?? []).find((s) => s.id === currentSubcategoryId);
    if (current && !active.some((s) => s.id === current.id)) {
        return [...active, current];
    }
    return active;
}

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

export async function createSubcategory(categoryId: string, name: string) {
    return apiRequest<SubcategoryDto>(`/api/categories/${categoryId}/subcategories`, {
        method: 'POST',
        body: JSON.stringify({ name }),
    });
}

export async function updateSubcategory(
    id: string,
    payload: { name?: string; is_active?: boolean },
) {
    return apiRequest<SubcategoryDto>(`/api/categories/subcategories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    });
}

export async function deleteSubcategory(id: string) {
    await apiRequest<void>(`/api/categories/subcategories/${id}`, { method: 'DELETE' });
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
