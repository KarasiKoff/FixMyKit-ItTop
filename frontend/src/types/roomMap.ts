export type DeviceOnMap = {
    deviceId: string;
    xPct: number;
    yPct: number;
    gridCol?: number | null;
    gridRow?: number | null;
    deviceName: string;
    inventoryNumber: string;
    repairStatus: 'not_in_repair' | 'in_repair';
    categoryId?: string | null;
    categoryHasIcon?: boolean;
};

export type MapDoorEdge = 'top' | 'bottom';

export type RoomMapData = {
    audienceId: number;
    gridCols: number;
    gridRows: number;
    doorEdge: MapDoorEdge;
    positions: DeviceOnMap[];
};

export type RoomDeviceListItem = {
    id: string;
    name: string;
    inventoryNumber: string;
    repairStatus: 'not_in_repair' | 'in_repair';
    isOnMap: boolean;
    categoryId?: string | null;
    categoryHasIcon?: boolean;
};
