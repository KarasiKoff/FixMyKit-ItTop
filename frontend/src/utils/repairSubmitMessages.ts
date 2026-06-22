export type RepairSubmitOverlayCopy = {
    title: string;
    detail: string;
};

export function repairSubmitOverlayMessage(options: {
    sendToTracker: boolean;
    fileCount: number;
    isGuest: boolean;
    integrationLabel?: string;
}): RepairSubmitOverlayCopy {
    const { sendToTracker, fileCount, isGuest, integrationLabel } = options;
    const hasFiles = fileCount > 0;
    const trackerName = (integrationLabel ?? '').trim() || 'Трекер';

    if (isGuest) {
        return {
            title: 'Отправляем заявку…',
            detail: hasFiles
                ? `Загружаем ${fileCount} файл(ов). Не закрывайте страницу.`
                : 'Сохраняем заявку на сервере. Не закрывайте страницу.',
        };
    }

    if (sendToTracker && hasFiles) {
        return {
            title: `Отправляем заявку в ${trackerName}…`,
            detail: `Загружаем файлы и создаём задачу в ${trackerName}. Это может занять до минуты.`,
        };
    }

    if (sendToTracker) {
        return {
            title: `Отправляем заявку в ${trackerName}…`,
            detail: `Сохраняем заявку и создаём задачу в ${trackerName}.`,
        };
    }

    if (hasFiles) {
        return {
            title: 'Отправляем заявку…',
            detail: `Загружаем ${fileCount} файл(ов) на сервер.`,
        };
    }

    return {
        title: 'Отправляем заявку…',
        detail: 'Сохраняем заявку на сервере.',
    };
}
