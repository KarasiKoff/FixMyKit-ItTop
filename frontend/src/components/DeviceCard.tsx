import React from 'react';
import { Device } from '../types/device';
import { deviceRepairStatusLabel, deviceRepairStatusPillClass } from '../utils/statusDisplay';

export function DeviceCard({ device }: { device: Device }) {
    return (
        <article>
            <h3>{device.name}</h3>
            <p>Инвентарный номер: {device.inventoryNumber}</p>
            <p>
                Статус:{' '}
                <span className={deviceRepairStatusPillClass(device.status)}>{deviceRepairStatusLabel(device.status)}</span>
            </p>
        </article>
    );
}
