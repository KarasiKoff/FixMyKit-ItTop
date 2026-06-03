import { LoadingSpinner } from './LoadingSpinner';

type Props = {
    title?: string;
    detail?: string;
    className?: string;
};

export function LoadingPanel({ title = 'Загрузка…', detail, className }: Props) {
    const rootClass = ['loading-panel', className].filter(Boolean).join(' ');
    return (
        <div className={rootClass} role="status" aria-live="polite">
            <LoadingSpinner size="lg" />
            <p className="loading-panel__title">{title}</p>
            {detail ? <p className="loading-panel__detail">{detail}</p> : null}
        </div>
    );
}
