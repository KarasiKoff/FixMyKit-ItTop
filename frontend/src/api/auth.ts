import { apiRequest } from './client';

type LoginCredentials = {
    login: string;
    password: string;
};

type LoginResponse = {
    token_type: string;
};

export type UserResponse = {
    id: string;
    login: string;
    role: 'admin' | 'sysadmin';
    full_name: string | null;
};

const LEGACY_AUTH_TOKEN_KEY = 'fix-my-kit-auth-token';

/** Удаляет устаревший JWT из localStorage  */
export function clearLegacyAuthToken() {
    localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
}

export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
    return apiRequest<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
        skipAuth: true,
    });
}

export async function logout() {
    await apiRequest<void>('/api/auth/logout', { method: 'POST' });
}

export async function changeOwnPassword(currentPassword: string, newPassword: string) {
    await apiRequest<void>('/api/auth/me/password', {
        method: 'POST',
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
}

export async function getCurrentUser(): Promise<UserResponse> {
    return apiRequest<UserResponse>('/api/auth/me');
}
