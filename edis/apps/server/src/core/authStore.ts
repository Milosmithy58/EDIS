import { mkdirSync } from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

export type AuthRole = 'admin' | 'standard';

export type AuthUserRecord = {
  id: number;
  username: string;
  password_hash: string;
  role: AuthRole;
  createdAt: string;
};

export type SafeUser = Pick<AuthUserRecord, 'id' | 'username' | 'role' | 'createdAt'>;

const TEN_SALT_ROUNDS = 10;
const DB_PATH = path.resolve(process.cwd(), 'data/auth.db');

let db: Database.Database | null = null;

const ensureDb = (): Database.Database => {
  if (db) {
    return db;
  }
  mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'standard')),
      createdAt TEXT NOT NULL
    );
  `);
  return db;
};

const toSafeUser = (user: AuthUserRecord | undefined): SafeUser | null => {
  if (!user) return null;
  const { id, username, role, createdAt } = user;
  return { id, username, role: role as AuthRole, createdAt };
};

export const initAuthStore = async (): Promise<void> => {
  const database = ensureDb();
  const countRow = database.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (countRow.count > 0) {
    return;
  }
  const createdAt = new Date().toISOString();
  const password_hash = await bcrypt.hash('admin', TEN_SALT_ROUNDS);
  database
    .prepare('INSERT INTO users (username, password_hash, role, createdAt) VALUES (@username, @password_hash, @role, @createdAt)')
    .run({ username: 'admin', password_hash, role: 'admin', createdAt });
  console.info('Seeded default admin user for local dev: admin / admin');
};

export const findUserByUsername = (username: string): AuthUserRecord | null => {
  const database = ensureDb();
  const normalized = username.trim().toLowerCase();
  const row = database
    .prepare('SELECT id, username, password_hash, role, createdAt FROM users WHERE username = ?')
    .get(normalized) as AuthUserRecord | undefined;
  return row ?? null;
};

export const findUserById = (id: number): AuthUserRecord | null => {
  const database = ensureDb();
  const row = database
    .prepare('SELECT id, username, password_hash, role, createdAt FROM users WHERE id = ?')
    .get(id) as AuthUserRecord | undefined;
  return row ?? null;
};

export const listUsers = (): SafeUser[] => {
  const database = ensureDb();
  const rows = database
    .prepare('SELECT id, username, role, createdAt FROM users ORDER BY createdAt DESC, username ASC')
    .all() as SafeUser[];
  return rows.map((user) => ({ ...user, role: user.role as AuthRole }));
};

export const createUser = async (input: {
  username: string;
  password: string;
  role: AuthRole;
}): Promise<SafeUser> => {
  const database = ensureDb();
  const username = input.username.trim().toLowerCase();
  const existing = database.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: number } | undefined;
  if (existing) {
    throw new Error('USERNAME_TAKEN');
  }
  const password_hash = await bcrypt.hash(input.password, TEN_SALT_ROUNDS);
  const createdAt = new Date().toISOString();
  const result = database
    .prepare('INSERT INTO users (username, password_hash, role, createdAt) VALUES (@username, @password_hash, @role, @createdAt)')
    .run({ username, password_hash, role: input.role, createdAt });
  return { id: Number(result.lastInsertRowid), username, role: input.role, createdAt };
};

export const updateUser = async (
  id: number,
  updates: { role?: AuthRole; password?: string }
): Promise<SafeUser | null> => {
  const database = ensureDb();
  const existing = findUserById(id);
  if (!existing) return null;
  const nextRole = updates.role ?? existing.role;
  let nextPasswordHash = existing.password_hash;
  if (updates.password) {
    nextPasswordHash = await bcrypt.hash(updates.password, TEN_SALT_ROUNDS);
  }
  database
    .prepare('UPDATE users SET role = @role, password_hash = @password_hash WHERE id = @id')
    .run({ id, role: nextRole, password_hash: nextPasswordHash });
  return toSafeUser({ ...existing, role: nextRole, password_hash: nextPasswordHash });
};

export const deleteUser = (id: number): boolean => {
  const database = ensureDb();
  const existing = findUserById(id);
  if (!existing) return false;
  if (existing.role === 'admin') {
    const adminCount = database
      .prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'")
      .get() as { count: number };
    if (adminCount.count <= 1) {
      const error = new Error('LAST_ADMIN');
      throw error;
    }
  }
  const result = database.prepare('DELETE FROM users WHERE id = ?').run(id);
  return result.changes > 0;
};

export const verifyPassword = async (user: AuthUserRecord, password: string): Promise<boolean> => {
  return bcrypt.compare(password, user.password_hash);
};
