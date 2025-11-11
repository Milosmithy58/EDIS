import { promises as fs } from 'fs';
import { dirname, resolve } from 'path';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { env } from '../env';
import type { ProviderKeys, ProviderName } from './types';

const ALGORITHM = 'aes-256-gcm';
const AUTH_TAG_LENGTH = 16;

let cachedKeys: ProviderKeys | null = null;
let hasLoaded = false;

const getStorePath = () => resolve(process.cwd(), env.KEYS_STORE_PATH);

const decodeSecretboxKey = (): Buffer => {
  const key = Buffer.from(env.SECRETBOX_KEY, 'base64');
  if (key.length !== 32) {
    throw new Error('SECRETBOX_KEY must decode to 32 bytes for AES-256-GCM encryption.');
  }
  return key;
};

const ensureStoreDirectory = async () => {
  const dir = dirname(getStorePath());
  await fs.mkdir(dir, { recursive: true });
};

const encrypt = (payload: ProviderKeys): string => {
  const key = decodeSecretboxKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const plaintext = JSON.stringify(payload);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const envelope = {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ct: ciphertext.toString('base64')
  };
  return JSON.stringify(envelope);
};

const decrypt = (raw: string): ProviderKeys => {
  const key = decodeSecretboxKey();
  const envelope = JSON.parse(raw) as { iv: string; tag: string; ct: string };
  if (!envelope?.iv || !envelope?.tag || !envelope?.ct) {
    throw new Error('Secrets store payload is malformed.');
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(envelope.iv, 'base64'), {
    authTagLength: AUTH_TAG_LENGTH
  });
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(envelope.ct, 'base64')),
    decipher.final()
  ]).toString('utf8');
  const parsed = JSON.parse(decrypted) as ProviderKeys;
  return parsed ?? {};
};

const writeFile = async (payload: ProviderKeys) => {
  await ensureStoreDirectory();
  const encrypted = encrypt(payload);
  await fs.writeFile(getStorePath(), encrypted, { encoding: 'utf8', mode: 0o600 });
};

const seedFromEnv = (): ProviderKeys => {
  const seeds: ProviderKeys = {};
  if (env.VISUALCROSSING_API_KEY) {
    seeds.visualcrossing = env.VISUALCROSSING_API_KEY;
  }
  if (env.NEWSAPI_API_KEY) {
    seeds.newsapi = env.NEWSAPI_API_KEY;
  }
  if (env.GNEWS_API_KEY) {
    seeds.gnews = env.GNEWS_API_KEY;
  }
  return seeds;
};

export const loadKeys = async (): Promise<ProviderKeys> => {
  if (hasLoaded && cachedKeys) {
    return { ...cachedKeys };
  }
  try {
    const raw = await fs.readFile(getStorePath(), 'utf8');
    const keys = decrypt(raw);
    cachedKeys = keys;
    hasLoaded = true;
    return { ...keys };
  } catch (error: unknown) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError?.code === 'ENOENT') {
      const seeds = seedFromEnv();
      await writeFile(seeds);
      cachedKeys = seeds;
      hasLoaded = true;
      return { ...seeds };
    }
    const isCryptoFailure =
      error instanceof SyntaxError ||
      (nodeError?.code === 'ERR_OSSL_EVP_BAD_DECRYPT' ||
        (error instanceof Error && /authenticate data/i.test(error.message)));
    if (isCryptoFailure) {
      throw new Error('Failed to decrypt secrets store. Check SECRETBOX_KEY and key store integrity.');
    }
    throw error;
  }
};

export const saveKeys = async (keys: ProviderKeys): Promise<void> => {
  await writeFile(keys);
  cachedKeys = { ...keys };
  hasLoaded = true;
};

export const getKey = async (provider: ProviderName): Promise<string | undefined> => {
  const keys = await loadKeys();
  return keys[provider];
};

export const setKey = async (provider: ProviderName, secret: string): Promise<void> => {
  const trimmed = secret.trim();
  if (!trimmed) {
    throw new Error('Secret must be a non-empty string.');
  }
  const keys = await loadKeys();
  const next: ProviderKeys = { ...keys, [provider]: trimmed };
  await saveKeys(next);
};
