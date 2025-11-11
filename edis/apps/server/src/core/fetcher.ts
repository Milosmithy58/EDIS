const DEFAULT_TIMEOUT = 8_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_USER_AGENT =
  'EDIS CrimeNewsBot/1.0 (+https://github.com/cascade-energy/edis; contact: edis@localhost)';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const shouldRetry = (response: Response) => response.status >= 500 && response.status < 600;

const mergeHeaders = (existing: HeadersInit | undefined): HeadersInit => {
  const headers = new Headers(existing);
  if (!headers.has('user-agent')) {
    headers.set('user-agent', DEFAULT_USER_AGENT);
  }
  return headers;
};

export const safeFetch = async (input: string | URL, init: RequestInit = {}, attempt = 0): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
  try {
    const signal = init.signal
      ? new AbortController()
      : controller;

    const finalSignal = init.signal
      ? (() => {
          const ac = signal as AbortController;
          const forwardAbort = () => ac.abort();
          init.signal?.addEventListener('abort', forwardAbort, { once: true });
          controller.signal.addEventListener('abort', forwardAbort, { once: true });
          return ac.signal;
        })()
      : controller.signal;

    const response = await fetch(input, {
      ...init,
      signal: finalSignal,
      headers: mergeHeaders(init.headers)
    });

    if (!response.ok && shouldRetry(response) && attempt < DEFAULT_RETRIES) {
      const delay = (attempt + 1) * 250;
      await sleep(delay);
      return safeFetch(input, init, attempt + 1);
    }

    return response;
  } catch (error) {
    if (attempt < DEFAULT_RETRIES) {
      const delay = (attempt + 1) * 250;
      await sleep(delay);
      return safeFetch(input, init, attempt + 1);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

export const fetchJson = async <T>(input: string | URL, init?: RequestInit): Promise<T> => {
  const response = await safeFetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers
    }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request failed: ${response.status} ${text}`);
  }
  return response.json() as Promise<T>;
};

export const fetchText = async (input: string | URL, init?: RequestInit): Promise<string> => {
  const response = await safeFetch(input, init);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request failed: ${response.status} ${text}`);
  }
  return response.text();
};

export const toQueryString = (params: Record<string, string | number | undefined | null>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  return search.toString();
};
