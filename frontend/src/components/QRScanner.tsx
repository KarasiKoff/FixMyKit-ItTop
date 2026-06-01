import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

/** На крупном экране с мышью камера не запускается — только ввод инвентарного номера / UUID */
const DESKTOP_MANUAL_ONLY_MEDIA = '(min-width: 768px) and (pointer: fine)';

function usePreferManualQrOnly() {
    const [manualOnly, setManualOnly] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia(DESKTOP_MANUAL_ONLY_MEDIA);
        const sync = () => setManualOnly(mq.matches);
        sync();
        mq.addEventListener('change', sync);
        return () => mq.removeEventListener('change', sync);
    }, []);

    return manualOnly;
}

async function layoutReadyFrames(): Promise<void> {
    await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
}

/** Размер рамки QR по фактической ширине блока камеры — без вылета за экран */
function qrBoxPx(clipEl: HTMLElement | null): number {
    const elW = clipEl?.getBoundingClientRect().width ?? 0;
    const vw =
        typeof window !== 'undefined' ? Math.min(window.innerWidth, document.documentElement?.clientWidth ?? window.innerWidth) : 320;
    const usable = elW > 32 ? elW : vw - 64;
    const rounded = Math.floor(usable - 24);
    return Math.max(140, Math.min(260, rounded));
}

export function QRScanner({ onScan }: { onScan: (value: string) => void | Promise<void> }) {
    const [manualValue, setManualValue] = useState('');
    const [scanStatus, setScanStatus] = useState('');
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const clipRef = useRef<HTMLDivElement | null>(null);
    const manualOnly = usePreferManualQrOnly();

    useEffect(() => {
        if (manualOnly) {
            setScanStatus('');
            return;
        }

        let mounted = true;
        scannerRef.current = null;

        const start = async () => {
            setScanStatus('Ожидание запуска камеры');

            await layoutReadyFrames();

            const qrSize = qrBoxPx(clipRef.current);

            const scanner = new Html5Qrcode('scanner-root', false);
            if (!mounted) {
                await scanner.clear();
                return;
            }
            scannerRef.current = scanner;

            try {
                await scanner.start(
                    { facingMode: 'environment' },
                    {
                        fps: 10,
                        qrbox: { width: qrSize, height: qrSize },
                        aspectRatio: 1,
                    },
                    (decodedText) => {
                        if (!mounted) {
                            return;
                        }
                        setScanStatus(`Считано: ${decodedText}`);
                        void Promise.resolve(onScan(decodedText)).catch(() => undefined);
                    },
                    () => undefined,
                );
                if (mounted) {
                    setScanStatus('Камера активна');
                }
            } catch (error) {
                console.error('QRScanner start failed:', error);
                if (mounted) {
                    setScanStatus('Камера недоступна — введите код вручную ниже');
                }
                try {
                    await scanner.clear();
                } catch {
                    /* noop */
                }
                scannerRef.current = null;
            }
        };

        void start();

        return () => {
            mounted = false;
            const currentScanner = scannerRef.current;
            if (!currentScanner) {
                const root = document.getElementById('scanner-root');
                if (root) {
                    root.innerHTML = '';
                }
                return;
            }

            if (currentScanner.isScanning) {
                currentScanner
                    .stop()
                    .then(() => currentScanner.clear())
                    .catch(() => currentScanner.clear());
            } else {
                currentScanner.clear();
            }
            scannerRef.current = null;
        };
    }, [manualOnly, onScan]);

    return (
        <div className={`scanner-wrap ${manualOnly ? 'scanner-wrap--manual-only' : ''}`}>
            {manualOnly ? null : (
                <>
                    <div className="scanner-camera-clip" ref={clipRef}>
                        <div id="scanner-root" />
                    </div>
                    <p className="scanner-status-line">{scanStatus}</p>
                </>
            )}
            <form
                className="manual-qr-form"
                onSubmit={(event) => {
                    event.preventDefault();
                    if (manualValue.trim().length === 0) {
                        return;
                    }
                    const v = manualValue.trim();
                    void Promise.resolve(onScan(v))
                        .then(() => setManualValue(''))
                        .catch(() => undefined);
                }}
            >
                <input
                    placeholder="Инвентарный номер или UUID устройства"
                    value={manualValue}
                    onChange={(event) => setManualValue(event.target.value)}
                    autoComplete="off"
                />
                <button type="submit">Перейти к заявке</button>
            </form>
        </div>
    );
}
