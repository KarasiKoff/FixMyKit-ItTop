import { apiRequest } from './client';
import type { PublicIntegration } from '../types/integration';

type IntegrationApi = {
    provider: PublicIntegration['provider'];
    enabled: boolean;
    label: string;
};

export async function fetchPublicIntegration(): Promise<PublicIntegration> {
    const data = await apiRequest<IntegrationApi>('/api/public/integration', { skipAuth: true });
    return {
        provider: data.provider,
        enabled: data.enabled,
        label: (data.label ?? '').trim(),
    };
}
