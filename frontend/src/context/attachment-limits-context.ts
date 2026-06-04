import { createContext } from 'react';
import type { AttachmentLimits } from '../utils/attachmentLimits';

export type AttachmentLimitsContextValue = {
    limits: AttachmentLimits;
    ready: boolean;
};

export const AttachmentLimitsContext = createContext<AttachmentLimitsContextValue | null>(null);
