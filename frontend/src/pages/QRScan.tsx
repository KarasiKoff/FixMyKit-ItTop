import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { QRScanner } from '../components/QRScanner';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { formatApiError } from '../utils/formatApiError';
import { fetchPublicDeviceByInventory, resolveDeviceByScanInput } from '../api/devices';
import { fetchAudiences } from '../api/audiences';
import { fetchPublicAudienceByName } from '../api/public';
import { isUuid } from '../utils/uuid';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function extractDeviceId(raw: string): string | null {
    const t = raw.trim();
    if (UUID_RE.test(t)) {
        return t;
    }
    const lower = t.toLowerCase();
    const q = lower.match(/[?&]deviceid=([0-9a-f-]{36})/);
    if (q) {
        return q[1];
    }
    const pathMatch = lower.match(/\/device\/([0-9a-f-]{36})\/public/);
    if (pathMatch) {
        return pathMatch[1];
    }
    const scanPath = lower.match(/\/scan\?[^#]*deviceid=([0-9a-f-]{36})/);
    if (scanPath) {
        return scanPath[1];
    }
    return null;
}

function extractAudienceId(raw: string): string | null {
    const t = raw.trim();
    if (UUID_RE.test(t)) {
        return t;
    }
    const lower = t.toLowerCase();
    const q = lower.match(/[?&]audienceid=([0-9a-f-]{36})/);
    if (q) {
        return q[1];
    }
    const publicPathMatch = lower.match(/\/audience\/([0-9a-f-]{36})\/public/);
    if (publicPathMatch) {
        return publicPathMatch[1];
    }
    const scanPath = lower.match(/\/scan\?[^#]*audienceid=([0-9a-f-]{36})/);
    if (scanPath) {
        return scanPath[1];
    }
    return null;
}

export function QRScan() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { isAuthenticated } = useAuth();
    const { showError } = useToast();

    useEffect(() => {
        const deviceId = searchParams.get('deviceId');
        const audienceId = searchParams.get('audienceId');
        if (isUuid(deviceId)) {
            navigate(`/device/${deviceId!.trim()}/public`, { replace: true });
            return;
        }
        if (isUuid(audienceId)) {
            navigate(`/audience/${audienceId!.trim()}/public`, { replace: true });
        }
    }, [searchParams, navigate]);

    async function resolveAudienceByName(name: string): Promise<string | null> {
        const trimmed = name.trim();
        if (!trimmed) {
            return null;
        }
        if (isAuthenticated) {
            try {
                const list = await fetchAudiences(trimmed);
                const exact = list.find((a) => a.name.trim().toLowerCase() === trimmed.toLowerCase());
                if (exact) {
                    return exact.id;
                }
                if (list.length === 1) {
                    return list[0].id;
                }
            } catch {
                /* fallback to public */
            }
        }
        try {
            const aud = await fetchPublicAudienceByName(trimmed);
            return aud.id;
        } catch {
            return null;
        }
    }

    async function handleScan(value: string) {
        const audienceFromQr = extractAudienceId(value);
        if (audienceFromQr) {
            navigate(`/audience/${audienceFromQr}/public`);
            return;
        }

        const fromQr = extractDeviceId(value);
        if (fromQr) {
            navigate(`/device/${fromQr}/public`);
            return;
        }

        const raw = value.trim();
        if (!raw) {
            return;
        }

        const audienceIdByName = await resolveAudienceByName(raw);
        if (audienceIdByName) {
            navigate(`/audience/${audienceIdByName}/public`);
            return;
        }

        try {
            const device = isAuthenticated
                ? await resolveDeviceByScanInput(raw)
                : await fetchPublicDeviceByInventory(raw);
            navigate(`/device/${device.id}/public`);
        } catch (err) {
            showError(formatApiError(err));
            throw err;
        }
    }

    return (
        <main className="page page--scanner">
            <h2>Сканирование QR</h2>
            <section className="card card--scanner">
                <p className="qr-scan-hint muted-text">
                    Введите инвентарный номер или UUID устройства, UUID кабинета, название кабинета (например, 305),
                    либо отсканируйте QR-код.
                </p>
                <QRScanner onScan={handleScan} />
            </section>
        </main>
    );
}
