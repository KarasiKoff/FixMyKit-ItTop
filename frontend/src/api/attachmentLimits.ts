import { apiRequest } from './client';
import type { AttachmentLimits } from '../utils/attachmentLimits';

export type { AttachmentLimits };

type AttachmentLimitsApi = {
    max_per_request: number;
    max_bytes: number;
};

export async function fetchAttachmentLimits(): Promise<AttachmentLimits> {
    const res = await apiRequest<AttachmentLimitsApi>('/api/public/attachment-limits', { skipAuth: true });
    return {
        maxPerRequest: res.max_per_request,
        maxBytes: res.max_bytes,
    };
}
