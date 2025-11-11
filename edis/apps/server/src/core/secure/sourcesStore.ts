import { promises as fs } from 'fs';
import { dirname, resolve } from 'path';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { env } from '../env';

export type ScrapeSources = {
  domains: string[];
  blocked?: string[];
  updatedAt: string;
  updatedBy: string;
};

const ALGORITHM = 'aes-256-gcm';
const AUTH_TAG_LENGTH = 16;

const getStorePath = () => resolve(process.cwd(), env.SCRAPE_SOURCES_PATH);

const ensureDirectory = async () => {
  await fs.mkdir(dirname(getStorePath()), { recursive: true });
};

const decodeKey = (): Buffer => {
  const key = Buffer.from(env.SECRETBOX_KEY, 'base64');
  if (key.length !== 32) {
    throw new Error('SECRETBOX_KEY must decode to 32 bytes for AES-256-GCM encryption.');
  }
  return key;
};

const encrypt = (payload: ScrapeSources): string => {
  const key = decodeKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const plaintext = JSON.stringify(payload);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({ iv: iv.toString('base64'), tag: tag.toString('base64'), ct: ciphertext.toString('base64') });
};

const decrypt = (raw: string): ScrapeSources => {
  const key = decodeKey();
  const envelope = JSON.parse(raw) as { iv: string; tag: string; ct: string };
  if (!envelope?.iv || !envelope?.tag || !envelope?.ct) {
    throw new Error('Scrape sources store payload is malformed.');
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(envelope.iv, 'base64'), {
    authTagLength: AUTH_TAG_LENGTH
  });
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(envelope.ct, 'base64')),
    decipher.final()
  ]).toString('utf8');
  return JSON.parse(decrypted) as ScrapeSources;
};

const defaultSources = (): ScrapeSources => ({
  domains: [],
  blocked: [],
  updatedAt: new Date(0).toISOString(),
  updatedBy: 'system'
});

export const loadSources = async (): Promise<ScrapeSources> => {
  try {
    const raw = await fs.readFile(getStorePath(), 'utf8');
    const payload = decrypt(raw);
    return {
      domains: payload.domains ?? [],
      blocked: payload.blocked ?? [],
      updatedAt: payload.updatedAt ?? new Date(0).toISOString(),
      updatedBy: payload.updatedBy ?? 'unknown'
    };
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError?.code === 'ENOENT') {
      const fallback = defaultSources();
      await saveSources(fallback);
      return fallback;
    }
    const isCryptoFailure =
      error instanceof SyntaxError ||
      nodeError?.code === 'ERR_OSSL_EVP_BAD_DECRYPT' ||
      (error instanceof Error && /authenticate data/i.test(error.message));
    if (isCryptoFailure) {
      throw new Error('Failed to decrypt scrape sources store. Check SECRETBOX_KEY and store integrity.');
    }
    throw error;
  }
};

export const saveSources = async (payload: ScrapeSources): Promise<void> => {
  await ensureDirectory();
  const serialized = encrypt(payload);
  await fs.writeFile(getStorePath(), serialized, { encoding: 'utf8', mode: 0o600 });
};

export const updateSources = async (domains: string[], blocked: string[] | undefined, actor: string) => {
  const unique = Array.from(new Set(domains.map((domain) => domain.trim().toLowerCase()).filter(Boolean)));
  const uniqueBlocked = blocked
    ? Array.from(new Set(blocked.map((domain) => domain.trim().toLowerCase()).filter(Boolean)))
    : undefined;
  const payload: ScrapeSources = {
    domains: unique,
    blocked: uniqueBlocked,
    updatedAt: new Date().toISOString(),
    updatedBy: actor
  };
  await saveSources(payload);
  return payload;
};
