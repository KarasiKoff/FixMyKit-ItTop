import React from 'react';
import type { RoomDeviceListItem } from '../../types/roomMap';

function SidebarItem({ item }: { item: RoomDeviceListItem }) {
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

type RoomMapSidebarProps = {
    unplacedDevices: RoomDeviceListItem[];
    totalDevices: number;
};

export function RoomMapSidebar({ unplacedDevices, totalDevices }: RoomMapSidebarProps) {
    return (
        <aside className="map-device-sidebar">
            <p className="map-device-sidebar__title">Не размещено</p>
            {unplacedDevices.length === 0 ? (
                <p className="muted-text" style={{ fontSize: '0.82rem', margin: 0 }}>
                    Все устройства размещены
                </p>
            ) : (
                unplacedDevices.map((d) => <SidebarItem key={d.id} item={d} />)
            )}
            {totalDevices === 0 && (
                <p className="muted-text" style={{ fontSize: '0.82rem', margin: 0 }}>
                    В этом кабинете нет устройств
                </p>
            )}
        </aside>
    );
}
