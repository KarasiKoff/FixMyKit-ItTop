import { useEffect, useRef } from 'react';
import { RoomMapView } from './RoomMapView';

type Props = {
    audienceId: number;
    audienceName: string;
    highlightedDeviceId: string;
    onClose: () => void;
};

export function RoomMapModal({ audienceId, audienceName, highlightedDeviceId, onClose }: Props) {
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') onClose();
        }
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
        if (e.target === overlayRef.current) onClose();
    }

    return (
        <div className="room-map-modal-overlay" ref={overlayRef} onClick={handleOverlayClick}>
            <div className="room-map-modal card">
                <div className="room-map-modal__head">
                    <h3 className="room-map-modal__title">Карта кабинета {audienceName}</h3>
                    <button type="button" className="room-map-modal__close" onClick={onClose} aria-label="Закрыть">
                        ✕
                    </button>
                </div>

                <RoomMapView
                    audienceId={audienceId}
                    highlightedDeviceId={highlightedDeviceId}
                    emptyMessage="Карта не настроена для этого кабинета."
                />
            </div>
        </div>
    );
}
