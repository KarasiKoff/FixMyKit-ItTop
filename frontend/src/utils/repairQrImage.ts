import QRCode from 'qrcode';
import QRCodeStyling from 'qr-code-styling';

export const MAX_QR_LOGO_FILE_BYTES = 16 * 1024 * 1024;

const RASTER_LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg']);
const SVG_LOGO_TYPES = new Set(['image/svg+xml', 'image/svg']);

function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('file_read_failed'));
        reader.readAsDataURL(blob);
    });
}

export function isSvgLogoFile(file: File): boolean {
    const t = file.type.toLowerCase();
    if (SVG_LOGO_TYPES.has(t)) {
        return true;
    }
    return file.name.toLowerCase().endsWith('.svg');
}

export function validateLogoImageFile(file: File): 'ok' | 'type' | 'size' {
    const t = file.type.toLowerCase();
    if (isSvgLogoFile(file)) {
        if (file.size > MAX_QR_LOGO_FILE_BYTES) {
            return 'size';
        }
        return 'ok';
    }
    if (!RASTER_LOGO_TYPES.has(t) && !file.name.toLowerCase().match(/\.(png|jpe?g)$/)) {
        return 'type';
    }
    if (file.size > MAX_QR_LOGO_FILE_BYTES) {
        return 'size';
    }
    return 'ok';
}

function normalizeSvgMarkup(raw: string): string {
    let svg = raw.trim();
    if (!svg.includes('<svg')) {
        throw new Error('invalid_svg');
    }
    if (!/xmlns=/.test(svg)) {
        svg = svg.replace(/<svg\b/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    return svg;
}

/** Data URL для превью и хранения в состоянии (SVG остаётся вектором). */
export async function readLogoFileAsDataUrl(file: File): Promise<string> {
    if (isSvgLogoFile(file)) {
        const svg = normalizeSvgMarkup(await file.text());
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    }
    return readFileAsDataUrl(file);
}

export function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('read_failed'));
        reader.readAsDataURL(file);
    });
}

export function isSvgDataUrl(dataUrl: string): boolean {
    return dataUrl.trim().toLowerCase().startsWith('data:image/svg+xml');
}

export function rasterizeLogoDataUrlToPng(dataUrl: string, sizePx: number): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const side = Math.max(64, Math.round(sizePx));
            const canvas = document.createElement('canvas');
            canvas.width = side;
            canvas.height = side;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('canvas_unavailable'));
                return;
            }
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, side, side);
            const w = img.naturalWidth || img.width || 1;
            const h = img.naturalHeight || img.height || 1;
            const scale = Math.min(side / w, side / h);
            const dw = w * scale;
            const dh = h * scale;
            ctx.drawImage(img, (side - dw) / 2, (side - dh) / 2, dw, dh);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => reject(new Error('logo_raster_failed'));
        img.src = dataUrl;
    });
}

async function logoDataUrlForQrEmbedding(logoDataUrl: string, qrSizePx: number): Promise<string> {
    if (isSvgDataUrl(logoDataUrl)) {
        return rasterizeLogoDataUrlToPng(logoDataUrl, Math.max(256, qrSizePx * 2));
    }
    return logoDataUrl;
}

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
    const image = await logoDataUrlForQrEmbedding(options.logoDataUrl, sizePx);

    const qr = new QRCodeStyling({
        width: sizePx,
        height: sizePx,
        type: 'canvas',
        data: payloadUrl,
        image,
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
