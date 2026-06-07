import { test, expect } from '@playwright/test';
import {
    E2E_DEVICE,
    E2E_DEVICE_ID,
    fillGuestRepairForm,
    openGuestRepairForm,
    setupGuestRepairPageMocks,
    submitGuestRepairForm,
} from '../helpers/repairGuestMocks';

const webBase = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173';
const runUi = process.env.PLAYWRIGHT_E2E_UI === '1';

test.describe('Guest repair submit (UI)', () => {
    test.beforeEach(async ({ page }) => {
        test.skip(!runUi, 'Нужен фронт на :5173 и PLAYWRIGHT_E2E_UI=1');
        const probe = await page.goto(`${webBase}/login`);
        test.skip(!probe?.ok(), 'Frontend не запущен (npm run dev в frontend/)');
    });

    test('consent blocks submit until checked', async ({ page }) => {
        await setupGuestRepairPageMocks(page);
        await openGuestRepairForm(page, webBase);
        await page.getByLabel('Фамилия и имя').fill('E2E Тестер');
        await page.getByLabel('Описание').fill('Описание поломки');

        const submit = page.getByRole('button', { name: 'Отправить заявку' });
        await expect(submit).toBeDisabled();

        await page.getByRole('checkbox', { name: /согласие на обработку персональных данных/i }).check();
        await expect(submit).toBeEnabled();
    });

    test('shows overlay while request is in flight', async ({ page }) => {
        await setupGuestRepairPageMocks(page, { kind: 'success', delayMs: 2000 });
        await openGuestRepairForm(page, webBase);
        await fillGuestRepairForm(page);
        await submitGuestRepairForm(page);

        const overlay = page.getByRole('alertdialog');
        await expect(overlay).toBeVisible();
        await expect(overlay.getByText('Отправляем заявку…')).toBeVisible();
        await expect(overlay.getByText(/Не закрывайте страницу/i)).toBeVisible();
        await expect(page.getByRole('button', { name: 'Отправка…' })).toBeDisabled();

        await expect(page.getByRole('heading', { name: 'Заявка успешно зарегистрирована' })).toBeVisible({
            timeout: 10_000,
        });
        await expect(overlay).toBeHidden();
    });

    test('success screen after submit', async ({ page }) => {
        await setupGuestRepairPageMocks(page, { kind: 'success' });
        await openGuestRepairForm(page, webBase);
        await fillGuestRepairForm(page);
        await submitGuestRepairForm(page);

        await expect(page.getByRole('heading', { name: 'Заявка успешно зарегистрирована' })).toBeVisible();
        await expect(page.getByText(E2E_DEVICE.inventory_number)).toBeVisible();
        await expect(page.getByText(/Сисадмины обработают заявку/i)).toBeVisible();
    });

    test('network error: toast and form stays', async ({ page }) => {
        await setupGuestRepairPageMocks(page, { kind: 'abort' });
        await openGuestRepairForm(page, webBase);
        await fillGuestRepairForm(page);
        await submitGuestRepairForm(page);

        await expect(page.locator('.toast--error')).toContainText('Нет связи с сервером', { timeout: 8000 });
        await expect(page.getByRole('heading', { name: 'Новая заявка на ремонт' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Отправить заявку' })).toBeEnabled();
        await expect(page.getByRole('alertdialog')).toBeHidden();
    });

    test('409 active request: error toast, no success screen', async ({ page }) => {
        await setupGuestRepairPageMocks(page, {
            kind: 'json',
            status: 409,
            body: { detail: 'active_request_exists' },
        });
        await openGuestRepairForm(page, webBase);
        await fillGuestRepairForm(page);
        await submitGuestRepairForm(page);

        await expect(page.locator('.toast--error')).toContainText('уже есть активная заявка', { timeout: 8000 });
        await expect(page.getByRole('heading', { name: 'Новая заявка на ремонт' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Заявка успешно зарегистрирована' })).toBeHidden();
    });

    test('500 server error: toast, form remains', async ({ page }) => {
        await setupGuestRepairPageMocks(page, {
            kind: 'json',
            status: 500,
            body: { detail: null },
        });
        await openGuestRepairForm(page, webBase);
        await fillGuestRepairForm(page);
        await submitGuestRepairForm(page);

        await expect(page.locator('.toast--error')).toContainText('Ошибка сервера', { timeout: 8000 });
        await expect(page.getByRole('button', { name: 'Отправить заявку' })).toBeEnabled();
        await expect(page.getByRole('heading', { name: 'Новая заявка на ремонт' })).toBeVisible();
    });

    test('413 payload too large', async ({ page }) => {
        await setupGuestRepairPageMocks(page, {
            kind: 'json',
            status: 413,
            body: { detail: null },
        });
        await openGuestRepairForm(page, webBase);
        await fillGuestRepairForm(page);
        await submitGuestRepairForm(page);

        await expect(page.locator('.toast--error')).toContainText(/слишком большой/i, { timeout: 8000 });
        await expect(page.getByRole('heading', { name: 'Новая заявка на ремонт' })).toBeVisible();
    });

    test('device load failure before form', async ({ page }) => {
        await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401, body: '{}' }));
        await page.route(`**/api/public/devices/${E2E_DEVICE_ID}`, (route) =>
            route.fulfill({
                status: 404,
                contentType: 'application/json',
                body: JSON.stringify({ detail: 'device_not_found' }),
            }),
        );

        await page.goto(`${webBase}/repair?deviceId=${E2E_DEVICE_ID}`);
        await expect(page.getByText('Устройство не найдено')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Отправить заявку' })).toBeHidden();
    });
});
