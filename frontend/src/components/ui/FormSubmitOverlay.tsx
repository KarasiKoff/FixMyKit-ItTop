import { createPortal } from 'react-dom';
import { LoadingSpinner } from './LoadingSpinner';

type Props = {
    open: boolean;
    title: string;
    detail?: string;
};

/** Полноэкранный блокер на время отправки формы (не закрывается кликом). */
export function FormSubmitOverlay({ open, title, detail }: Props) {
    if (!open || typeof document === 'undefined') {
        return null;
    }

    return createPortal(
        <div
            className="form-submit-overlay"
            role="alertdialog"
            aria-modal="true"
            aria-busy="true"
            aria-labelledby="form-submit-overlay-title"
        >
            <div className="form-submit-overlay__panel">
                <LoadingSpinner size="lg" />
                <p id="form-submit-overlay-title" className="form-submit-overlay__title">
                    {title}
                </p>
                {detail ? <p className="form-submit-overlay__detail">{detail}</p> : null}
            </div>
        </div>,
        document.body,
    );
}
