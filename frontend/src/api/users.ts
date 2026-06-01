import { apiRequest } from './client';

export type UserListItem = {
    id: string;
    login: string;
    name: string;
    role: 'admin' | 'sysadmin';
    isActive: boolean;
    createdAt: string;
};

type UserApi = {
    id: string;
    login: string;
    full_name?: string | null;
    role: 'admin' | 'sysadmin';
    is_active: boolean;
    created_at: string;
};

function mapUser(item: UserApi): UserListItem {
    return {
        id: item.id,
        login: item.login,
        name: item.full_name ?? item.login,
        role: item.role,
        isActive: item.is_active,
        createdAt: item.created_at,
    };
}

export async function fetchUsers(params?: { search?: string; limit?: number; offset?: number }) {
    const sp = new URLSearchParams();
    if (params?.search) {
        sp.set('search', params.search);
    }
    if (params?.limit != null) {
        sp.set('limit', String(params.limit));
    }
    if (params?.offset != null) {
        sp.set('offset', String(params.offset));
    }
    const q = sp.toString();
    const response = await apiRequest<{ items: UserApi[]; total: number }>(`/api/users${q ? `?${q}` : ''}`);
    return { items: response.items.map(mapUser), total: response.total };
}

/** Поиск пользователя по id в общем списке API (пагинация до первого совпадения). */
export async function fetchUserListItemById(userId: string): Promise<UserListItem | null> {
    const limit = 100;
    let offset = 0;
    for (;;) {
        const { items, total } = await fetchUsers({ limit, offset });
        const hit = items.find((u) => u.id === userId);
        if (hit) {
            return hit;
        }
        offset += limit;
        if (offset >= total || items.length === 0) {
            return null;
        }
    }
}

export async function createUser(payload: {
    login: string;
    password: string;
    role: 'admin' | 'sysadmin';
    full_name?: string | null;
}) {
    const item = await apiRequest<UserApi>('/api/users', {
        method: 'POST',
        body: JSON.stringify({
            login: payload.login,
            password: payload.password,
            role: payload.role,
            full_name: payload.full_name ?? null,
        }),
    });
    return mapUser(item);
}

export async function updateUser(
    id: string,
    payload: { role?: 'admin' | 'sysadmin'; full_name?: string | null; is_active?: boolean },
) {
    const item = await apiRequest<UserApi>(`/api/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    });
    return mapUser(item);
}

export async function adminResetUserPassword(userId: string, newPassword: string) {
    await apiRequest<void>(`/api/users/${userId}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ password: newPassword }),
    });
}
