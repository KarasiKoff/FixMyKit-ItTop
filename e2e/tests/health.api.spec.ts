import { test, expect } from '@playwright/test';

const apiBase = process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://127.0.0.1:8000';

test.describe('API health', () => {
    test('liveness', async ({ request }) => {
        const response = await request.get(`${apiBase}/health`);
        test.skip(response.status() === 0, 'Backend не запущен — задайте PLAYWRIGHT_API_BASE_URL');
        expect(response.ok()).toBeTruthy();
        expect(await response.json()).toEqual({ status: 'ok' });
    });

    test('readiness', async ({ request }) => {
        const response = await request.get(`${apiBase}/health/ready`);
        test.skip(response.status() === 0, 'Backend не запущен');
        if (response.status() === 503) {
            test.skip(true, 'PostgreSQL недоступен для readiness');
        }
        expect(response.ok()).toBeTruthy();
    });
});
