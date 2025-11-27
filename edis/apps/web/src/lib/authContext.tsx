import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as authClient from './authClient';
import type { AuthUser } from './authClient';

export type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    setIsLoading(true);
    try {
      const current = await authClient.fetchCurrentUser();
      setUser(current);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshUser();
  }, []);

  const login = async (username: string, password: string) => {
    const loggedIn = await authClient.login(username, password);
    setUser(loggedIn);
  };

  const logout = async () => {
    await authClient.logout();
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      isLoading,
      login,
      logout,
      refreshUser
    }),
    [user, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
