import React, { ReactNode, useCallback, useMemo } from 'react';
import { deleteDevice } from '../api/devices';
import { AppDataContext } from './app-data-context';

export function AppDataProvider({ children }: { children: ReactNode }) {
    const removeDevice = useCallback(async (deviceId: string) => {
        await deleteDevice(deviceId);
    }, []);

    const value = useMemo(() => ({ removeDevice }), [removeDevice]);

    return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}
