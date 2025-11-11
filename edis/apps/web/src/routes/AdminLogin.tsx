import { FormEvent, useState } from 'react';
import { useAdminAuth } from '../lib/adminAuth';
import { NavLink, useNavigation } from '../lib/navigation';

const AdminLogin = () => {
  const { setToken } = useAdminAuth();
  const { navigate } = useNavigation();
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) {
      setError('Admin token is required.');
      return;
    }
    setToken(trimmed);
    setInput('');
    setError(null);
    navigate('/admin-keys');
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-4">
          <NavLink to="/" className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            EDIS
          </NavLink>
          <p className="text-sm text-slate-500 dark:text-slate-300">Admin access</p>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-12">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Administrator login</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Enter the shared admin token to manage provider API keys securely.
          </p>
          <label htmlFor="admin-token" className="mt-6 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Admin token
          </label>
          <input
            id="admin-token"
            type="password"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            autoComplete="off"
            aria-describedby={error ? 'admin-token-error' : undefined}
          />
          {error && (
            <p id="admin-token-error" className="mt-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900"
          >
            Continue
          </button>
        </form>
      </main>
    </div>
  );
};

export default AdminLogin;
