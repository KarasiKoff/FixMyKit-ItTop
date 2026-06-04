import { createContext } from 'react';
import { User } from '../types/user';

export type AuthContextValue = {
    user: null | User;
    isAuthenticated: boolean;
    signIn: (username: string, password: string) => Promise<void>;
    signOut: () => void;
    isLoading: boolean;
};

export const AuthContext = createContext<AuthContextValue>({
    user: null,
    isAuthenticated: false,
    signIn: async () => {},
    signOut: () => {},
    isLoading: true,
});
