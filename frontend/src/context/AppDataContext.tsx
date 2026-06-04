import React, { createContext, ReactNode, useCallback, useContext, useMemo } from 'react';
import { deleteDevice } from '../api/devices';

type AppDataContextValue = {
    removeDevice: (deviceId: string) => Promise<void>;
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
    const removeDevice = useCallback(async (deviceId: string) => {
        await deleteDevice(deviceId);
    }, []);

    const value = useMemo(() => ({ removeDevice }), [removeDevice]);

    return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
    const context = useContext(AppDataContext);
    if (!context) {
        throw new Error('useAppData must be used inside AppDataProvider');
    }
    return context;
}
