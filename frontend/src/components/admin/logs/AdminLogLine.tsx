import React from 'react';
import type { LogEntry } from '../../../api/adminLogs';
import { findLoggerRef, findMessageHint } from '../../../utils/logReference';

function levelClass(level: string): string {
    const l = level.toUpperCase();
    if (l === 'ERROR' || l === 'CRITICAL') {
        return 'admin-log-line--error';
    }
    if (l === 'WARNING') {
        return 'admin-log-line--warn';
    }
    if (l === 'DEBUG') {
        return 'admin-log-line--debug';
    }
    return 'admin-log-line--info';
}

function formatTs(ts: string | null | undefined): string {
    if (!ts) {
        return '—';
    }
    try {
        return new Date(ts).toLocaleString('ru-RU');
    } catch {
        return ts;
    }
}

export function AdminLogLine({ entry }: { entry: LogEntry }) {
    const extra = entry.extra && Object.keys(entry.extra).length > 0 ? JSON.stringify(entry.extra, null, 0) : null;
    const loggerRef = findLoggerRef(entry.logger);
    const messageHint = findMessageHint(entry.message, entry.logger);
    return (
        <div className={`admin-log-line ${levelClass(entry.level)}`}>
            <div className="admin-log-line__meta">
                <span className="admin-log-line__time">{formatTs(entry.ts)}</span>
                <span className="admin-log-line__level">{entry.level}</span>
                {entry.request_id && entry.request_id !== '-' ? (
                    <span className="admin-log-line__rid" title={`request_id: ${entry.request_id}`}>
                        {entry.request_id.slice(0, 8)}…
                    </span>
                ) : null}
                {entry.logger ? (
                    <span
                        className="admin-log-line__logger"
                        title={loggerRef ? `${loggerRef.title}: ${loggerRef.description}` : entry.logger}
                    >
                        {loggerRef?.title ?? entry.logger}
                    </span>
                ) : null}
            </div>
            <div className="admin-log-line__msg">{entry.message || entry.raw}</div>
            {messageHint ? <p className="admin-log-line__hint">{messageHint.description}</p> : null}
            {extra ? <pre className="admin-log-line__extra">{extra}</pre> : null}
            {entry.exception ? <pre className="admin-log-line__exc">{entry.exception}</pre> : null}
        </div>
    );
}
