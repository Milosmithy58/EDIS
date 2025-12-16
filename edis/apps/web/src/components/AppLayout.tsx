import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useContext, useEffect } from 'react';
import { useAuth } from '../lib/authContext';
import { appContext } from '../lib/appContext';

const AppLayout = () => {
  const { user, logout } = useAuth();
  const { darkMode, setDarkMode } = useContext(appContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (darkMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleDarkMode = () => {
    setDarkMode(darkMode === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              EDIS
            </Link>
            <nav className="hidden items-center gap-3 text-sm font-medium text-slate-600 dark:text-slate-300 md:flex">
              <NavLink
                to="/"
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1 transition hover:bg-slate-100 dark:hover:bg-slate-800 ${
                    isActive ? 'bg-slate-100 dark:bg-slate-800' : ''
                  }`
                }
                end
              >
                Dashboard
              </NavLink>
              <NavLink
                to="/trip-planner"
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1 transition hover:bg-slate-100 dark:hover:bg-slate-800 ${
                    isActive ? 'bg-slate-100 dark:bg-slate-800' : ''
                  }`
                }
              >
                Trip planner
              </NavLink>
              {user?.role === 'admin' ? (
                <>
                  <NavLink
                    to="/admin-keys"
                    className={({ isActive }) =>
                      `rounded-lg px-3 py-1 transition hover:bg-slate-100 dark:hover:bg-slate-800 ${
                        isActive ? 'bg-slate-100 dark:bg-slate-800' : ''
                      }`
                    }
                  >
                    Provider keys
                  </NavLink>
                  <NavLink
                    to="/admin/users"
                    className={({ isActive }) =>
                      `rounded-lg px-3 py-1 transition hover:bg-slate-100 dark:hover:bg-slate-800 ${
                        isActive ? 'bg-slate-100 dark:bg-slate-800' : ''
                      }`
                    }
                  >
                    User management
                  </NavLink>
                </>
              ) : null}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleDarkMode}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus:ring-offset-slate-900"
              aria-label="Toggle dark mode"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-5 w-5 dark:hidden"
              >
                <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V18.75a.75.75 0 01.75-.75zM5.106 17.834a.75.75 0 001.06 1.06l1.591-1.59a.75.75 0 00-1.06-1.061l-1.591 1.59zM3 12a.75.75 0 01.75-.75h2.25a.75.75 0 010 1.5H3.75A.75.75 0 013 12zM6.166 5.106a.75.75 0 00-1.06 1.06l1.59 1.591a.75.75 0 001.061-1.06l-1.59-1.591z" />
              </svg>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="hidden h-5 w-5 dark:block"
              >
                <path
                  fillRule="evenodd"
                  d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-3.463 1.69-6.57 4.29-8.495a.75.75 0 01.819.162z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            {user ? (
              <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {user.role}
                </span>
                <span className="font-medium">{user.username}</span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus:ring-offset-slate-900"
                >
                  Log out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;