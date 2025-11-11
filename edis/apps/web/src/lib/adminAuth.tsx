import { createContext, useContext, useMemo, useState } from 'react';

type AdminAuthContextValue = {
  token: string | null;
  setToken: (token: string | null) => void;
};

const AdminAuthContext = createContext<AdminAuthContextValue | undefined>(undefined);

type AdminAuthProviderProps = {
  children: React.ReactNode;
};

export const AdminAuthProvider = ({ children }: AdminAuthProviderProps) => {
  const [token, setToken] = useState<string | null>(null);
  const value = useMemo(() => ({ token, setToken }), [token]);
  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
};

export const useAdminAuth = (): AdminAuthContextValue => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};
