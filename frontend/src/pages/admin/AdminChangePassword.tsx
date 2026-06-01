import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { changeOwnPassword } from '../../api/auth';
import { useToast } from '../../context/ToastContext';
import { formatApiError } from '../../utils/formatApiError';

export function AdminChangePassword() {
    const navigate = useNavigate();
    const { showSuccess, showError } = useToast();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');

    async function handlePasswordChange(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (newPassword.length < 8) {
            showError('Новый пароль не короче 8 символов');
            return;
        }
        try {
            await changeOwnPassword(currentPassword, newPassword);
            setCurrentPassword('');
            setNewPassword('');
            showSuccess('Пароль изменён');
        } catch (err) {
            showError(formatApiError(err));
        }
    }

    return (
        <main className="page page--centered">
            <div className="admin-page-head admin-page-head--edges">
                <button type="button" className="admin-back-link" onClick={() => navigate(-1)}>
                    ← Назад
                </button>
                <h2 className="page-title">Сменить пароль</h2>
            </div>
            <section className="card admin-password-page">
                <h3 className="card-heading">Сменить свой пароль</h3>
                <form className="admin-password-page-form" onSubmit={handlePasswordChange}>
                    <label className="admin-inline-field">
                        <span className="admin-inline-label">Текущий пароль</span>
                        <input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            autoComplete="current-password"
                            required
                        />
                    </label>
                    <label className="admin-inline-field">
                        <span className="admin-inline-label">Новый пароль</span>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            autoComplete="new-password"
                            required
                            minLength={8}
                        />
                    </label>
                    <div className="admin-inline-actions">
                        <button type="submit" className="btn-primary">
                            Сохранить новый пароль
                        </button>
                    </div>
                </form>
            </section>
        </main>
    );
}
