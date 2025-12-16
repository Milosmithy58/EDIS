import { createContext, useState, ReactNode } from 'react';
import { getLocalStorage, setLocalStorage } from './localStorage';

type AppContextType = {
  darkMode: 'light' | 'dark';
  setDarkMode: (mode: 'light' | 'dark') => void;
};

export const appContext = createContext<AppContextType>({
  darkMode: 'dark',
  setDarkMode: () => {},
});

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const storedValue = getLocalStorage<'light' | 'dark'>('darkmode', 'dark');
  const [darkMode, setDarkMode] = useState<'light' | 'dark'>(storedValue);

  const updateDarkMode = (mode: 'light' | 'dark') => {
    setDarkMode(mode);
    setLocalStorage<'light' | 'dark'>('darkmode', mode);
  };

  return (
    <appContext.Provider
      value={{
        darkMode,
        setDarkMode: updateDarkMode,
      }}
    >
      {children}
    </appContext.Provider>
  );
};
