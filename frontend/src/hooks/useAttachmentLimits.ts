import { useContext } from 'react';
import { AttachmentLimitsContext } from '../context/attachment-limits-context';

export function useAttachmentLimits() {
    const ctx = useContext(AttachmentLimitsContext);
    if (!ctx) {
        throw new Error('useAttachmentLimits must be used inside AttachmentLimitsProvider');
    }
    return ctx;
}
