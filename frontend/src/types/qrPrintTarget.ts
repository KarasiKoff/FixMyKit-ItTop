/** Элемент для печати QR-листа. */
export type QrPrintTarget = {
    label: string;
    /** Прямая ссылка на публичную страницу (для режима direct). */
    directUrl: string;
    kind: 'device' | 'audience';
    entityId: string;
};
