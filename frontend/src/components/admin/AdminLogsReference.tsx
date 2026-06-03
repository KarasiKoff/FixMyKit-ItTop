import React, { useState } from 'react';
import { LOG_LOGGER_GROUPS, LOG_MESSAGE_HINTS } from '../../utils/logReference';

export function AdminLogsReference() {
    const [open, setOpen] = useState(false);

    return (
        <section className="card card--hub admin-logs-reference">
            <button
                type="button"
                className="admin-logs-reference__toggle"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
            >
                <span className="admin-logs-reference__toggle-title">Справочник: логгеры и события</span>
                <span className="admin-logs-reference__chevron" aria-hidden="true">
                    {open ? '▲' : '▼'}
                </span>
            </button>
            {open ? (
                <div className="admin-logs-reference__body">
                    <p className="muted-text admin-logs-reference__intro">
                        В JSON-логе поле <code>logger</code> — кто пишет, <code>message</code> — что произошло.
                        <code>request_id</code> одинаковый у всех строк одного HTTP-запроса. Поиск: вставьте имя логгера
                        или message в поле «Поиск» выше.
                    </p>

                    {LOG_LOGGER_GROUPS.map((group) => (
                        <div key={group.title} className="admin-logs-reference__group">
                            <h4 className="admin-logs-reference__group-title">{group.title}</h4>
                            <div className="admin-logs-reference__table-wrap">
                                <table className="admin-logs-reference__table">
                                    <thead>
                                        <tr>
                                            <th>logger</th>
                                            <th>Смысл</th>
                                            <th>Типичные message</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {group.items.map((item) => (
                                            <tr key={item.id}>
                                                <td>
                                                    <code className="admin-logs-reference__code">{item.id}</code>
                                                    <div className="admin-logs-reference__subtitle">{item.title}</div>
                                                </td>
                                                <td>{item.description}</td>
                                                <td>
                                                    {item.typicalMessages?.length ? (
                                                        <ul className="admin-logs-reference__msg-list">
                                                            {item.typicalMessages.map((m) => (
                                                                <li key={m}>
                                                                    <code>{m}</code>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        '—'
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}

                    <div className="admin-logs-reference__group">
                        <h4 className="admin-logs-reference__group-title">Уровни</h4>
                        <ul className="admin-logs-reference__levels">
                            <li>
                                <strong>INFO</strong> — штатные действия (запросы, успешный Tracker, вход).
                            </li>
                            <li>
                                <strong>WARNING</strong> — подозрительно, но сервис работает (неверный логин, noop
                                вебхука, очередь SSE полна).
                            </li>
                            <li>
                                <strong>ERROR / CRITICAL</strong> — сбои; дублируются в fixmykit-error.log и файл
                                «Только сбои» в фильтре.
                            </li>
                            <li>
                                <strong>DEBUG</strong> — детали (пул БД, успешный JWT); видны при LOG_LEVEL=DEBUG на
                                сервере.
                            </li>
                        </ul>
                    </div>

                    <div className="admin-logs-reference__group">
                        <h4 className="admin-logs-reference__group-title">Частые message (глоссарий)</h4>
                        <div className="admin-logs-reference__table-wrap">
                            <table className="admin-logs-reference__table admin-logs-reference__table--compact">
                                <thead>
                                    <tr>
                                        <th>message</th>
                                        <th>Что значит</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {LOG_MESSAGE_HINTS.map((hint) => (
                                        <tr key={hint.match}>
                                            <td>
                                                <code>{hint.match}</code>
                                            </td>
                                            <td>{hint.description}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : null}
        </section>
    );
}
