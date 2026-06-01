import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import type { SVGProps } from 'react';
import { runAttachmentCleanup } from '../../api/repairRequestAttachments';
import { useToast } from '../../context/ToastContext';
import { formatApiError } from '../../utils/formatApiError';
import {
    IconHubCategories,
    IconHubDevice,
    IconHubRooms,
    IconHubUsers,
} from '../../components/admin/AdminDashboardIcons';
import { useAuth } from '../../hooks/useAuth';
import { AdminHubStats } from './AdminHubStats';

const hubItems = [
    {
        to: '/admin/users',
        title: 'Пользователи',
        description: 'Список, роли, сброс пароля',
        adminOnly: false,
        titleOnly: false,
        iconClass: 'admin-hub-card-icon--users',
        Icon: IconHubUsers,
    },
    {
        to: '/admin/add/category',
        title: 'Категории',
        description: 'Справочник типов оборудования',
        adminOnly: true,
        titleOnly: false,
        iconClass: 'admin-hub-card-icon--categories',
        Icon: IconHubCategories,
    },
    {
        to: '/admin/add/room',
        title: 'Кабинеты',
        description: 'Справочник кабинетов',
        adminOnly: true,
        titleOnly: false,
        iconClass: 'admin-hub-card-icon--rooms',
        Icon: IconHubRooms,
    },
    {
        to: '/admin/add/device',
        title: 'Устройство',
        description: 'Добавить новое устройство',
        adminOnly: false,
        titleOnly: false,
        iconClass: 'admin-hub-card-icon--device',
        Icon: IconHubDevice,
    },
] as const;

function HubIcon({ Icon, iconClass }: { Icon: React.ComponentType<SVGProps<SVGSVGElement>>; iconClass: string }) {
    return (
        <span className={`admin-hub-card-icon ${iconClass}`} aria-hidden="true">
            <Icon width={20} height={20} />
        </span>
    );
}

export function AdminHub() {
    const { user } = useAuth();
    const { showSuccess, showError } = useToast();
    const isAdmin = user?.role === 'admin';
    const [cleanupLoading, setCleanupLoading] = useState(false);

    async function handleAttachmentCleanup() {
        if (!window.confirm('Удалить осиротевшие файлы и pending старше 30 дней?')) {
            return;
        }
        setCleanupLoading(true);
        try {
            const result = await runAttachmentCleanup();
            showSuccess(
                `Очистка: папок-сирот ${result.orphan_dirs_removed}, устаревших файлов ${result.stale_files_removed}, пустых каталогов ${result.empty_dirs_removed}`,
            );
        } catch (err) {
            showError(formatApiError(err));
        } finally {
            setCleanupLoading(false);
        }
    }

    return (
        <main className="page page--wide page--admin-dashboard">
            <div className="page-intro page-intro--wide">
                <h2 className="page-title">Администрирование</h2>
            </div>
            <section className="card card--hub card--stretch">
                <h3 className="card-heading">Разделы</h3>
                <div className="admin-hub-grid admin-hub-grid--row">
                    {hubItems.map((item) => {
                        const locked = item.adminOnly && !isAdmin;
                        const cardClass = [
                            'admin-hub-card',
                            item.titleOnly ? 'admin-hub-card--title-only' : '',
                        ]
                            .filter(Boolean)
                            .join(' ');
                        if (locked) {
                            return (
                                <span
                                    key={item.to}
                                    className={`${cardClass} admin-hub-card--disabled`}
                                    title="Доступно только администратору"
                                >
                                    <HubIcon Icon={item.Icon} iconClass={item.iconClass} />
                                    <span className="admin-hub-card-title">{item.title}</span>
                                    {item.description ? (
                                        <span className="admin-hub-card-desc">{item.description}</span>
                                    ) : null}
                                    <span className="admin-hub-card-action">Недоступно</span>
                                </span>
                            );
                        }
                        return (
                            <NavLink key={item.to} to={item.to} className={cardClass}>
                                <HubIcon Icon={item.Icon} iconClass={item.iconClass} />
                                <span className="admin-hub-card-title">{item.title}</span>
                                {item.description ? (
                                    <span className="admin-hub-card-desc">{item.description}</span>
                                ) : null}
                                <span className="admin-hub-card-action">Открыть →</span>
                            </NavLink>
                        );
                    })}
                </div>
            </section>

            <AdminHubStats />

            <section className="card card--hub">
                <h3 className="card-heading">Обслуживание</h3>
                <p className="admin-hub-card-desc">
                    Удаление временных вложений без заявки и файлов, не синхронизированных с Трекером более 30 дней.
                </p>
                <button
                    type="button"
                    className="btn-ghost"
                    disabled={cleanupLoading}
                    onClick={() => void handleAttachmentCleanup()}
                >
                    {cleanupLoading ? 'Очистка…' : 'Очистить временные вложения'}
                </button>
            </section>
        </main>
    );
}
