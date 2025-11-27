export type AuthUser = { username: string; role: 'admin' | 'standard' };

export type AuthError = Error & { code?: string; status?: number };

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (response.ok) {
    if (response.status === 204) {
      return {} as T;
    }
    return (await response.json()) as T;
  }
  const payload = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
  const error = new Error(payload.message ?? 'Request failed') as AuthError;
  error.code = payload.code;
  error.status = response.status;
  throw error;
};

export const login = async (username: string, password: string): Promise<AuthUser> => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password })
  });
  return handleResponse<AuthUser>(response);
};

export const logout = async (): Promise<void> => {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include'
  });
  await handleResponse(response);
};

export const fetchCurrentUser = async (): Promise<AuthUser | null> => {
  const response = await fetch('/api/auth/me', { credentials: 'include' });
  if (response.status === 401) {
    return null;
  }
  return handleResponse<AuthUser>(response);
};
