export type RepairSubmitOverlayCopy = {
    title: string;
    detail: string;
};

export function repairSubmitOverlayMessage(options: {
    sendToTracker: boolean;
    fileCount: number;
    isGuest: boolean;
}): RepairSubmitOverlayCopy {
    const { sendToTracker, fileCount, isGuest } = options;
    const hasFiles = fileCount > 0;

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
            title: 'Отправляем заявку в Трекер…',
            detail: `Загружаем файлы и создаём задачу в Яндекс Трекере. Это может занять до минуты.`,
        };
    }

    if (sendToTracker) {
        return {
            title: 'Отправляем заявку в Трекер…',
            detail: 'Сохраняем заявку и создаём задачу в Яндекс Трекере.',
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
