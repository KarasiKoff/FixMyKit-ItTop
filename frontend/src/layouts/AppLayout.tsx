import { Link, NavLink, Outlet } from 'react-router-dom';
import { SiteAnnouncementBanners } from '../components/SiteAnnouncementBanners';
import { TopbarMobileMenu } from '../components/TopbarMobileMenu';
import { UserAccountMenu } from '../components/UserAccountMenu';
import { useAuth } from '../hooks/useAuth';

export function AppLayout() {
    const { isAuthenticated } = useAuth();

    return (
        <div className="app-shell">
            <header className="topbar">
                <div className="topbar-inner">
                    <div className="topbar-brand">
                        <Link to="/repair" className="topbar-brand-link">
                            <h1>Fix My Kit</h1>
                        </Link>
                    </div>
                    <nav className="topbar-nav">
                        {!isAuthenticated ? (
                            <NavLink to="/repair">Главная</NavLink>
                        ) : (
                            <div className="topbar-nav-auth">
                                <div className="topbar-nav-auth__links">
                                    <NavLink to="/scan">QR</NavLink>
                                    <NavLink to="/repair">Заявка</NavLink>
                                    <NavLink to="/devices">Оборудование</NavLink>
                                    <NavLink to="/room-maps">Карта кабинетов</NavLink>
                                    <NavLink to="/requests">Все заявки</NavLink>
                                    <NavLink to="/admin">Админка</NavLink>
                                </div>
                                <UserAccountMenu />
                            </div>
                        )}
                    </nav>
                    {isAuthenticated ? <TopbarMobileMenu /> : null}
                </div>
            </header>
            <SiteAnnouncementBanners />
            <div className="app-shell-main">
                <Outlet />
            </div>
        </div>
    );
}
