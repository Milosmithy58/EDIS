import { Router } from 'express';
import jwt from 'jsonwebtoken';
import {
  createUser,
  deleteUser,
  findUserByUsername,
  listUsers,
  updateUser,
  verifyPassword
} from '../core/authStore';
import { env } from '../core/env';
import { parseUserFromRequest, requireAdmin } from '../core/authMiddleware';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const authRouter = Router();

const buildError = (status: number, code: string, message: string) => ({
  code,
  message,
  source: 'auth',
  status
});

const signSession = (payload: { sub: number; username: string; role: 'admin' | 'standard' }) =>
  jwt.sign(payload, env.AUTH_JWT_SECRET, { expiresIn: '1d' });

authRouter.post('/auth/login', async (req, res) => {
  const { username, password } = (req.body ?? {}) as { username?: string; password?: string };
  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password.trim()) {
    res.status(401).json(buildError(401, 'AUTH_INVALID_CREDENTIALS', 'Invalid username or password'));
    return;
  }
  const user = findUserByUsername(username);
  if (!user) {
    res.status(401).json(buildError(401, 'AUTH_INVALID_CREDENTIALS', 'Invalid username or password'));
    return;
  }
  const valid = await verifyPassword(user, password);
  if (!valid) {
    res.status(401).json(buildError(401, 'AUTH_INVALID_CREDENTIALS', 'Invalid username or password'));
    return;
  }
  const token = signSession({ sub: user.id, username: user.username, role: user.role });
  res.cookie('edis_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: ONE_DAY_MS
  });
  res.json({ username: user.username, role: user.role });
});

authRouter.post('/auth/logout', (_req, res) => {
  res.cookie('edis_session', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 0
  });
  res.json({ message: 'Logged out' });
});

authRouter.get('/auth/me', (req, res) => {
  const user = parseUserFromRequest(req);
  if (!user) {
    res.status(401).json(buildError(401, 'AUTH_UNAUTHENTICATED', 'Not authenticated'));
    return;
  }
  res.json({ username: user.username, role: user.role });
});

authRouter.get('/admin/users', requireAdmin, (_req, res) => {
  const users = listUsers();
  res.json({ users });
});

authRouter.post('/admin/users', requireAdmin, async (req, res) => {
  const { username, password, role } = (req.body ?? {}) as {
    username?: string;
    password?: string;
    role?: 'admin' | 'standard';
  };
  if (!username || typeof username !== 'string' || !username.trim()) {
    res.status(400).json(buildError(400, 'AUTH_INVALID_INPUT', 'Username is required'));
    return;
  }
  if (!password || typeof password !== 'string' || !password.trim()) {
    res.status(400).json(buildError(400, 'AUTH_INVALID_INPUT', 'Password is required'));
    return;
  }
  if (role !== 'admin' && role !== 'standard') {
    res.status(400).json(buildError(400, 'AUTH_INVALID_INPUT', 'Role must be admin or standard'));
    return;
  }
  try {
    const user = await createUser({ username, password, role });
    res.status(201).json(user);
  } catch (error) {
    if (error instanceof Error && error.message === 'USERNAME_TAKEN') {
      res.status(400).json(buildError(400, 'AUTH_USERNAME_TAKEN', 'Username already exists'));
      return;
    }
    res.status(500).json(buildError(500, 'AUTH_CREATE_FAILED', 'Unable to create user'));
  }
});

authRouter.patch('/admin/users/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { role, password } = (req.body ?? {}) as { role?: 'admin' | 'standard'; password?: string };
  if (!role && !password) {
    res.status(400).json(buildError(400, 'AUTH_INVALID_INPUT', 'No updates provided'));
    return;
  }
  if (role && role !== 'admin' && role !== 'standard') {
    res.status(400).json(buildError(400, 'AUTH_INVALID_INPUT', 'Invalid role'));
    return;
  }
  try {
    const updated = await updateUser(Number(id), { role, password });
    if (!updated) {
      res.status(404).json(buildError(404, 'AUTH_USER_NOT_FOUND', 'User not found'));
      return;
    }
    res.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === 'LAST_ADMIN') {
      res.status(400).json(buildError(400, 'AUTH_LAST_ADMIN', 'Cannot remove the last remaining admin'));
      return;
    }
    res.status(500).json(buildError(500, 'AUTH_UPDATE_FAILED', 'Unable to update user'));
  }
});

authRouter.delete('/admin/users/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  try {
    const removed = deleteUser(Number(id));
    if (!removed) {
      res.status(404).json(buildError(404, 'AUTH_USER_NOT_FOUND', 'User not found'));
      return;
    }
    res.status(204).send();
  } catch (error) {
    if (error instanceof Error && error.message === 'LAST_ADMIN') {
      res.status(400).json(buildError(400, 'AUTH_LAST_ADMIN', 'Cannot remove the last remaining admin'));
      return;
    }
    res.status(500).json(buildError(500, 'AUTH_DELETE_FAILED', 'Unable to delete user'));
  }
});

export default authRouter;
