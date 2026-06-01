import React from 'react';
import { useNavigate } from 'react-router-dom';
import { QRScanner } from '../components/QRScanner';
import { useAuth } from '../hooks/useAuth';
import { useAppData } from '../context/AppDataContext';
import { useToast } from '../context/ToastContext';
import { formatApiError } from '../utils/formatApiError';
import { fetchPublicDeviceByInventory } from '../api/devices';

function extractDeviceId(raw: string): string | null {
    const t = raw.trim();
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRe.test(t)) {
        return t;
    }
    const lower = t.toLowerCase();
    const q = lower.match(/[?&]deviceid=([0-9a-f-]{36})/);
    if (q) {
        return q[1];
    }
    const pathMatch = lower.match(/\/repair\?[^#]*deviceid=([0-9a-f-]{36})/);
    if (pathMatch) {
        return pathMatch[1];
    }
    const publicPathMatch = lower.match(/\/device\/([0-9a-f-]{36})\/public/);
    if (publicPathMatch) {
        return publicPathMatch[1];
    }
    return null;
}

export function QRScan() {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const { devices } = useAppData();
    const { showError } = useToast();

    async function handleScan(value: string) {
        const fromQr = extractDeviceId(value);
        if (fromQr) {
            navigate(`/device/${fromQr}/public`);
            return;
        }

        if (!isAuthenticated) {
            const raw = value.trim();
            if (!raw) {
                return;
            }
            try {
                const device = await fetchPublicDeviceByInventory(raw);
                navigate(`/device/${device.id}/public`);
            } catch (err) {
                showError(formatApiError(err));
                throw err;
            }
            return;
        }

        const normalized = value.trim().toLowerCase();
        const byId = devices.find((device) => device.id.toLowerCase() === normalized);
        const byInventory = devices.find((device) => device.inventoryNumber.toLowerCase() === normalized);
        const device = byId ?? byInventory;
        if (device) {
            navigate(`/device/${device.id}/public`);
        } else {
            showError('Устройство не найдено. Проверьте инвентарный номер или войдите в систему.');
        }
    }

    return (
        <main className="page page--scanner">
            <h2>Сканирование QR</h2>
            <section className="card card--scanner">
                <p className="qr-scan-hint muted-text">Введите в поле ниже инвентарный номер или UUID устройства.</p>
                <QRScanner onScan={handleScan} />
            </section>
        </main>
    );
}
