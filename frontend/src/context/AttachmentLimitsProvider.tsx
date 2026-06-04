import React, { ReactNode, useEffect, useMemo, useState } from 'react';
import { fetchAttachmentLimits } from '../api/attachmentLimits';
import type { AttachmentLimits } from '../utils/attachmentLimits';
import { DEFAULT_ATTACHMENT_LIMITS } from '../utils/attachmentLimits';
import { AttachmentLimitsContext } from './attachment-limits-context';

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
