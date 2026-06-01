import React from 'react';
import { Link } from 'react-router-dom';
import { ScrollToTopButton } from '../../components/ScrollToTopButton';
import { AdminUsersPanel } from './AdminUsersPanel';

export function AdminUsersPage() {
    return (
        <main className="page page--wide">
            <div className="admin-page-head admin-page-head--edges">
                <Link to="/admin" className="admin-back-link">
                    ← К админке
                </Link>
                <h2 className="page-title">Пользователи</h2>
            </div>
            <AdminUsersPanel />
            <ScrollToTopButton />
        </main>
    );
}
