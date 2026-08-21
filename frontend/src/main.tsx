import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppRouter } from './routes/AppRouter';
import { AuthProvider } from './context/AuthProvider';
import { AppDataProvider } from './context/AppDataProvider';
import { AttachmentLimitsProvider } from './context/AttachmentLimitsProvider';
import { PublicIntegrationProvider } from './context/PublicIntegrationProvider';
import './styles/app.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <AttachmentLimitsProvider>
            <PublicIntegrationProvider>
                <AuthProvider>
                    <AppDataProvider>
                        <AppRouter />
                    </AppDataProvider>
                </AuthProvider>
            </PublicIntegrationProvider>
        </AttachmentLimitsProvider>
    </React.StrictMode>,
);
