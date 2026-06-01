import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { Link, useParams } from 'react-router-dom';

import { fetchAudienceDevices, fetchAudiences, fetchRoomMap, saveRoomMap } from '../../api/audiences';

import { useMapDrag } from '../../hooks/useMapDrag';

import { useFixedMapCanvas } from '../../hooks/useFixedMapCanvas';

import { MapCanvasStack } from '../../components/MapCanvasStack';
import { MapDeviceChip } from '../../components/MapDeviceChip';

import { useToast } from '../../context/ToastContext';

import { formatApiError } from '../../utils/formatApiError';

import { buildMapSavePayload } from '../../utils/roomMapSave';

import { cellCenterToPct, computeFixedGridLayout } from '../../utils/roomMapGrid';

import { MAP_CHIP_SIZE_PX } from '../../utils/mapChipConstants';

import type { DeviceOnMap, MapDoorEdge, RoomDeviceListItem } from '../../types/roomMap';



type SidebarItemProps = {

    item: RoomDeviceListItem;

};



function SidebarItem({ item }: SidebarItemProps) {

    return (

        <div

            className={`sidebar-device-chip${item.repairStatus === 'in_repair' ? ' sidebar-device-chip--in-repair' : ''}`}

            draggable

            onDragStart={(e) => e.dataTransfer.setData('deviceId', item.id)}

        >

            <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{item.inventoryNumber}</div>

            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{item.name}</div>

        </div>

    );

}



export function RoomMapEditor() {

    const { id } = useParams<{ id: string }>();

    const audienceId = Number(id);

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



    const { positions, canvasRef, onChipMouseDown, onCanvasMouseMove, onCanvasMouseUp, dropDevice, removeDevice, resetPositions, draggingDeviceId } =

        useMapDrag({ initialPositions: mapDevices, gridCols, gridRows });



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

    }, [audienceId]); // eslint-disable-line react-hooks/exhaustive-deps



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



    function clampGridDim(raw: string): number {

        const n = Number.parseInt(raw, 10);

        if (Number.isNaN(n)) return 1;

        return Math.min(10, Math.max(1, n));

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



    if (loading) {

        return (

            <main className="page page--centered">

                <p className="muted-text">Загрузка…</p>

            </main>

        );

    }



    return (

        <main className="page page--wide">

            <div className="admin-page-head admin-page-head--edges">

                <Link to="/admin/add/room" className="admin-back-link">

                    ← Кабинеты

                </Link>

                <h2 className="page-title" style={{ margin: 0 }}>

                    Карта кабинета {audienceName}

                </h2>

            </div>



            <div className="map-editor-layout">

                <aside className="map-device-sidebar">

                    <p className="map-device-sidebar__title">Не размещено</p>

                    {unplacedDevices.length === 0 ? (

                        <p className="muted-text" style={{ fontSize: '0.82rem', margin: 0 }}>

                            Все устройства размещены

                        </p>

                    ) : (

                        unplacedDevices.map((d) => <SidebarItem key={d.id} item={d} />)

                    )}

                    {allDevices.length === 0 && (

                        <p className="muted-text" style={{ fontSize: '0.82rem', margin: 0 }}>

                            В этом кабинете нет устройств

                        </p>

                    )}

                </aside>



                <div className="map-editor-main-column">

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
                                onDragOver: handleDragOver,
                                onDrop: handleDrop,
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
                                        onRemove={removeDevice}
                                    />
                                );
                            })}
                        </MapCanvasStack>
                    </div>



                    <div className="map-editor-footer-row">

                        <div className="map-editor-footer__grid-controls">

                            <label className="map-grid-field">

                                <span className="map-grid-field__label">Столбцы</span>

                                <input

                                    type="number"

                                    className="map-grid-field__input"

                                    min={1}

                                    max={10}

                                    value={gridCols}

                                    onChange={(ev) => setGridCols(clampGridDim(ev.target.value))}

                                />

                            </label>

                            <label className="map-grid-field">

                                <span className="map-grid-field__label">Ряды</span>

                                <input

                                    type="number"

                                    className="map-grid-field__input"

                                    min={1}

                                    max={10}

                                    value={gridRows}

                                    onChange={(ev) => setGridRows(clampGridDim(ev.target.value))}

                                />

                            </label>

                            <button
                                type="button"
                                className="btn-ghost btn-compact map-door-toggle"
                                onClick={toggleDoorEdge}
                                disabled={saving}
                                title={doorEdge === 'bottom' ? 'Вход снизу — нажмите, чтобы перенести наверх' : 'Вход сверху — нажмите, чтобы перенести вниз'}
                            >
                                Вход ↑↓
                            </button>

                        </div>

                        <div className="map-editor-footer__actions">

                            <button type="button" className="btn-ghost btn-compact" onClick={handleReset} disabled={saving}>

                                Сбросить

                            </button>

                            <button type="button" className="btn-primary btn-compact" onClick={() => void handleSave()} disabled={saving}>

                                {saving ? 'Сохранение…' : 'Сохранить карту'}

                            </button>

                        </div>

                    </div>

                </div>

            </div>

        </main>

    );

}

