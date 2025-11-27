import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import { AuthProvider } from './lib/authContext';
import Home from './routes/Home';
import AdminKeys from './routes/AdminKeys';
import TripPlannerPage from './routes/TripPlannerPage';
import ProtectedRoute from './routes/ProtectedRoute';
import AdminRoute from './routes/AdminRoute';
import LoginPage from './routes/LoginPage';
import AdminUsersPage from './routes/AdminUsersPage';

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<ProtectedRoute />}>
      <Route element={<AppLayout />}>
        <Route index element={<Home />} />
        <Route path="trip-planner" element={<TripPlannerPage />} />
        <Route element={<AdminRoute />}>
          <Route path="admin-keys" element={<AdminKeys />} />
          <Route path="admin/users" element={<AdminUsersPage />} />
        </Route>
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

const App = () => (
  <AuthProvider>
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  </AuthProvider>
);

export default App;
