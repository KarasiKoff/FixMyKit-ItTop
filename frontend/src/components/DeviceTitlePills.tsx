import React from 'react';
import type { Device } from '../types/device';
import { deviceRepairStatusLabel, deviceRepairStatusPillClass, deviceSubcategoryPillClass } from '../utils/statusDisplay';

type Props = {
    subcategory?: string | null;
    status?: Device['status'] | null;
};

export function DeviceTitlePills({ subcategory, status }: Props) {
    if (!subcategory && !status) {
        return null;
    }

    return (
        <div className="device-title-row__pills">
            {subcategory ? (
                <span className={deviceSubcategoryPillClass()}>{subcategory}</span>
            ) : null}
            {status ? (
                <span className={deviceRepairStatusPillClass(status)}>{deviceRepairStatusLabel(status)}</span>
            ) : null}
        </div>
    );
}
