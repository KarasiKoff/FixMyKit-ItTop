import { test, expect } from '@playwright/test';

const webBase = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173';
const runUi = process.env.PLAYWRIGHT_E2E_UI === '1';

test.describe('Login page', () => {
    test.skip(!runUi, 'Нужен запущенный фронт и PLAYWRIGHT_E2E_UI=1');

    test('shows login form', async ({ page }) => {
        const response = await page.goto(`${webBase}/login`);
        test.skip(!response || !response.ok(), 'Frontend не запущен');
        await expect(page.getByRole('heading', { name: 'Вход в систему' })).toBeVisible();
    });
});
