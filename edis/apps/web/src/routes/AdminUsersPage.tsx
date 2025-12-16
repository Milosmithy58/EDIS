import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

export type AdminUser = { id: number; username: string; role: 'admin' | 'standard'; createdAt: string };

const fetchUsers = async (): Promise<AdminUser[]> => {
  const response = await fetch('/api/admin/users', { credentials: 'include', cache: 'no-store' });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message ?? 'Failed to load users');
  }
  const payload = (await response.json()) as { users: AdminUser[] };
  return payload.users;
};

const createUser = async (input: { username: string; password: string; role: 'admin' | 'standard' }): Promise<AdminUser> => {
  const response = await fetch('/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input)
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message ?? 'Unable to create user');
  }
  return (await response.json()) as AdminUser;
};

const updateUser = async (id: number, updates: { role?: 'admin' | 'standard'; password?: string }): Promise<AdminUser> => {
  const response = await fetch(`/api/admin/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(updates)
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message ?? 'Unable to update user');
  }
  return (await response.json()) as AdminUser;
};

const deleteUser = async (id: number) => {
  const response = await fetch(`/api/admin/users/${id}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  if (!response.ok && response.status !== 204) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message ?? 'Unable to delete user');
  }
};

const AdminUsersPage = () => {
  const [formState, setFormState] = useState({ username: '', password: '', role: 'standard' as 'admin' | 'standard' });
  const [resetPassword, setResetPassword] = useState<Record<number, string>>({});
  const queryClient = useQueryClient();

  const usersQuery = useQuery({ queryKey: ['admin-users'], queryFn: fetchUsers });

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      setFormState({ username: '', password: '', role: 'standard' });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User created');
    },
    onError: (error) => toast.error((error as Error).message)
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: { role?: 'admin' | 'standard'; password?: string } }) =>
      updateUser(id, updates),
    onSuccess: () => {
      setResetPassword({});
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User updated');
    },
    onError: (error) => toast.error((error as Error).message)
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User removed');
    },
    onError: (error) => toast.error((error as Error).message)
  });

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const username = formState.username.trim();
    const password = formState.password.trim();
    if (!username || !password) {
      toast.error('Username and password are required');
      return;
    }
    createMutation.mutate({ username, password, role: formState.role });
  };

  const handleRoleChange = (id: number, role: 'admin' | 'standard') => {
    updateMutation.mutate({ id, updates: { role } });
  };

  const handleResetPassword = (id: number) => {
    const nextPassword = resetPassword[id]?.trim();
    if (!nextPassword) {
      toast.error('Enter a new password');
      return;
    }
    updateMutation.mutate({ id, updates: { password: nextPassword } });
  };

  const handleDelete = (id: number) => {
    if (!confirm('Delete this user?')) return;
    deleteMutation.mutate(id);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">User management</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Admins can add, update, or remove users for the local EDIS instance.
        </p>
        <form className="mt-4 grid gap-4 md:grid-cols-4" onSubmit={handleCreate}>
          <div className="md:col-span-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Username</label>
            <input
              value={formState.username}
              onChange={(event) => setFormState((prev) => ({ ...prev, username: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="md:col-span-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Password</label>
            <input
              type="password"
              value={formState.password}
              onChange={(event) => setFormState((prev) => ({ ...prev, password: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="md:col-span-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Role</label>
            <select
              value={formState.role}
              onChange={(event) => setFormState((prev) => ({ ...prev, role: event.target.value as 'admin' | 'standard' }))}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="standard">Standard</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex items-end md:col-span-1">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="inline-flex w-full items-center justify-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-70 dark:focus:ring-offset-slate-900"
            >
              {createMutation.isPending ? 'Adding…' : 'Add user'}
            </button>
          </div>
        </form>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Username</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Role</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Created</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {usersQuery.isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500 dark:text-slate-300">
                  Loading users…
                </td>
              </tr>
            ) : usersQuery.data?.length ? (
              usersQuery.data.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{user.username}</td>
                  <td className="px-4 py-3">
                    <select
                      value={user.role}
                      onChange={(event) => handleRoleChange(user.id, event.target.value as 'admin' | 'standard')}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      <option value="standard">Standard</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {new Date(user.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 space-y-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        type="password"
                        placeholder="New password"
                        value={resetPassword[user.id] ?? ''}
                        onChange={(event) =>
                          setResetPassword((prev) => ({
                            ...prev,
                            [user.id]: event.target.value
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => handleResetPassword(user.id)}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus:ring-offset-slate-900"
                      >
                        Reset password
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(user.id)}
                      className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-200 focus:ring-offset-2 dark:bg-red-900/30 dark:text-red-200 dark:hover:bg-red-900/50 dark:focus:ring-offset-slate-900"
                    >
                      Delete user
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500 dark:text-slate-300">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminUsersPage;
