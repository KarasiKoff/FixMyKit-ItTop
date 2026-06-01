import type { RepairRequest } from '../types/repairRequest';

export type AttachmentClipTone = 'none' | 'partial' | 'complete';

export function attachmentClipTone(
    request: Pick<RepairRequest, 'hasAttachments' | 'attachmentsSyncStatus'>,
): AttachmentClipTone | null {
    if (!request.hasAttachments) {
        return null;
    }
    const st = request.attachmentsSyncStatus ?? 'none';
    if (st === 'complete') {
        return 'complete';
    }
    if (st === 'partial') {
        return 'partial';
    }
    return 'none';
}

export function needsAttachmentTrackerSync(
    request: Pick<RepairRequest, 'hasAttachments' | 'attachmentsSyncStatus'>,
): boolean {
    return Boolean(request.hasAttachments) && request.attachmentsSyncStatus !== 'complete';
}

export function attachmentClipIsActionable(tone: AttachmentClipTone | null): boolean {
    return tone === 'none' || tone === 'partial';
}
