import { createContext } from 'react';

export type AppDataContextValue = {
    removeDevice: (deviceId: string) => Promise<void>;
};

export const AppDataContext = createContext<AppDataContextValue | null>(null);
