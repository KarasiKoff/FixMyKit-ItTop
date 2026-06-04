import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '../context/ToastProvider';
import { RouteDocumentTitle } from '../components/RouteDocumentTitle';
import { AppLayout } from '../layouts/AppLayout';
import { AppRoutes } from './AppRoutes';

export function AppRouter() {
    return (
        <BrowserRouter>
            <ToastProvider>
                <RouteDocumentTitle />
                <Routes>
                    <Route element={<AppLayout />}>
                        <Route path="*" element={<AppRoutes />} />
                    </Route>
                </Routes>
            </ToastProvider>
        </BrowserRouter>
    );
}
