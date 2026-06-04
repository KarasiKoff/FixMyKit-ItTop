import React from 'react';
import { MapCanvasStack } from '../MapCanvasStack';
import { MapDeviceChip } from '../MapDeviceChip';
import type { DeviceOnMap, MapDoorEdge } from '../../types/roomMap';

type RoomMapEditorCanvasProps = {
    doorEdge: MapDoorEdge;
    gridCols: number;
    gridRows: number;
    canvasStyle: React.CSSProperties;
    wrapStyle: React.CSSProperties;
    canvasRef: React.RefObject<HTMLDivElement>;
    positions: Record<string, { xPct: number; yPct: number }>;
    draggingDeviceId: string | null;
    getDeviceInfo: (deviceId: string) => DeviceOnMap | undefined;
    onCanvasMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
    onCanvasMouseUp: () => void;
    onChipMouseDown: (deviceId: string, e: React.MouseEvent) => void;
    onRemoveDevice: (deviceId: string) => void;
    onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
    onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
};

export function RoomMapEditorCanvas({
    doorEdge,
    gridCols,
    gridRows,
    canvasStyle,
    wrapStyle,
    canvasRef,
    positions,
    draggingDeviceId,
    getDeviceInfo,
    onCanvasMouseMove,
    onCanvasMouseUp,
    onChipMouseDown,
    onRemoveDevice,
    onDragOver,
    onDrop,
}: RoomMapEditorCanvasProps) {
    return (
        <div className="map-canvas-slot">
            <MapCanvasStack
                doorEdge={doorEdge}
                gridCols={gridCols}
                gridRows={gridRows}
                canvasStyle={canvasStyle}
                wrapStyle={wrapStyle}
                canvasRef={canvasRef}
                canvasProps={{
                    onMouseMove: onCanvasMouseMove,
                    onMouseUp: onCanvasMouseUp,
                    onMouseLeave: onCanvasMouseUp,
                    onDragOver,
                    onDrop,
                }}
            >
                {Object.keys(positions).length === 0 && (
                    <div className="map-empty-hint">Перетащите устройства из панели слева</div>
                )}
                {Object.entries(positions).map(([deviceId, pos]) => {
                    const info = getDeviceInfo(deviceId);
                    if (!info) return null;
                    return (
                        <MapDeviceChip
                            key={deviceId}
                            device={info}
                            xPct={pos.xPct}
                            yPct={pos.yPct}
                            allowDrag
                            snapTransition={draggingDeviceId === deviceId}
                            onMouseDown={onChipMouseDown}
                            onRemove={onRemoveDevice}
                        />
                    );
                })}
            </MapCanvasStack>
        </div>
    );
}
