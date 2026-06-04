import React, { useEffect, useState, ReactNode } from 'react';
import { ApiError } from '../api/client';
import {
    clearStoredAuthToken,
    getCurrentUser,
    getStoredAuthToken,
    login as loginApi,
    setStoredAuthToken,
} from '../api/auth';
import { AuthContext, type AuthContextValue } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthContextValue['user']>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(() => getStoredAuthToken() !== null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const token = getStoredAuthToken();
        if (!token) {
            setIsLoading(false);
            return;
        }

        getCurrentUser(token)
            .then((currentUser) => {
                setIsAuthenticated(true);
                setUser({
                    id: currentUser.id,
                    name: currentUser.full_name ?? currentUser.login,
                    login: currentUser.login,
                    role: currentUser.role,
                });
            })
            .catch((err) => {
                if (err instanceof ApiError && err.status === 401) {
                    clearStoredAuthToken();
                }
                setIsAuthenticated(false);
                setUser(null);
            })
            .finally(() => setIsLoading(false));
    }, []);

    async function signIn(username: string, password: string) {
        const result = await loginApi({ login: username, password });
        setStoredAuthToken(result.access_token);
        setIsAuthenticated(true);
        const currentUser = await getCurrentUser(result.access_token);
        setUser({
            id: currentUser.id,
            name: currentUser.full_name ?? currentUser.login,
            login: currentUser.login,
            role: currentUser.role,
        });
    }

    function signOut() {
        clearStoredAuthToken();
        setIsAuthenticated(false);
        setUser(null);
    }

    return (
        <AuthContext.Provider value={{ user, isAuthenticated, signIn, signOut, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
}
