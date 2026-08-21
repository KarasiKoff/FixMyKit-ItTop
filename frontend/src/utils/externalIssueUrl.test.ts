import { describe, expect, it } from 'vitest';
import { externalIssueBrowseHref } from './externalIssueUrl';

describe('externalIssueBrowseHref', () => {
    it('uses Jira browse URL from API', () => {
        expect(
            externalIssueBrowseHref(
                'FMK-1',
                'https://org.atlassian.net/browse/FMK-1',
            ),
        ).toBe('https://org.atlassian.net/browse/FMK-1');
    });

    it('builds Yandex URL from key', () => {
        expect(externalIssueBrowseHref('FIXMYKIT-42', null)).toBe(
            'https://tracker.yandex.ru/FIXMYKIT-42',
        );
    });

    it('extracts key from Yandex API URL', () => {
        expect(
            externalIssueBrowseHref(
                null,
                'https://api.tracker.yandex.net/v3/issues/FIX-99',
            ),
        ).toBe('https://tracker.yandex.ru/FIX-99');
    });

    it('returns yandex web URL as-is', () => {
        const url = 'https://tracker.yandex.ru/FIX-1';
        expect(externalIssueBrowseHref(null, url)).toBe(url);
    });
});
