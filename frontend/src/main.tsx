import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppRouter } from './routes/AppRouter';
import { AuthProvider } from './context/AuthContext';
import { AppDataProvider } from './context/AppDataContext';
import { AttachmentLimitsProvider } from './context/AttachmentLimitsContext';
import './styles/app.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <AttachmentLimitsProvider>
            <AuthProvider>
                <AppDataProvider>
                    <AppRouter />
                </AppDataProvider>
            </AuthProvider>
        </AttachmentLimitsProvider>
    </React.StrictMode>,
);
