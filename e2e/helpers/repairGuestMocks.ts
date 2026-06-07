import type { Page, Route } from '@playwright/test';

/** Стабильный UUID для гостевой формы /repair?deviceId=… */
export const E2E_DEVICE_ID = '11111111-1111-4111-8111-111111111111';

export const E2E_DEVICE = {
    id: E2E_DEVICE_ID,
    inventory_number: 'E2E-INV-001',
    name: 'E2E тестовый ноутбук',
    repair_status: 'not_in_repair' as const,
    audience: { id: '22222222-2222-4222-8222-222222222222', name: 'Каб. E2E' },
};

export type RepairSubmitMock =
    | { kind: 'success'; delayMs?: number }
    | { kind: 'abort' }
    | {
          kind: 'json';
          status: number;
          body?: unknown;
          contentType?: string;
          delayMs?: number;
      };

export async function setupGuestRepairPageMocks(
    page: Page,
    submit: RepairSubmitMock = { kind: 'success' },
): Promise<void> {
    await page.route('**/api/auth/me', (route) =>
        route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'invalid_token' }) }),
    );

    await page.route('**/api/public/attachment-limits', (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ max_per_request: 10, max_bytes: 1024 * 1024 * 1024 }),
        }),
    );

    await page.route(`**/api/public/devices/${E2E_DEVICE_ID}`, (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(E2E_DEVICE),
        }),
    );

    await page.route('**/api/public/repair-requests', async (route: Route) => {
        if (submit.kind === 'abort') {
            await route.abort('failed');
            return;
        }
        if (submit.delayMs) {
            await new Promise((r) => setTimeout(r, submit.delayMs));
        }
        if (submit.kind === 'json') {
            const contentType = submit.contentType ?? 'application/json';
            const body =
                contentType.includes('json')
                    ? JSON.stringify(submit.body ?? {})
                    : String(submit.body ?? '');
            await route.fulfill({
                status: submit.status,
                contentType,
                body,
            });
            return;
        }
        await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
                id: '33333333-3333-4333-8333-333333333333',
                status: 'open',
                has_attachments: false,
            }),
        });
    });
}

export async function openGuestRepairForm(page: Page, webBase: string): Promise<void> {
    await page.goto(`${webBase}/repair?deviceId=${E2E_DEVICE_ID}`);
    await page.getByRole('heading', { name: 'Новая заявка на ремонт' }).waitFor();
    await page.getByText(E2E_DEVICE.inventory_number).waitFor();
}

export async function fillGuestRepairForm(page: Page): Promise<void> {
    await page.getByLabel('Фамилия и имя').fill('E2E Тестер');
    await page.getByLabel('Описание').fill('Не работает после обновления Windows');
    await page.getByRole('checkbox', { name: /согласие на обработку персональных данных/i }).check();
}

export async function submitGuestRepairForm(page: Page): Promise<void> {
    await page.getByRole('button', { name: 'Отправить заявку' }).click();
}
