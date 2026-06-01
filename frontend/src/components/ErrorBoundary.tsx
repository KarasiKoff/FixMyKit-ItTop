import React from 'react';

interface ErrorBoundaryState {
    hasError: boolean;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
    constructor(props: React.PropsWithChildren) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <section className="card">
                    <h2>Ошибка QR-сканера</h2>
                    <p>Не удалось запустить сканер. Используйте ручной ввод или обновите страницу.</p>
                    <button type="button" onClick={() => window.location.reload()}>
                        Обновить страницу
                    </button>
                </section>
            );
        }

        return this.props.children;
    }
}
