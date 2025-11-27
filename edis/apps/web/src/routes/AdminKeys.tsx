import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

const PROVIDER_LABELS = {
  visualcrossing: 'Visual Crossing',
  newsapi: 'NewsAPI',
  gnews: 'GNews'
} as const;

type Provider = keyof typeof PROVIDER_LABELS;

type Status = {
  tone: 'idle' | 'success' | 'error' | 'info';
  message: string;
};

type TestDetails = {
  status: string;
  providerLatencyMs?: number;
  httpStatus?: number;
  message?: string;
};

const AdminKeys = () => {
  const [providers, setProviders] = useState<Provider[]>(['visualcrossing', 'newsapi', 'gnews']);
  const [selectedProvider, setSelectedProvider] = useState<Provider>('visualcrossing');
  const [secret, setSecret] = useState('');
  const [status, setStatus] = useState<Status>({ tone: 'idle', message: '' });
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const secretInputRef = useRef<HTMLInputElement | null>(null);
  const statusRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchProviders = async () => {
      setLoadingProviders(true);
      try {
        const response = await fetch('/api/admin/providers', { credentials: 'include' });
        if (!response.ok) {
          throw new Error('Failed to load providers');
        }
        const payload = (await response.json()) as { providers?: Provider[] };
        if (isMounted && Array.isArray(payload.providers) && payload.providers.length > 0) {
          setProviders(payload.providers);
          setSelectedProvider(payload.providers[0]!);
        }
      } catch (error) {
        if (isMounted) {
          console.error('Unable to load providers', error);
          setStatus({ tone: 'error', message: 'Unable to load providers. Try again later.' });
        }
      } finally {
        if (isMounted) {
          setLoadingProviders(false);
        }
      }
    };
    void fetchProviders();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (status.tone !== 'idle' && status.message && statusRef.current) {
      statusRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [status]);

  const providerOptions = useMemo(() => providers.map((provider) => ({
    value: provider,
    label: PROVIDER_LABELS[provider]
  })), [providers]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = secret.trim();
    if (!trimmed) {
      setStatus({ tone: 'error', message: 'Enter an API key before saving.' });
      return;
    }
    setSaving(true);
    setStatus({ tone: 'info', message: 'Saving key…' });
    try {
      const response = await fetch('/api/admin/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ provider: selectedProvider, secret: trimmed })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = typeof payload.message === 'string' ? payload.message : 'Failed to save API key.';
        setStatus({ tone: 'error', message });
        return;
      }
      setSecret('');
      setStatus({ tone: 'success', message: 'API key saved. The input has been cleared.' });
      if (secretInputRef.current) {
        secretInputRef.current.focus();
      }
    } catch (error) {
      console.error('Unable to save key', error);
      setStatus({ tone: 'error', message: 'Unexpected error while saving the key.' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    const trimmed = secret.trim();
    if (!trimmed) {
      setStatus({ tone: 'error', message: 'Enter an API key before testing.' });
      return;
    }
    setTesting(true);
    setStatus({ tone: 'info', message: 'Testing key…' });
    try {
      const response = await fetch('/api/admin/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ provider: selectedProvider })
      });
      if (!response.ok) {
        throw new Error('Test failed');
      }
      const payload = (await response.json()) as { ok: boolean; details?: TestDetails };
      if (payload.ok) {
        setStatus({ tone: 'success', message: 'Provider responded successfully.' });
      } else {
        setStatus({ tone: 'error', message: payload.details?.message ?? 'Provider test failed.' });
      }
    } catch (error) {
      console.error('Test failed', error);
      setStatus({ tone: 'error', message: 'Test failed. Try again later.' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Admin</p>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Provider API keys</h1>
          </div>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-200 focus:ring-offset-2 focus:ring-offset-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:focus:ring-offset-slate-900"
          >
            ← Back to dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1">
              <label htmlFor="provider" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Provider
              </label>
              <select
                id="provider"
                value={selectedProvider}
                onChange={(event) => setSelectedProvider(event.target.value as Provider)}
                disabled={loadingProviders}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {providerOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label htmlFor="secret" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                API key
              </label>
              <input
                ref={secretInputRef}
                id="secret"
                type="password"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                autoComplete="off"
              />
            </div>
            <div className="flex gap-3 md:w-48 md:flex-col">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex flex-1 items-center justify-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-70 dark:focus:ring-offset-slate-900"
              >
                {saving ? 'Saving…' : 'Save key'}
              </button>
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || !secret.trim()}
                className="inline-flex flex-1 items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus:ring-offset-slate-900"
              >
                {testing ? 'Testing…' : 'Test key'}
              </button>
            </div>
          </div>
          {status.message && (
            <p
              ref={statusRef}
              className={`mt-4 text-sm ${
                status.tone === 'error'
                  ? 'text-red-600 dark:text-red-300'
                  : status.tone === 'success'
                    ? 'text-green-600 dark:text-green-300'
                    : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {status.message}
            </p>
          )}
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            Keys are stored securely on the server. Cookies are used for authentication; ensure you are signed in as an admin.
          </p>
        </form>
      </main>
    </div>
  );
};

export default AdminKeys;
