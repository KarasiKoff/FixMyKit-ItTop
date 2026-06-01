import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const defaults: IconProps = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
};

export function IconHubUsers(props: IconProps) {
    return (
        <svg {...defaults} {...props}>
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    );
}

export function IconHubCategories(props: IconProps) {
    return (
        <svg {...defaults} {...props}>
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
    );
}

export function IconHubRooms(props: IconProps) {
    return (
        <svg {...defaults} {...props}>
            <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" />
        </svg>
    );
}

export function IconHubDevice(props: IconProps) {
    return (
        <svg {...defaults} {...props}>
            <rect x="2" y="7" width="20" height="14" rx="2" />
            <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
            <path d="M12 12v.01" />
        </svg>
    );
}

export function IconKpiTotal(props: IconProps) {
    return (
        <svg {...defaults} {...props}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
        </svg>
    );
}

export function IconKpiOpen(props: IconProps) {
    return (
        <svg {...defaults} {...props}>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v8M8 12h8" />
        </svg>
    );
}

export function IconKpiProgress(props: IconProps) {
    return (
        <svg {...defaults} {...props}>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
        </svg>
    );
}

export function IconKpiResolved(props: IconProps) {
    return (
        <svg {...defaults} {...props}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <path d="M22 4 12 14.01l-3-3" />
        </svg>
    );
}

export function IconKpiWontFix(props: IconProps) {
    return (
        <svg {...defaults} {...props}>
            <circle cx="12" cy="12" r="10" />
            <path d="m15 9-6 6M9 9l6 6" />
        </svg>
    );
}

export function IconCalendar(props: IconProps) {
    return (
        <svg {...defaults} {...props}>
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
    );
}

export function IconSync(props: IconProps) {
    return (
        <svg {...defaults} {...props}>
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 16h5v5" />
        </svg>
    );
}

export function IconRefDevices(props: IconProps) {
    return (
        <svg {...defaults} width={18} height={18} {...props}>
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8M12 17v4" />
        </svg>
    );
}

export function IconRefCategories(props: IconProps) {
    return (
        <svg {...defaults} width={18} height={18} {...props}>
            <path d="M4 7h16M4 12h16M4 17h10" />
        </svg>
    );
}

export function IconRefRooms(props: IconProps) {
    return (
        <svg {...defaults} width={18} height={18} {...props}>
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <path d="M9 22V12h6v10" />
        </svg>
    );
}

export function IconEdit(props: IconProps) {
    return (
        <svg {...defaults} width={18} height={18} {...props}>
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
        </svg>
    );
}

export function IconTrash(props: IconProps) {
    return (
        <svg {...defaults} width={18} height={18} {...props}>
            <path d="M3 6h18" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path d="M10 11v6M14 11v6" />
        </svg>
    );
}

export function IconCheck(props: IconProps) {
    return (
        <svg {...defaults} width={18} height={18} {...props}>
            <path d="M20 6 9 17 4 12" />
        </svg>
    );
}

export function IconClose(props: IconProps) {
    return (
        <svg {...defaults} width={18} height={18} {...props}>
            <path d="M18 6 6 18M6 6l12 12" />
        </svg>
    );
}

export function IconBan(props: IconProps) {
    return (
        <svg {...defaults} width={18} height={18} {...props}>
            <circle cx="12" cy="12" r="10" />
            <path d="m4.93 4.93 14.14 14.14" />
        </svg>
    );
}

export function IconPower(props: IconProps) {
    return (
        <svg {...defaults} width={18} height={18} {...props}>
            <path d="M12 3v7" />
            <path d="M17.64 7.36a7.5 7.5 0 1 1-11.28 0" />
        </svg>
    );
}

export function IconCircleCheck(props: IconProps) {
    return (
        <svg {...defaults} width={18} height={18} {...props}>
            <circle cx="12" cy="12" r="10" />
            <path d="m9 12 2 2 4-4" />
        </svg>
    );
}

export function IconLock(props: IconProps) {
    return (
        <svg {...defaults} width={18} height={18} {...props}>
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
    );
}
