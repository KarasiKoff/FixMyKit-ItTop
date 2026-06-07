import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/client';
import {
    formatApiError,
    isTrackerUnavailableError,
    TRACKER_SYNC_PENDING_TOAST,
} from './formatApiError';

describe('isTrackerUnavailableError', () => {
    it('detects tracker_unavailable detail', () => {
        expect(isTrackerUnavailableError(new ApiError(502, 'tracker_unavailable'))).toBe(true);
    });

    it('detects generic 502', () => {
        expect(isTrackerUnavailableError(new ApiError(502, 'bad gateway'))).toBe(true);
    });

    it('returns false for other errors', () => {
        expect(isTrackerUnavailableError(new ApiError(404, 'repair_request_not_found'))).toBe(false);
        expect(isTrackerUnavailableError(new Error('fail'))).toBe(false);
    });
});

describe('formatApiError', () => {
    it('translates tracker_unavailable', () => {
        expect(formatApiError(new ApiError(502, 'tracker_unavailable'))).toContain('Трекер');
    });

    it('maps empty body by HTTP status', () => {
        expect(formatApiError(new ApiError(500, ''))).toBe('Ошибка сервера. Попробуйте позже');
        expect(formatApiError(new ApiError(413, ''))).toContain('слишком большой');
    });
});

describe('TRACKER_SYNC_PENDING_TOAST', () => {
    it('mentions site status and retry', () => {
        expect(TRACKER_SYNC_PENDING_TOAST).toContain('сайте');
        expect(TRACKER_SYNC_PENDING_TOAST).toContain('Трекер');
    });
});
