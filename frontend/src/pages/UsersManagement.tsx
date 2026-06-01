import React from 'react';
import { fetchUsers } from '../api/users';
import { User } from '../types/user';

export function UsersManagement() {
    const [users, setUsers] = React.useState<User[]>([]);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        fetchUsers({ limit: 100 })
            .then((res) =>
                setUsers(
                    res.items.map((u) => ({
                        id: u.id,
                        name: u.name,
                        login: u.login,
                        role: u.role,
                    })),
                ),
            )
            .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить пользователей'));
    }, []);

    return (
        <main className="page">
            <h2>Управление пользователями</h2>
            <section className="card">
                {error ? <p className="error-text">{error}</p> : null}
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Логин</th>
                                <th>Имя</th>
                                <th>Роль</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((user) => (
                                <tr key={user.id}>
                                    <td>{user.login ?? user.name}</td>
                                    <td>{user.name}</td>
                                    <td>{user.role}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </main>
    );
}
