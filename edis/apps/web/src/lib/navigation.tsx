import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode, type MouseEvent } from 'react';

type NavigationContextValue = {
  path: string;
  navigate: (to: string) => void;
};

const NavigationContext = createContext<NavigationContextValue | undefined>(undefined);

const getInitialPath = () => {
  if (typeof window === 'undefined') {
    return '/';
  }
  return window.location.pathname || '/';
};

type NavigationProviderProps = {
  children: ReactNode;
};

export const NavigationProvider = ({ children }: NavigationProviderProps) => {
  const [path, setPath] = useState<string>(() => getInitialPath());

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const handler = () => setPath(window.location.pathname || '/');
    window.addEventListener('popstate', handler);
    return () => {
      window.removeEventListener('popstate', handler);
    };
  }, []);

  const navigate = useCallback((to: string) => {
    if (typeof window === 'undefined') {
      return;
    }
    if (window.location.pathname !== to) {
      window.history.pushState({}, '', to);
      setPath(to);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }, []);

  const value = useMemo(() => ({ path, navigate }), [navigate, path]);

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
};

export const useNavigation = (): NavigationContextValue => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};

type NavLinkProps = {
  to: string;
  className?: string;
  children: ReactNode;
};

export const NavLink = ({ to, className, children }: NavLinkProps) => {
  const { navigate } = useNavigation();
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    navigate(to);
  };
  return (
    <a href={to} onClick={handleClick} className={className}>
      {children}
    </a>
  );
};
