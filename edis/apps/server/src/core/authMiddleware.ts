import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from './env';

export type AuthenticatedUser = {
  id: number;
  username: string;
  role: 'admin' | 'standard';
};

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthenticatedUser;
  }
}

const buildError = (status: number, code: string, message: string) => ({
  code,
  message,
  source: 'auth',
  status
});

const parseToken = (token: string | undefined): AuthenticatedUser | null => {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, env.AUTH_JWT_SECRET) as jwt.JwtPayload;
    if (!payload || typeof payload !== 'object') return null;
    const { sub, username, role } = payload;
    if (typeof sub !== 'string' && typeof sub !== 'number') return null;
    if (typeof username !== 'string' || (role !== 'admin' && role !== 'standard')) return null;
    return { id: Number(sub), username, role };
  } catch {
    return null;
  }
};

export const requireAuth: RequestHandler = (req, res, next) => {
  const sessionToken = req.cookies?.edis_session as string | undefined;
  const authHeader = req.header('Authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;
  const user = parseToken(sessionToken ?? bearerToken);
  if (!user) {
    res.status(401).json(buildError(401, 'AUTH_UNAUTHENTICATED', 'Not authenticated'));
    return;
  }
  req.user = user;
  next();
};

export const requireAdmin: RequestHandler = (req, res, next) => {
  const adminToken = req.header('Authorization')?.replace('Bearer ', '').trim();
  if (adminToken === env.ADMIN_TOKEN) {
    req.user ??= { id: -1, username: 'admin-token', role: 'admin' };
    next();
    return;
  }
  requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      res.status(403).json(buildError(403, 'AUTH_FORBIDDEN', 'Admin privileges required'));
      return;
    }
    next();
  });
};

export const parseUserFromRequest = (req: { cookies?: Record<string, string | undefined>; header: (name: string) => string | undefined }):
  | AuthenticatedUser
  | null => {
  const sessionToken = req.cookies?.edis_session as string | undefined;
  const authHeader = req.header('Authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;
  return parseToken(sessionToken ?? bearerToken);
};
