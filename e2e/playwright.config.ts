import { defineConfig } from '@playwright/test';

const apiBase = process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://127.0.0.1:8000';
const webBase = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173';

export default defineConfig({
    testDir: './tests',
    timeout: 30_000,
    retries: process.env.CI ? 1 : 0,
    use: {
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'api',
            testMatch: /.*\.api\.spec\.ts/,
        },
        {
            name: 'ui',
            testMatch: /.*\.ui\.spec\.ts/,
            use: {
                baseURL: webBase,
            },
        },
    ],
    metadata: {
        apiBase,
        webBase,
    },
});
