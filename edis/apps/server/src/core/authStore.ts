import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { env } from './env';

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

let db: Pool | null = null;

const getDb = (): Pool => {
  if (db) {
    return db;
  }
  db = new Pool({
    user: env.DB_USER,
    host: env.DB_HOST,
    database: env.DB_NAME,
    password: env.DB_PASSWORD,
    port: 5432,
  });
  return db;
};

const toSafeUser = (user: AuthUserRecord | undefined): SafeUser | null => {
  if (!user) return null;
  const { id, username, role, createdAt } = user;
  return { id, username, role: role as AuthRole, createdAt };
};

export const initAuthStore = async (): Promise<void> => {
  const database = getDb();
  await database.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'standard')),
      "createdAt" TIMESTAMPTZ NOT NULL
    );
  `);

  const res = await database.query('SELECT COUNT(*) as count FROM users');
  if (res.rows[0].count > 0) {
    return;
  }

  const createdAt = new Date().toISOString();
  const password_hash = await bcrypt.hash('admin', TEN_SALT_ROUNDS);
  await database.query(
    'INSERT INTO users (username, password_hash, role, "createdAt") VALUES ($1, $2, $3, $4)',
    ['admin', password_hash, 'admin', createdAt]
  );
  console.info('Seeded default admin user: admin / admin');
};

export const findUserByUsername = async (username: string): Promise<AuthUserRecord | null> => {
  const database = getDb();
  const normalized = username.trim().toLowerCase();
  const res = await database.query<AuthUserRecord>(
    'SELECT id, username, password_hash, role, "createdAt" FROM users WHERE username = $1',
    [normalized]
  );
  return res.rows[0] ?? null;
};

export const findUserById = async (id: number): Promise<AuthUserRecord | null> => {
  const database = getDb();
  const res = await database.query<AuthUserRecord>(
    'SELECT id, username, password_hash, role, "createdAt" FROM users WHERE id = $1',
    [id]
  );
  return res.rows[0] ?? null;
};

export const listUsers = async (): Promise<SafeUser[]> => {
  const database = getDb();
  const res = await database.query<SafeUser>(
    'SELECT id, username, role, "createdAt" FROM users ORDER BY "createdAt" DESC, username ASC'
  );
  return res.rows.map((user) => ({ ...user, role: user.role as AuthRole }));
};

export const createUser = async (input: {
  username: string;
  password: string;
  role: AuthRole;
}): Promise<SafeUser> => {
  const database = getDb();
  const username = input.username.trim().toLowerCase();
  
  const existing = await findUserByUsername(username);
  if (existing) {
    throw new Error('USERNAME_TAKEN');
  }

  const password_hash = await bcrypt.hash(input.password, TEN_SALT_ROUNDS);
  const createdAt = new Date().toISOString();
  
  const res = await database.query<SafeUser>(
    'INSERT INTO users (username, password_hash, role, "createdAt") VALUES ($1, $2, $3, $4) RETURNING id, username, role, "createdAt"',
    [username, password_hash, input.role, createdAt]
  );
  
  return res.rows[0];
};

export const updateUser = async (
  id: number,
  updates: { role?: AuthRole; password?: string }
): Promise<SafeUser | null> => {
  const database = getDb();
  const existing = await findUserById(id);
  if (!existing) return null;

  const nextRole = updates.role ?? existing.role;
  let nextPasswordHash = existing.password_hash;
  if (updates.password) {
    nextPasswordHash = await bcrypt.hash(updates.password, TEN_SALT_ROUNDS);
  }

  const res = await database.query<AuthUserRecord>(
    'UPDATE users SET role = $1, password_hash = $2 WHERE id = $3 RETURNING *',
    [nextRole, nextPasswordHash, id]
  );

  return toSafeUser(res.rows[0]);
};

export const deleteUser = async (id: number): Promise<boolean> => {
  const database = getDb();
  const existing = await findUserById(id);
  if (!existing) return false;

  if (existing.role === 'admin') {
    const res = await database.query("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
    if (res.rows[0].count <= 1) {
      throw new Error('LAST_ADMIN');
    }
  }

  const res = await database.query('DELETE FROM users WHERE id = $1', [id]);
  return (res.rowCount ?? 0) > 0;
};

export const verifyPassword = async (user: AuthUserRecord, password: string): Promise<boolean> => {
  return bcrypt.compare(password, user.password_hash);
};