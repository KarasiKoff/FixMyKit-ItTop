import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { RoomMapEditorCanvas } from '../../components/room-map/RoomMapEditorCanvas';
import { RoomMapEditorFooter } from '../../components/room-map/RoomMapEditorFooter';
import { RoomMapSidebar } from '../../components/room-map/RoomMapSidebar';
import { useRoomMapEditor } from '../../hooks/useRoomMapEditor';

export function RoomMapEditor() {
    const { id } = useParams<{ id: string }>();
    const audienceId = id ?? '';
    const editor = useRoomMapEditor(audienceId);

    if (editor.loading) {
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
                    Карта кабинета {editor.audienceName}
                </h2>
            </div>

            <div className="map-editor-layout">
                <RoomMapSidebar unplacedDevices={editor.unplacedDevices} totalDevices={editor.allDevicesCount} />

                <div className="map-editor-main-column">
                    <RoomMapEditorCanvas
                        doorEdge={editor.doorEdge}
                        gridCols={editor.gridCols}
                        gridRows={editor.gridRows}
                        canvasStyle={editor.canvasStyle}
                        wrapStyle={editor.wrapStyle}
                        canvasRef={editor.canvasRef}
                        positions={editor.positions}
                        draggingDeviceId={editor.draggingDeviceId}
                        getDeviceInfo={editor.getDeviceInfo}
                        onCanvasMouseMove={editor.onCanvasMouseMove}
                        onCanvasMouseUp={editor.onCanvasMouseUp}
                        onChipMouseDown={editor.onChipMouseDown}
                        onRemoveDevice={editor.removeDevice}
                        onDragOver={editor.handleDragOver}
                        onDrop={editor.handleDrop}
                    />

                    <RoomMapEditorFooter
                        gridCols={editor.gridCols}
                        gridRows={editor.gridRows}
                        doorEdge={editor.doorEdge}
                        saving={editor.saving}
                        onGridColsChange={editor.setGridCols}
                        onGridRowsChange={editor.setGridRows}
                        onToggleDoorEdge={editor.toggleDoorEdge}
                        onReset={editor.handleReset}
                        onSave={() => void editor.handleSave()}
                    />
                </div>
            </div>
        </main>
    );
}
