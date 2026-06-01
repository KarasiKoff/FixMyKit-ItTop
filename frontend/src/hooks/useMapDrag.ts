import { useCallback, useEffect, useRef, useState } from 'react';
import { MAP_CHIP_SIZE_PX } from '../utils/mapChipConstants';
import type { DeviceOnMap } from '../types/roomMap';
import {
    cellCenterToPct,
    computeFixedGridLayout,
    computeGridLayout,
    isCellOccupiedByOther,
    nearestCellFromClient,
} from '../utils/roomMapGrid';

export type DraftPositions = Record<string, { xPct: number; yPct: number }>;

type DragState = {
    deviceId: string;
    startClientX: number;
    startClientY: number;
    origXPct: number;
    origYPct: number;
};

export type UseMapDragOptions = {
    initialPositions: DeviceOnMap[];
    gridCols: number;
    gridRows: number;
};

export function useMapDrag({ initialPositions, gridCols, gridRows }: UseMapDragOptions) {
    const [positions, setPositions] = useState<DraftPositions>(() =>
        Object.fromEntries(
            initialPositions.map((p) => [p.deviceId, { xPct: p.xPct, yPct: p.yPct }]),
        ),
    );

    const canvasRef = useRef<HTMLDivElement>(null);
    const dragging = useRef<DragState | null>(null);
    const positionsRef = useRef(positions);
    positionsRef.current = positions;

    const gridRef = useRef({ cols: gridCols, rows: gridRows });
    gridRef.current = { cols: gridCols, rows: gridRows };

    const [draggingDeviceId, setDraggingDeviceId] = useState<string | null>(null);

    const readLayout = useCallback(() => {
        const el = canvasRef.current;
        const { cols, rows } = gridRef.current;
        const fixed = computeFixedGridLayout(MAP_CHIP_SIZE_PX, cols, rows);
        if (!el || !fixed) return fixed;
        const r = el.getBoundingClientRect();
        return computeGridLayout(r.width, r.height, MAP_CHIP_SIZE_PX, cols, rows) ?? fixed;
    }, []);

    const onChipMouseDown = useCallback(
        (deviceId: string, e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            const pos = positionsRef.current[deviceId];
            if (!pos) return;
            dragging.current = {
                deviceId,
                startClientX: e.clientX,
                startClientY: e.clientY,
                origXPct: pos.xPct,
                origYPct: pos.yPct,
            };
            setDraggingDeviceId(deviceId);
        },
        [],
    );

    useEffect(() => {
        if (!draggingDeviceId) return;

        function applySnapFromClient(clientX: number, clientY: number) {
            const drag = dragging.current;
            const canvas = canvasRef.current;
            if (!drag || !canvas) return;
            const rect = canvas.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return;
            const layout = readLayout();
            const { deviceId } = drag;
            if (!layout) {
                const dx = ((clientX - drag.startClientX) / rect.width) * 100;
                const dy = ((clientY - drag.startClientY) / rect.height) * 100;
                const newX = Math.max(0, Math.min(100, drag.origXPct + dx));
                const newY = Math.max(0, Math.min(100, drag.origYPct + dy));
                setPositions((prev) => ({
                    ...prev,
                    [deviceId]: { xPct: newX, yPct: newY },
                }));
                return;
            }
            const { ci, cj } = nearestCellFromClient(layout, clientX, clientY, rect);
            const { xPct, yPct } = cellCenterToPct(layout, ci, cj);
            setPositions((prev) => ({
                ...prev,
                [deviceId]: { xPct, yPct },
            }));
        }

        function onMove(ev: MouseEvent) {
            applySnapFromClient(ev.clientX, ev.clientY);
        }

        function onUp(ev: MouseEvent) {
            const drag = dragging.current;
            const canvas = canvasRef.current;
            if (!drag || !canvas) {
                dragging.current = null;
                setDraggingDeviceId(null);
                return;
            }
            const layout = readLayout();
            const rect = canvas.getBoundingClientRect();
            if (layout) {
                const { ci, cj } = nearestCellFromClient(layout, ev.clientX, ev.clientY, rect);
                const prev = positionsRef.current;
                const blocked = isCellOccupiedByOther(prev, layout, ci, cj, drag.deviceId);
                if (blocked) {
                    setPositions((p) => ({
                        ...p,
                        [drag.deviceId]: { xPct: drag.origXPct, yPct: drag.origYPct },
                    }));
                }
            }
            dragging.current = null;
            setDraggingDeviceId(null);
        }

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [draggingDeviceId, readLayout]);

    const onCanvasMouseMove = useCallback(() => {}, []);

    const onCanvasMouseUp = useCallback(() => {}, []);

    const dropDevice = useCallback(
        (deviceId: string, e: React.DragEvent<HTMLDivElement>): { ok: boolean } => {
            e.preventDefault();
            const canvas = canvasRef.current;
            if (!canvas) return { ok: false };
            const layout = readLayout();
            if (!layout) {
                const rect = canvas.getBoundingClientRect();
                const xPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                const yPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
                setPositions((prev) => ({ ...prev, [deviceId]: { xPct, yPct } }));
                return { ok: true };
            }
            const rect = canvas.getBoundingClientRect();
            const { ci, cj } = nearestCellFromClient(layout, e.clientX, e.clientY, rect);
            const prev = positionsRef.current;
            if (isCellOccupiedByOther(prev, layout, ci, cj, deviceId)) {
                return { ok: false };
            }
            const { xPct, yPct } = cellCenterToPct(layout, ci, cj);
            setPositions((p) => ({ ...p, [deviceId]: { xPct, yPct } }));
            return { ok: true };
        },
        [readLayout],
    );

    const removeDevice = useCallback((deviceId: string) => {
        setPositions((prev) => {
            const next = { ...prev };
            delete next[deviceId];
            return next;
        });
    }, []);

    const resetPositions = useCallback((incoming: DeviceOnMap[]) => {
        setPositions(
            Object.fromEntries(incoming.map((p) => [p.deviceId, { xPct: p.xPct, yPct: p.yPct }])),
        );
    }, []);

    return {
        positions,
        canvasRef,
        onChipMouseDown,
        onCanvasMouseMove,
        onCanvasMouseUp,
        dropDevice,
        removeDevice,
        resetPositions,
        draggingDeviceId,
    };
}
