import { useEffect } from 'react';
import { matchPath, useLocation } from 'react-router-dom';

const APP_NAME = 'Fix My Kit';

/** Порядок важен: сначала более специфичные пути. */
const ROUTE_SUFFIXES: { pattern: string; suffix: string }[] = [
    { pattern: '/admin/add/category', suffix: 'Категории' },
    { pattern: '/admin/add/room', suffix: 'Кабинеты' },
    { pattern: '/admin/add/device', suffix: 'Добавить устройство' },
    { pattern: '/admin/add/user', suffix: 'Пользователи' },
    { pattern: '/admin/users', suffix: 'Пользователи' },
    { pattern: '/admin/announcements', suffix: 'Объявления' },
    { pattern: '/admin/logs', suffix: 'Логи' },
    { pattern: '/admin', suffix: 'Админка' },
    { pattern: '/requests/:id', suffix: 'Заявка' },
    { pattern: '/requests', suffix: 'Заявки' },
    { pattern: '/devices/:id', suffix: 'Устройство' },
    { pattern: '/devices', suffix: 'Оборудование' },
    { pattern: '/room-maps', suffix: 'Карта кабинетов' },
    { pattern: '/users', suffix: 'Пользователи' },
    { pattern: '/repair', suffix: 'Заявка на ремонт' },
    { pattern: '/privacy', suffix: 'Политика конфиденциальности' },
    { pattern: '/login', suffix: 'Вход' },
    { pattern: '/scan', suffix: 'QR-сканер' },
];

function titleForPath(pathname: string): string {
    for (const { pattern, suffix } of ROUTE_SUFFIXES) {
        if (matchPath({ path: pattern, end: true }, pathname)) {
            return `${APP_NAME} ${suffix}`;
        }
    }
    return APP_NAME;
}

/**
 * Синхронизирует заголовок вкладки браузера с текущим маршрутом.
 */
export function RouteDocumentTitle() {
    const { pathname } = useLocation();

    useEffect(() => {
        document.title = titleForPath(pathname);
    }, [pathname]);

    return null;
}
