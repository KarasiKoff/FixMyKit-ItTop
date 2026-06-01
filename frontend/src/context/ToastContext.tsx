import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

type ToastContextValue = {
    showSuccess: (message: string) => void;
    showError: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = {
    success: 2200,
    error: 3800,
} as const;

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const hide = useCallback(() => {
        setToast(null);
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const push = useCallback((type: 'success' | 'error', msg: string) => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
        setToast({ type, message: msg });
        timerRef.current = setTimeout(() => {
            setToast(null);
            timerRef.current = null;
        }, TOAST_DURATION_MS[type]);
    }, []);

    const showSuccess = useCallback((msg: string) => push('success', msg), [push]);
    const showError = useCallback((msg: string) => push('error', msg), [push]);

    const value = useMemo(() => ({ showSuccess, showError }), [showSuccess, showError]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            {toast ? (
                <ToastBanner type={toast.type} message={toast.message} onDismiss={hide} />
            ) : null}
        </ToastContext.Provider>
    );
}

function ToastBanner({
    type,
    message,
    onDismiss,
}: {
    type: 'success' | 'error';
    message: string;
    onDismiss: () => void;
}) {
    return (
        <div className="toast-host" aria-live="polite">
            <div
                className={`toast toast--${type === 'success' ? 'success' : 'error'}`}
                role="status"
                onClick={onDismiss}
                onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                        onDismiss();
                    }
                }}
            >
                {message}
            </div>
        </div>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return ctx;
}
