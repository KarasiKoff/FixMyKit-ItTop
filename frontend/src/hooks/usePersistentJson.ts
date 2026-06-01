import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

export function usePersistentJson<T>(storageKey: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
    const [state, setState] = useState<T>(() => {
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) {
                return JSON.parse(raw) as T;
            }
        } catch {
            /* ignore */
        }
        return initial;
    });

    useEffect(() => {
        try {
            localStorage.setItem(storageKey, JSON.stringify(state));
        } catch {
            /* ignore */
        }
    }, [storageKey, state]);

    return [state, setState];
}
