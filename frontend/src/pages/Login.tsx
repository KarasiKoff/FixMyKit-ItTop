import React, { useContext, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { formatApiError } from '../utils/formatApiError';

export function Login() {
    const { isAuthenticated, signIn } = useContext(AuthContext);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);

        try {
            await signIn(username, password);
            navigate('/devices', { replace: true });
        } catch (err) {
            setError(formatApiError(err));
        }
    }

    return (
        <main className="login-page">
            <div className="login-stack">
                <section className="card login-info-card">
                    <h2 className="login-card-title">Учёт оборудования</h2>
                    <p className="muted-text login-lead">Учёт оборудования и заявки на ремонт.</p>
                </section>

                <section className="card login-form-card">
                    <h2 className="login-card-title">Вход в систему</h2>
                    {isAuthenticated ? (
                        <p className="muted-text">Вы уже вошли в систему.</p>
                    ) : (
                        <form className="request-form" onSubmit={handleSubmit}>
                            {error ? <p className="error-text">{error}</p> : null}
                            <label>
                                Логин
                                <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
                            </label>
                            <label>
                                Пароль
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    autoComplete="current-password"
                                />
                            </label>
                            <button type="submit" className="btn-primary">
                                Войти
                            </button>
                            <p className="muted-text login-footer-link">
                                <NavLink to="/repair">На главную без входа</NavLink>
                            </p>
                        </form>
                    )}
                </section>
            </div>
        </main>
    );
}
