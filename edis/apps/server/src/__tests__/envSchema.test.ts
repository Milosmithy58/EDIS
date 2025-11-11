import { describe, expect, it } from 'vitest';
import { EnvSchema } from '../core/env';

describe('EnvSchema', () => {
  const baseEnv = {
    ADMIN_TOKEN: 'abcdefghijkl',
    SECRETBOX_KEY: 'YWJjZGVmZ2hpamtsbW5vcA==',
    WEBZIO_TOKEN: 'token-123'
  };

  it('defaults NEWS_PROVIDER to webzio', () => {
    const result = EnvSchema.parse({ ...baseEnv });

    expect(result.NEWS_PROVIDER).toBe('webzio');
  });

  it('requires WEBZIO_TOKEN when using the webzio provider', () => {
    const parsed = EnvSchema.safeParse({
      ADMIN_TOKEN: 'abcdefghijkl',
      SECRETBOX_KEY: 'YWJjZGVmZ2hpamtsbW5vcA=='
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['WEBZIO_TOKEN'],
            message: 'WEBZIO_TOKEN is required when NEWS_PROVIDER=webzio.'
          })
        ])
      );
    }
  });
});
