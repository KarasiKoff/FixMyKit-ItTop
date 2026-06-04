import { Link } from 'react-router-dom';

export type RepairSubmitSuccessProps = {
    title: string;
    /** Подпись над значением, например «Инв. номер» */
    targetCaption?: string;
    targetLabel: string;
    lines?: string[];
    primaryLabel?: string;
    primaryTo?: string;
};

function QrIcon() {
    return (
        <svg className="repair-submit-success__btn-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
                fill="currentColor"
                d="M4 4h6v6H4V4zm2 2v2h2V6H6zm8-2h6v6h-6V4zm2 2v2h2V6h-2zM4 14h6v6H4v-6zm2 2v2h2v-2H6zm3-2h2v2h-2v-2zm2 2h2v2h-2v-2zm2-2h2v2h-2v-2zm2 2h2v2h-2v-2zm2-2h2v6h-2v-4h-2v-2zm-2 4h2v2h-2v-2z"
            />
        </svg>
    );
}

export function RepairSubmitSuccess({
    title,
    targetCaption = 'Инв. номер',
    targetLabel,
    lines = [],
    primaryLabel = 'Сканировать другой QR-код',
    primaryTo = '/scan',
}: RepairSubmitSuccessProps) {
    const primaryIsScan = primaryTo === '/scan' || /scan/i.test(primaryLabel);

    return (
        <section className="repair-submit-success card card--narrow-device">
            <div className="repair-submit-success__icon" aria-hidden="true">
                ✓
            </div>
            <h1 className="repair-submit-success__title">{title}</h1>
            <p className="repair-submit-success__target">
                <span className="repair-submit-success__target-label">{targetCaption}</span>
                <span className="repair-submit-success__target-value">{targetLabel}</span>
            </p>
            {lines.length > 0 ? (
                <ul className="repair-submit-success__notes">
                    {lines.map((line) => (
                        <li key={line}>{line}</li>
                    ))}
                </ul>
            ) : null}
            <div className="repair-submit-success__actions">
                <Link to={primaryTo} className="repair-submit-success__btn repair-submit-success__btn--primary">
                    {primaryIsScan ? <QrIcon /> : null}
                    <span>{primaryLabel}</span>
                </Link>
            </div>
        </section>
    );
}
