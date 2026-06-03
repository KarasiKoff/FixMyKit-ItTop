import React from 'react';
import { BrowserRouter, NavLink, Navigate, Route, Routes, Link } from 'react-router-dom';
import { Login } from '../pages/Login';
import { DevicesList } from '../pages/DevicesList';
import { DeviceDetail } from '../pages/DeviceDetail';
import { NewRepairRequest } from '../pages/NewRepairRequest';
import { RepairRequests } from '../pages/RepairRequests';
import { RepairRequestDetailPage } from '../pages/RepairRequestDetailPage';
import { UsersManagement } from '../pages/UsersManagement';
import { QRScan } from '../pages/QRScan';
import { AdminHub } from '../pages/admin/AdminHub';
import { AdminLogsPage } from '../pages/admin/AdminLogsPage';
import { AdminUsersPage } from '../pages/admin/AdminUsersPage';
import { AdminAddCategory } from '../pages/admin/AdminAddCategory';
import { AdminAddRoom } from '../pages/admin/AdminAddRoom';
import { AdminAddDevice } from '../pages/admin/AdminAddDevice';
import { AdminChangePassword } from '../pages/admin/AdminChangePassword';
import { RoomMapEditor } from '../pages/admin/RoomMapEditor';
import { AdminEditDevice } from '../pages/admin/AdminEditDevice';
import { RoomMapsPage } from '../pages/RoomMapsPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { PrivacyPage } from '../pages/PrivacyPage';
import { DevicePublicPage } from '../pages/DevicePublicPage';
import { AudiencePublicPage } from '../pages/AudiencePublicPage';
import { useAuth } from '../hooks/useAuth';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { UserAccountMenu } from '../components/UserAccountMenu';
import { TopbarMobileMenu } from '../components/TopbarMobileMenu';
import { ToastProvider } from '../context/ToastContext';
import { RouteDocumentTitle } from '../components/RouteDocumentTitle';

function RequireAuth({ children }: { children: JSX.Element }) {
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

function RequireGuest({ children }: { children: JSX.Element }) {
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

function AppShell() {
    const { isAuthenticated } = useAuth();

    return (
        <div className="app-shell">
            <header className="topbar">
                <div className="topbar-inner">
                    <div className="topbar-brand">
                        <Link to="/repair" className="topbar-brand-link">
                            <h1>Fix My Kit</h1>
                        </Link>
                    </div>
                    <nav className="topbar-nav">
                        {!isAuthenticated ? (
                            <NavLink to="/repair">Главная</NavLink>
                        ) : (
                            <div className="topbar-nav-auth">
                                <div className="topbar-nav-auth__links">
                                    <NavLink to="/scan">QR</NavLink>
                                    <NavLink to="/repair">Заявка</NavLink>
                                    <NavLink to="/devices">Оборудование</NavLink>
                                    <NavLink to="/room-maps">Карта кабинетов</NavLink>
                                    <NavLink to="/requests">Все заявки</NavLink>
                                    <NavLink to="/admin">Админка</NavLink>
                                </div>
                                <UserAccountMenu />
                            </div>
                        )}
                    </nav>
                    {isAuthenticated ? <TopbarMobileMenu /> : null}
                </div>
            </header>
            <div className="app-shell-main">
            <Routes>
                <Route
                    path="/"
                    element={isAuthenticated ? <Navigate to="/devices" replace /> : <Navigate to="/repair" replace />}
                />
                <Route path="/login" element={<RequireGuest><Login /></RequireGuest>} />
                <Route path="/devices" element={<RequireAuth><DevicesList /></RequireAuth>} />
                <Route path="/devices/:id" element={<RequireAuth><DeviceDetail /></RequireAuth>} />
                <Route path="/room-maps" element={<RequireAuth><RoomMapsPage /></RequireAuth>} />
                <Route path="/repair" element={<NewRepairRequest />} />
                <Route path="/requests" element={<RequireAuth><RepairRequests /></RequireAuth>} />
                <Route path="/requests/:id" element={<RequireAuth><RepairRequestDetailPage /></RequireAuth>} />
                <Route path="/users" element={<RequireAuth><UsersManagement /></RequireAuth>} />
                <Route path="/admin" element={<RequireAuth><AdminHub /></RequireAuth>} />
                <Route path="/admin/logs" element={<RequireAuth><AdminLogsPage /></RequireAuth>} />
                <Route path="/admin/users" element={<RequireAuth><AdminUsersPage /></RequireAuth>} />
                <Route path="/admin/add/category" element={<RequireAuth><AdminAddCategory /></RequireAuth>} />
                <Route path="/admin/add/room" element={<RequireAuth><AdminAddRoom /></RequireAuth>} />
                <Route path="/admin/add/device" element={<RequireAuth><AdminAddDevice /></RequireAuth>} />
                <Route path="/admin/password" element={<RequireAuth><AdminChangePassword /></RequireAuth>} />
                <Route path="/admin/room/:id/map" element={<RequireAuth><RoomMapEditor /></RequireAuth>} />
                <Route path="/admin/device/:id/edit" element={<RequireAuth><AdminEditDevice /></RequireAuth>} />
                <Route path="/admin/add/user" element={<Navigate to="/admin/users" replace />} />
                <Route path="/scan" element={<ErrorBoundary><QRScan /></ErrorBoundary>} />
                <Route path="/device/:id/public" element={<DevicePublicPage />} />
                <Route path="/audience/:id/public" element={<AudiencePublicPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="*" element={<NotFoundPage />} />
            </Routes>
            </div>
        </div>
    );
}

export function AppRouter() {
    return (
        <BrowserRouter>
            <ToastProvider>
                <RouteDocumentTitle />
                <AppShell />
            </ToastProvider>
        </BrowserRouter>
    );
}
