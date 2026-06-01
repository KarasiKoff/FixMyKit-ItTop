import { apiRequest } from './client';

type LoginCredentials = {
    login: string;
    password: string;
};

type TokenResponse = {
    access_token: string;
    token_type: string;
};

export type UserResponse = {
    id: string;
    login: string;
    role: 'admin' | 'sysadmin';
    full_name: string | null;
};

const AUTH_TOKEN_KEY = 'fix-my-kit-auth-token';

export async function login(credentials: LoginCredentials): Promise<TokenResponse> {
    return apiRequest<TokenResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
    });
}

export async function changeOwnPassword(currentPassword: string, newPassword: string) {
    await apiRequest<void>('/api/auth/me/password', {
        method: 'POST',
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
}

export async function getCurrentUser(token: string): Promise<UserResponse> {
    return apiRequest<UserResponse>('/api/auth/me', {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}

export function getStoredAuthToken(): string | null {
    return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function hasStoredAuthToken(): boolean {
    return getStoredAuthToken() !== null;
}

export function setStoredAuthToken(token: string) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearStoredAuthToken() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
}
