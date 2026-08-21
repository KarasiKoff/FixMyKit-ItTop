import React, { ReactNode, useEffect, useMemo, useState } from 'react';
import { fetchPublicIntegration } from '../api/integration';
import { DEFAULT_PUBLIC_INTEGRATION, type PublicIntegration } from '../types/integration';
import { PublicIntegrationContext } from './public-integration-context';

export function PublicIntegrationProvider({ children }: { children: ReactNode }) {
    const [integration, setIntegration] = useState<PublicIntegration>(DEFAULT_PUBLIC_INTEGRATION);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let cancelled = false;
        fetchPublicIntegration()
            .then((value) => {
                if (!cancelled) {
                    setIntegration(value);
                }
            })
            .catch(() => {
                /* без интеграции */
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

    const value = useMemo(() => ({ ...integration, ready }), [integration, ready]);

    return <PublicIntegrationContext.Provider value={value}>{children}</PublicIntegrationContext.Provider>;
}
