import { AdminAuthProvider, useAdminAuth } from './lib/adminAuth';
import { NavigationProvider, NavLink, useNavigation } from './lib/navigation';
import Home from './routes/Home';
import AdminLogin from './routes/AdminLogin';
import AdminKeys from './routes/AdminKeys';
import TripPlannerPage from './routes/TripPlannerPage';

const RouterView = () => {
  const { path } = useNavigation();
  const { token } = useAdminAuth();

  const adminNav = import.meta.env.DEV && token ? (
    <NavLink
      to="/admin-keys"
      className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-200 focus:ring-offset-2 focus:ring-offset-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:focus:ring-offset-slate-900"
    >
      Admin → API Keys
    </NavLink>
  ) : null;

  if (path === '/admin-login') {
    return <AdminLogin />;
  }

  if (path === '/admin-keys') {
    return <AdminKeys />;
  }

  if (path === '/trip-planner') {
    return <TripPlannerPage />;
  }

  return <Home adminNav={adminNav} />;
};

const App = () => (
  <AdminAuthProvider>
    <NavigationProvider>
      <RouterView />
    </NavigationProvider>
  </AdminAuthProvider>
);

export default App;
