import { shortenPublicUrl } from '../api/public';

/** Базовый URL фронта для печати (прод), иначе текущий origin в dev. */
export function buildGlobalScanPageUrl(): string {
    const fromEnv = import.meta.env.VITE_PUBLIC_FRONTEND_BASE_URL?.trim();
    const base = (fromEnv || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
    return `${base}/scan`;
}

/** Короткая подпись под QR: clck.ru → https://…/scan (одна на весь лист). */
export async function resolveScanShortLinkCaption(): Promise<string | undefined> {
    const scanPageUrl = buildGlobalScanPageUrl();
    try {
        const { short_url } = await shortenPublicUrl(scanPageUrl);
        return short_url.replace(/^https?:\/\//, '');
    } catch {
        return scanPageUrl.replace(/^https?:\/\//, '');
    }
}
