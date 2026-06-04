import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { fetchAudienceDevices, fetchAudiences, fetchRoomMap, saveRoomMap } from '../api/audiences';
import { useMapDrag } from './useMapDrag';
import { useFixedMapCanvas } from './useFixedMapCanvas';
import { useToast } from './useToast';
import { formatApiError } from '../utils/formatApiError';
import { buildMapSavePayload } from '../utils/roomMapSave';
import { cellCenterToPct, computeFixedGridLayout } from '../utils/roomMapGrid';
import { MAP_CHIP_SIZE_PX } from '../utils/mapChipConstants';
import type { DeviceOnMap, MapDoorEdge, RoomDeviceListItem } from '../types/roomMap';

export function useRoomMapEditor(audienceId: string) {
    const { showSuccess, showError } = useToast();

    const [mapDevices, setMapDevices] = useState<DeviceOnMap[]>([]);
    const [allDevices, setAllDevices] = useState<RoomDeviceListItem[]>([]);
    const [audienceName, setAudienceName] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [gridCols, setGridCols] = useState(4);
    const [gridRows, setGridRows] = useState(4);
    const [doorEdge, setDoorEdge] = useState<MapDoorEdge>('bottom');

    const savedDoorEdgeRef = useRef<MapDoorEdge>('bottom');
    const gridSyncedRef = useRef(false);

    const { canvasStyle, wrapStyle } = useFixedMapCanvas(gridCols, gridRows);

    const {
        positions,
        canvasRef,
        onChipMouseDown,
        onCanvasMouseMove,
        onCanvasMouseUp,
        dropDevice,
        removeDevice,
        resetPositions,
        draggingDeviceId,
    } = useMapDrag({ initialPositions: mapDevices, gridCols, gridRows });

    useEffect(() => {
        gridSyncedRef.current = false;
    }, [audienceId]);

    useLayoutEffect(() => {
        if (loading || mapDevices.length === 0 || gridSyncedRef.current) return;

        const hasGrid = mapDevices.some((d) => d.gridCol != null && d.gridRow != null);
        if (!hasGrid) {
            gridSyncedRef.current = true;
            return;
        }

        const layout = computeFixedGridLayout(MAP_CHIP_SIZE_PX, gridCols, gridRows);
        if (!layout) return;

        const synced = mapDevices.map((d) => {
            if (d.gridCol == null || d.gridRow == null) return d;
            const { xPct, yPct } = cellCenterToPct(layout, d.gridCol, d.gridRow);
            return { ...d, xPct, yPct };
        });

        resetPositions(synced);
        gridSyncedRef.current = true;
    }, [loading, mapDevices, gridCols, gridRows, resetPositions]);

    useEffect(() => {
        if (!audienceId) return;

        setLoading(true);

        Promise.all([fetchRoomMap(audienceId), fetchAudienceDevices(audienceId), fetchAudiences()])
            .then(([mapData, devices, audiences]) => {
                setMapDevices(mapData.positions);
                resetPositions(mapData.positions);
                setGridCols(mapData.gridCols);
                setGridRows(mapData.gridRows);
                setDoorEdge(mapData.doorEdge);
                savedDoorEdgeRef.current = mapData.doorEdge;
                setAllDevices(devices);
                const found = audiences.find((a) => a.id === audienceId);
                setAudienceName(found?.name ?? String(audienceId));
            })
            .catch((err: unknown) => showError(formatApiError(err)))
            .finally(() => setLoading(false));
    }, [audienceId, resetPositions, showError]);

    const placedIds = new Set(Object.keys(positions));
    const unplacedDevices = allDevices.filter((d) => !placedIds.has(d.id));

    function getDeviceInfo(deviceId: string): DeviceOnMap | undefined {
        return (
            mapDevices.find((d) => d.deviceId === deviceId) ??
            (() => {
                const found = allDevices.find((d) => d.id === deviceId);
                if (!found) return undefined;
                return {
                    deviceId: found.id,
                    xPct: 0,
                    yPct: 0,
                    deviceName: found.name,
                    inventoryNumber: found.inventoryNumber,
                    repairStatus: found.repairStatus,
                    categoryId: found.categoryId ?? null,
                    categoryHasIcon: found.categoryHasIcon ?? false,
                };
            })()
        );
    }

    function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
        e.preventDefault();
    }

    function handleDrop(e: React.DragEvent<HTMLDivElement>) {
        const deviceId = e.dataTransfer.getData('deviceId');
        if (!deviceId) return;

        const { ok } = dropDevice(deviceId, e);
        if (!ok) {
            showError('Эта ячейка уже занята. Выберите другую.');
            return;
        }

        if (!mapDevices.find((d) => d.deviceId === deviceId)) {
            const found = allDevices.find((d) => d.id === deviceId);
            if (found) {
                setMapDevices((prev) => [
                    ...prev,
                    {
                        deviceId: found.id,
                        xPct: 0,
                        yPct: 0,
                        deviceName: found.name,
                        inventoryNumber: found.inventoryNumber,
                        repairStatus: found.repairStatus,
                        categoryId: found.categoryId ?? null,
                        categoryHasIcon: found.categoryHasIcon ?? false,
                    },
                ]);
            }
        }
    }

    async function handleSave() {
        setSaving(true);
        try {
            const payload = buildMapSavePayload(positions, gridCols, gridRows);
            const saved = await saveRoomMap(audienceId, payload, { gridCols, gridRows, doorEdge });
            setMapDevices(saved.positions);
            resetPositions(saved.positions);
            setGridCols(saved.gridCols);
            setGridRows(saved.gridRows);
            setDoorEdge(saved.doorEdge);
            savedDoorEdgeRef.current = saved.doorEdge;
            showSuccess('Карта сохранена');
        } catch (err: unknown) {
            showError(formatApiError(err));
        } finally {
            setSaving(false);
        }
    }

    function handleReset() {
        resetPositions(mapDevices);
        setDoorEdge(savedDoorEdgeRef.current);
    }

    function toggleDoorEdge() {
        setDoorEdge((e) => (e === 'bottom' ? 'top' : 'bottom'));
    }

    return {
        loading,
        audienceName,
        unplacedDevices,
        allDevicesCount: allDevices.length,
        gridCols,
        gridRows,
        doorEdge,
        saving,
        canvasStyle,
        wrapStyle,
        canvasRef,
        positions,
        draggingDeviceId,
        getDeviceInfo,
        onChipMouseDown,
        onCanvasMouseMove,
        onCanvasMouseUp,
        removeDevice,
        handleDragOver,
        handleDrop,
        setGridCols,
        setGridRows,
        toggleDoorEdge,
        handleReset,
        handleSave,
    };
}
