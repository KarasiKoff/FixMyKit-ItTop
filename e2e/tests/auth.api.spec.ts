import { test, expect } from '@playwright/test';

const apiBase = process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://127.0.0.1:8000';

test.describe('API auth cookie', () => {
    test('login sets session cookie and logout clears it', async ({ request }) => {
        const health = await request.get(`${apiBase}/health`);
        test.skip(health.status() === 0, 'Backend не запущен — задайте PLAYWRIGHT_API_BASE_URL');

        const unauth = await request.get(`${apiBase}/api/auth/me`);
        expect(unauth.status()).toBe(401);

        const login = await request.post(`${apiBase}/api/auth/login`, {
            data: { login: 'admin', password: 'admin' },
        });
        test.skip(login.status() === 401, 'Admin user недоступен в этой БД');
        expect(login.ok()).toBeTruthy();
        expect(await login.json()).toEqual({ token_type: 'bearer' });

        const me = await request.get(`${apiBase}/api/auth/me`);
        expect(me.ok()).toBeTruthy();
        const user = await me.json();
        expect(user.login).toBe('admin');

        const logout = await request.post(`${apiBase}/api/auth/logout`);
        expect(logout.status()).toBe(204);

        const afterLogout = await request.get(`${apiBase}/api/auth/me`);
        expect(afterLogout.status()).toBe(401);
    });
});
