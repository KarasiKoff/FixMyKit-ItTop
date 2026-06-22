import { createContext, useContext } from 'react';
import type { PublicIntegration } from '../types/integration';
import { DEFAULT_PUBLIC_INTEGRATION } from '../types/integration';

export type PublicIntegrationContextValue = PublicIntegration & {
    ready: boolean;
};

export const PublicIntegrationContext = createContext<PublicIntegrationContextValue>({
    ...DEFAULT_PUBLIC_INTEGRATION,
    ready: false,
});

export function usePublicIntegration(): PublicIntegrationContextValue {
    return useContext(PublicIntegrationContext);
}
