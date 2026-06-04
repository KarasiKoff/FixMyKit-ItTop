import { Navigate, Route, Routes } from 'react-router-dom';
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
import { AdminAnnouncementsPage } from '../pages/admin/AdminAnnouncementsPage';
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
import { RequireAuth, RequireGuest } from './AuthGuards';

export function AppRoutes() {
    const { isAuthenticated } = useAuth();

    return (
        <Routes>
            <Route
                path="/"
                element={isAuthenticated ? <Navigate to="/devices" replace /> : <Navigate to="/repair" replace />}
            />
            <Route
                path="/login"
                element={
                    <RequireGuest>
                        <Login />
                    </RequireGuest>
                }
            />
            <Route
                path="/devices"
                element={
                    <RequireAuth>
                        <DevicesList />
                    </RequireAuth>
                }
            />
            <Route
                path="/devices/:id"
                element={
                    <RequireAuth>
                        <DeviceDetail />
                    </RequireAuth>
                }
            />
            <Route
                path="/room-maps"
                element={
                    <RequireAuth>
                        <RoomMapsPage />
                    </RequireAuth>
                }
            />
            <Route path="/repair" element={<NewRepairRequest />} />
            <Route
                path="/requests"
                element={
                    <RequireAuth>
                        <RepairRequests />
                    </RequireAuth>
                }
            />
            <Route
                path="/requests/:id"
                element={
                    <RequireAuth>
                        <RepairRequestDetailPage />
                    </RequireAuth>
                }
            />
            <Route
                path="/users"
                element={
                    <RequireAuth>
                        <UsersManagement />
                    </RequireAuth>
                }
            />
            <Route
                path="/admin"
                element={
                    <RequireAuth>
                        <AdminHub />
                    </RequireAuth>
                }
            />
            <Route
                path="/admin/logs"
                element={
                    <RequireAuth>
                        <AdminLogsPage />
                    </RequireAuth>
                }
            />
            <Route
                path="/admin/announcements"
                element={
                    <RequireAuth>
                        <AdminAnnouncementsPage />
                    </RequireAuth>
                }
            />
            <Route
                path="/admin/users"
                element={
                    <RequireAuth>
                        <AdminUsersPage />
                    </RequireAuth>
                }
            />
            <Route
                path="/admin/add/category"
                element={
                    <RequireAuth>
                        <AdminAddCategory />
                    </RequireAuth>
                }
            />
            <Route
                path="/admin/add/room"
                element={
                    <RequireAuth>
                        <AdminAddRoom />
                    </RequireAuth>
                }
            />
            <Route
                path="/admin/add/device"
                element={
                    <RequireAuth>
                        <AdminAddDevice />
                    </RequireAuth>
                }
            />
            <Route
                path="/admin/password"
                element={
                    <RequireAuth>
                        <AdminChangePassword />
                    </RequireAuth>
                }
            />
            <Route
                path="/admin/room/:id/map"
                element={
                    <RequireAuth>
                        <RoomMapEditor />
                    </RequireAuth>
                }
            />
            <Route
                path="/admin/device/:id/edit"
                element={
                    <RequireAuth>
                        <AdminEditDevice />
                    </RequireAuth>
                }
            />
            <Route path="/admin/add/user" element={<Navigate to="/admin/users" replace />} />
            <Route
                path="/scan"
                element={
                    <ErrorBoundary>
                        <QRScan />
                    </ErrorBoundary>
                }
            />
            <Route path="/device/:id/public" element={<DevicePublicPage />} />
            <Route path="/audience/:id/public" element={<AudiencePublicPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="*" element={<NotFoundPage />} />
        </Routes>
    );
}
