type Props = {
    size?: 'md' | 'lg';
    className?: string;
};

export function LoadingSpinner({ size = 'md', className }: Props) {
    const sizeClass = size === 'lg' ? 'loading-spinner--lg' : 'loading-spinner--md';
    const extra = className ? ` ${className}` : '';
    return <div className={`loading-spinner ${sizeClass}${extra}`} aria-hidden="true" />;
}
