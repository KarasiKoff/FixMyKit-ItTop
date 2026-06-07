import { describe, expect, it } from 'vitest';

import { filtersEqual } from './filtersMatch';

describe('filtersEqual', () => {
    it('returns true for identical objects', () => {
        expect(filtersEqual({ q: 'a', page: 1 }, { q: 'a', page: 1 })).toBe(true);
    });

    it('returns false when a value differs', () => {
        expect(filtersEqual({ q: 'a' }, { q: 'b' })).toBe(false);
    });

    it('compares only keys from the first object', () => {
        expect(filtersEqual({ q: 'a' }, { q: 'a', extra: 1 } as { q: string })).toBe(true);
    });
});
