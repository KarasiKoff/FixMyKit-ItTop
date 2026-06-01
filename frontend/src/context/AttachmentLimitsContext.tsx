import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { fetchAttachmentLimits } from '../api/attachmentLimits';
import type { AttachmentLimits } from '../utils/attachmentLimits';
import { DEFAULT_ATTACHMENT_LIMITS } from '../utils/attachmentLimits';

type AttachmentLimitsContextValue = {
    limits: AttachmentLimits;
    ready: boolean;
};

const AttachmentLimitsContext = createContext<AttachmentLimitsContextValue | null>(null);

export function AttachmentLimitsProvider({ children }: { children: ReactNode }) {
    const [limits, setLimits] = useState<AttachmentLimits>(DEFAULT_ATTACHMENT_LIMITS);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let cancelled = false;
        fetchAttachmentLimits()
            .then((value) => {
                if (!cancelled) {
                    setLimits(value);
                }
            })
            .catch(() => {
                /* остаются дефолты */
            })
            .finally(() => {
                if (!cancelled) {
                    setReady(true);
                }
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const value = useMemo(() => ({ limits, ready }), [limits, ready]);

    return <AttachmentLimitsContext.Provider value={value}>{children}</AttachmentLimitsContext.Provider>;
}

export function useAttachmentLimits(): AttachmentLimitsContextValue {
    const ctx = useContext(AttachmentLimitsContext);
    if (!ctx) {
        throw new Error('useAttachmentLimits must be used inside AttachmentLimitsProvider');
    }
    return ctx;
}
