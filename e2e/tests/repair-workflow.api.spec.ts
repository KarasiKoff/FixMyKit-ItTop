import { test, expect } from '@playwright/test';

const apiBase = process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://127.0.0.1:8000';
const runFull = process.env.PLAYWRIGHT_E2E_FULL === '1';

test.describe('Repair workflow API (full stack)', () => {
    test.skip(!runFull, 'Нужен запущенный стек и PLAYWRIGHT_E2E_FULL=1');

    test('login, create request, workflow needs_info → in_progress', async ({ request }) => {
        const login = await request.post(`${apiBase}/api/auth/login`, {
            data: {
                login: process.env.PLAYWRIGHT_ADMIN_LOGIN ?? 'admin',
                password: process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? 'admin',
            },
        });
        expect(login.ok()).toBeTruthy();

        const audiences = await request.get(`${apiBase}/api/audiences`);
        expect(audiences.ok()).toBeTruthy();
        const audienceList = (await audiences.json()).items ?? [];
        const audienceId = audienceList[0]?.id;
        expect(audienceId).toBeTruthy();

        const created = await request.post(`${apiBase}/api/repair-requests`, {
            data: {
                audience_id: audienceId,
                description: 'E2E workflow',
                sync_to_tracker: false,
            },
        });
        expect(created.ok()).toBeTruthy();
        const { id: requestId } = await created.json();

        const needsInfo = await request.patch(`${apiBase}/api/repair-requests/${requestId}/workflow`, {
            data: { workflow: 'needs_info', comment: 'E2E comment' },
        });
        expect(needsInfo.ok()).toBeTruthy();
        expect((await needsInfo.json()).status).toBe('needs_info');

        const inProgress = await request.patch(`${apiBase}/api/repair-requests/${requestId}/workflow`, {
            data: { workflow: 'in_progress' },
        });
        expect(inProgress.ok()).toBeTruthy();
        const body = await inProgress.json();
        expect(body.status).toBe('in_progress');
        expect(body.tracker_status_label).toBe('В работе');
    });
});
