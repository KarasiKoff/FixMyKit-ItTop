import { createContext } from 'react';

export type ToastContextValue = {
    showSuccess: (message: string) => void;
    showError: (message: string) => void;
};

export const ToastContext = createContext<ToastContextValue | null>(null);
