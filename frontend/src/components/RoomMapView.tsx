import { useEffect, useState } from 'react';
import { fetchRoomMap } from '../api/audiences';
import { useFixedMapCanvas } from '../hooks/useFixedMapCanvas';
import { useRoomMapDisplay } from '../hooks/useRoomMapDisplay';
import { formatApiError } from '../utils/formatApiError';
import type { MapDoorEdge } from '../types/roomMap';
import { MapCanvasStack } from './MapCanvasStack';
import { MapDeviceChip } from './MapDeviceChip';

type Props = {
    audienceId: string;
    highlightedDeviceId?: string;
    onDeviceClick?: (deviceId: string) => void;
    emptyMessage?: string;
    className?: string;
};

export function RoomMapView({
    audienceId,
    highlightedDeviceId,
    onDeviceClick,
    emptyMessage = 'Карта не настроена для этого кабинета.',
    className,
}: Props) {
    const [positions, setPositions] = useState<Awaited<ReturnType<typeof fetchRoomMap>>['positions']>([]);
    const [gridCols, setGridCols] = useState(4);
    const [gridRows, setGridRows] = useState(4);
    const [doorEdge, setDoorEdge] = useState<MapDoorEdge>('bottom');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { canvasStyle, wrapStyle } = useFixedMapCanvas(gridCols, gridRows);
    const { displayDevices } = useRoomMapDisplay(gridCols, gridRows, positions);

    useEffect(() => {
        setLoading(true);
        setError(null);
        fetchRoomMap(audienceId)
            .then((data) => {
                setPositions(data.positions);
                setGridCols(data.gridCols);
                setGridRows(data.gridRows);
                setDoorEdge(data.doorEdge);
            })
            .catch((err: unknown) => setError(formatApiError(err)))
            .finally(() => setLoading(false));
    }, [audienceId]);

    const rootClass = ['room-map-view', className].filter(Boolean).join(' ');

    if (loading) {
        return (
            <div className={rootClass}>
                <p className="muted-text">Загрузка карты…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className={rootClass}>
                <p className="error-text">{error}</p>
            </div>
        );
    }

    if (positions.length === 0) {
        return (
            <div className={rootClass}>
                <p className="muted-text">{emptyMessage}</p>
            </div>
        );
    }

    const interactive = Boolean(onDeviceClick);
    const highlighted = highlightedDeviceId
        ? displayDevices.find((p) => p.deviceId === highlightedDeviceId)
        : undefined;

    return (
        <div className={rootClass}>
            {highlighted ? (
                <p className="room-map-view__highlight muted-text">
                    Устройство:{' '}
                    <strong>
                        {highlighted.inventoryNumber} — {highlighted.deviceName}
                    </strong>
                </p>
            ) : null}
            <div className="map-canvas-slot map-canvas-slot--page">
                <MapCanvasStack
                    doorEdge={doorEdge}
                    gridCols={gridCols}
                    gridRows={gridRows}
                    canvasStyle={interactive ? canvasStyle : { pointerEvents: 'none', ...canvasStyle }}
                    wrapStyle={wrapStyle}
                    canvasClassName="map-canvas map-canvas--map-light map-canvas--editor-fill map-canvas--fixed-grid map-canvas--page-view"
                >
                    {displayDevices.map((p) => (
                        <MapDeviceChip
                            key={p.deviceId}
                            device={p}
                            xPct={p.xPct}
                            yPct={p.yPct}
                            highlighted={p.deviceId === highlightedDeviceId}
                            cursor={interactive ? 'pointer' : 'default'}
                            onClick={onDeviceClick}
                        />
                    ))}
                </MapCanvasStack>
            </div>
        </div>
    );
}
