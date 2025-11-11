import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useAdminAuth } from '../lib/adminAuth';
import { NavLink, useNavigation } from '../lib/navigation';

type Provider = 'visualcrossing' | 'newsapi' | 'gnews';

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

const PROVIDER_LABELS: Record<Provider, string> = {
  visualcrossing: 'Visual Crossing',
  newsapi: 'NewsAPI',
  gnews: 'GNews'
};

const AdminKeys = () => {
  const { token } = useAdminAuth();
  const { navigate } = useNavigation();
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
    if (!token) {
      navigate('/admin-login');
    }
  }, [token, navigate]);

  useEffect(() => {
    if (!token) {
      return;
    }
    let isMounted = true;
    const fetchProviders = async () => {
      setLoadingProviders(true);
      try {
        const response = await fetch('/api/admin/providers', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (!response.ok) {
          if (response.status === 401) {
            setStatus({ tone: 'error', message: 'Session expired. Please log in again.' });
            setTimeout(() => navigate('/admin-login'), 200);
            return;
          }
          throw new Error('Failed to load providers');
        }
        const payload = (await response.json()) as { providers?: Provider[] };
        if (isMounted && Array.isArray(payload.providers) && payload.providers.length > 0) {
          setProviders(payload.providers);
          setSelectedProvider(payload.providers[0]!);
        }
      } catch (error) {
        if (isMounted) {
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
  }, [navigate, token]);

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
    if (!token) {
      setStatus({ tone: 'error', message: 'You must log in before saving keys.' });
      return;
    }
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
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
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
      setStatus({ tone: 'error', message: 'Unexpected error while saving the key.' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!token) {
      setStatus({ tone: 'error', message: 'You must log in before testing keys.' });
      return;
    }
    setTesting(true);
    setStatus({ tone: 'info', message: 'Testing provider key…' });
    try {
      const response = await fetch('/api/admin/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ provider: selectedProvider })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = typeof payload.message === 'string' ? payload.message : 'Connectivity check failed.';
        setStatus({ tone: 'error', message });
        return;
      }
      const payload = (await response.json()) as { ok: boolean; details?: TestDetails };
      const formatStatus = () => {
        const details = payload.details;
        if (!details) {
          return payload.ok ? 'Provider test succeeded.' : 'Provider test failed.';
        }
        const parts: string[] = [];
        const friendlyStatus = (() => {
          switch (details.status) {
            case 'ok':
              return 'Connection OK';
            case 'missing-key':
              return 'No key stored';
            case 'http-error':
              return 'Provider HTTP error';
            case 'network-error':
              return 'Network error';
            default:
              return details.status.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
          }
        })();
        parts.push(friendlyStatus);
        if (typeof details.httpStatus === 'number') {
          parts.push(`HTTP ${details.httpStatus}`);
        }
        if (typeof details.providerLatencyMs === 'number') {
          parts.push(`${Math.round(details.providerLatencyMs)} ms`);
        }
        if (details.message) {
          parts.push(details.message);
        }
        return parts.join(' · ');
      };
      setStatus({
        tone: payload.ok ? 'success' : 'error',
        message: formatStatus()
      });
    } catch (error) {
      setStatus({ tone: 'error', message: 'Unexpected error while testing the key.' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-4">
          <NavLink to="/" className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            EDIS
          </NavLink>
          <p className="text-sm text-slate-500 dark:text-slate-300">Secure API key management</p>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-10">
        <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Provider API keys</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Rotate credentials without exposing them in the client. Saved keys are encrypted at rest and never displayed after
            submission.
          </p>
          <form className="mt-6 flex flex-col gap-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="provider" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Provider
              </label>
              <select
                id="provider"
                value={selectedProvider}
                onChange={(event) => setSelectedProvider(event.target.value as Provider)}
                disabled={loadingProviders}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {providerOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="api-key" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                API key (write-only)
              </label>
              <input
                id="api-key"
                ref={secretInputRef}
                type="password"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                autoComplete="off"
                placeholder="Enter new key"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-start">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-70 dark:focus:ring-offset-slate-900"
              >
                {saving ? 'Saving…' : 'Save key'}
              </button>
              <button
                type="button"
                onClick={handleTest}
                disabled={testing}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-200 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus:ring-offset-slate-900"
              >
                {testing ? 'Testing…' : 'Test connection'}
              </button>
            </div>
          </form>
          <p
            ref={statusRef}
            role="status"
            aria-live="polite"
            className={`mt-6 rounded-lg border px-4 py-3 text-sm focus:outline-none ${
              status.tone === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-200'
                : status.tone === 'error'
                ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200'
                : status.tone === 'info'
                ? 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/60 dark:text-sky-200'
                : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-200'
            } ${status.message ? '' : 'sr-only'}`}
          >
            {status.message || 'No recent actions.'}
          </p>
        </section>
      </main>
    </div>
  );
};

export default AdminKeys;
