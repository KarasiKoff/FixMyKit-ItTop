import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import sadCatUrl from '../icon/sad-cat.svg';

export function NotFoundPage() {
    const { isAuthenticated } = useAuth();
    const homeTo = isAuthenticated ? '/devices' : '/repair';

    useEffect(() => {
        document.title = 'Fix My Kit — Страница не найдена';
    }, []);

    return (
        <main className="page page-not-found-simple">
            <header className="not-found-banner">
                <div className="not-found-banner__inner">
                    <div className="not-found-banner__copy">
                        <h1 className="not-found-banner__title">404 — страница не найдена</h1>
                        <p className="not-found-banner__lead muted-text">
                            Скорее всего, ссылка устарела, страница переехала или оборудование снято с учёта. Проверьте адрес
                            или вернитесь на главную.
                        </p>
                    </div>
                    <div className="not-found-banner__visual">
                        <Link to={homeTo} className="not-found-banner__cat-link" aria-label="На главную">
                            <img
                                className="not-found-banner__cat"
                                src={sadCatUrl}
                                alt=""
                                width={324}
                                height={396}
                                decoding="async"
                            />
                        </Link>
                    </div>
                </div>
            </header>
        </main>
    );
}
