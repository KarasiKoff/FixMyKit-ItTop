import type { PublicIntegration } from '../types/integration';

export function integrationDisplayName(integration: Pick<PublicIntegration, 'label'>): string {
    const label = integration.label.trim();
    return label || 'Трекер';
}

export function openInIntegrationLabel(integration: Pick<PublicIntegration, 'label'>): string {
    return `Открыть в ${integrationDisplayName(integration)}`;
}

export function syncWithIntegrationLabel(integration: Pick<PublicIntegration, 'label'>): string {
    return `Синхронизировать с ${integrationDisplayName(integration)}`;
}

export function syncedWithIntegrationLabel(integration: Pick<PublicIntegration, 'label'>): string {
    return integrationDisplayName(integration);
}

export function sendToIntegrationLabel(integration: Pick<PublicIntegration, 'label'>): string {
    return `Отправить заявку в ${integrationDisplayName(integration)}`;
}

export function issueCreatedInIntegrationLabel(integration: Pick<PublicIntegration, 'label'>): string {
    return `Задача создана в ${integrationDisplayName(integration)}`;
}

export function commentAppearsInIntegrationHint(integration: Pick<PublicIntegration, 'label'>): string {
    return `Напишите комментарий — он появится здесь и в задаче ${integrationDisplayName(integration)}`;
}

export function workflowCommentInIntegrationHint(integration: Pick<PublicIntegration, 'label'>): string {
    return `Опишите, какие данные вам необходимы. Комментарий появится в задаче ${integrationDisplayName(integration)}.`;
}

export function externalSyncPendingToast(integration: Pick<PublicIntegration, 'label'>): string {
    return (
        `Статус на сайте обновлён. ${integrationDisplayName(integration)} недоступен — ` +
        `нажмите «${syncWithIntegrationLabel(integration)}».`
    );
}

export function attachmentsInIntegrationLabel(integration: Pick<PublicIntegration, 'label'>): string {
    return integrationDisplayName(integration);
}
