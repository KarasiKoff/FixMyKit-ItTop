export type PublicIntegration = {
    provider: 'none' | 'yandex' | 'jira';
    enabled: boolean;
    label: string;
};

export const DEFAULT_PUBLIC_INTEGRATION: PublicIntegration = {
    provider: 'none',
    enabled: false,
    label: '',
};
