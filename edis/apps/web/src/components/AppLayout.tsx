import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/authContext';

const AppLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              EDIS
            </Link>
            <nav className="flex items-center gap-3 text-sm font-medium text-slate-600 dark:text-slate-300">
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
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;
