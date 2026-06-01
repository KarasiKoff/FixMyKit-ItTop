import QRCode from 'qrcode';
import QRCodeStyling from 'qr-code-styling';

export const MAX_QR_LOGO_FILE_BYTES = 16 * 1024 * 1024;

function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('file_read_failed'));
        reader.readAsDataURL(blob);
    });
}

export function validateLogoImageFile(file: File): 'ok' | 'type' | 'size' {
    const t = file.type.toLowerCase();
    if (t !== 'image/png' && t !== 'image/jpeg' && t !== 'image/jpg') {
        return 'type';
    }
    if (file.size > MAX_QR_LOGO_FILE_BYTES) {
        return 'size';
    }
    return 'ok';
}

export function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('read_failed'));
        reader.readAsDataURL(file);
    });
}

/**
 * PNG data URL для QR заявки: без логотипа — `qrcode` + EC M; с логотипом — `qr-code-styling` + EC H.
 * `logoSizePercent` — доля от ширины QR (8–35 и т.д.), внутри маппится в imageSize библиотеки.
 */
export async function generateRepairQrPngDataUrl(
    payloadUrl: string,
    sizePx: number,
    options: { logoDataUrl: string | null; logoSizePercent: number },
): Promise<string> {
    if (!options.logoDataUrl) {
        return QRCode.toDataURL(payloadUrl, {
            width: sizePx,
            margin: 0,
            errorCorrectionLevel: 'M',
        });
    }

    const imageSize = Math.min(0.48, Math.max(0.06, options.logoSizePercent / 100));

    const qr = new QRCodeStyling({
        width: sizePx,
        height: sizePx,
        type: 'canvas',
        data: payloadUrl,
        image: options.logoDataUrl,
        imageOptions: {
            crossOrigin: 'anonymous',
            margin: 4,
            hideBackgroundDots: true,
            imageSize,
        },
        dotsOptions: { color: '#000000', type: 'square' },
        cornersSquareOptions: { color: '#000000', type: 'square' },
        cornersDotOptions: { color: '#000000', type: 'square' },
        backgroundOptions: { color: '#ffffff' },
        qrOptions: { errorCorrectionLevel: 'H' },
    });

    const raw = await qr.getRawData('png');
    if (raw instanceof Blob) {
        return blobToDataUrl(raw);
    }
    throw new Error('qr_generation_failed');
}
