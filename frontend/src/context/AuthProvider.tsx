import React, { useEffect, useState, ReactNode } from 'react';
import { ApiError } from '../api/client';
import { clearLegacyAuthToken, getCurrentUser, login as loginApi, logout as logoutApi } from '../api/auth';
import { registerSessionExpiredHandler } from '../api/sessionExpiry';
import { AuthContext, type AuthContextValue } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthContextValue['user']>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        registerSessionExpiredHandler(() => {
            clearLegacyAuthToken();
            setIsAuthenticated(false);
            setUser(null);
        });
        return () => registerSessionExpiredHandler(null);
    }, []);

    useEffect(() => {
        clearLegacyAuthToken();
        getCurrentUser()
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
                    clearLegacyAuthToken();
                }
                setIsAuthenticated(false);
                setUser(null);
            })
            .finally(() => setIsLoading(false));
    }, []);

    async function signIn(username: string, password: string) {
        await loginApi({ login: username, password });
        const currentUser = await getCurrentUser();
        setIsAuthenticated(true);
        setUser({
            id: currentUser.id,
            name: currentUser.full_name ?? currentUser.login,
            login: currentUser.login,
            role: currentUser.role,
        });
    }

    async function signOut() {
        try {
            await logoutApi();
        } catch {
            /* ignore */
        }
        clearLegacyAuthToken();
        setIsAuthenticated(false);
        setUser(null);
    }

    return (
        <AuthContext.Provider value={{ user, isAuthenticated, signIn, signOut, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
}
