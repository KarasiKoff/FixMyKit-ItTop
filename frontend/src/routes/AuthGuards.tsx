import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function RequireAuth({ children }: { children: JSX.Element }) {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return (
            <main className="page">
                <p>Загрузка...</p>
            </main>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return children;
}

export function RequireGuest({ children }: { children: JSX.Element }) {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return (
            <main className="page">
                <p>Загрузка...</p>
            </main>
        );
    }

    if (isAuthenticated) {
        return <Navigate to="/devices" replace />;
    }

    return children;
}
