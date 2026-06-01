export type User = {
    id: string;
    name: string;
    login?: string;
    role: 'admin' | 'sysadmin';
};
