import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

const validEnv = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_SECRET: 'a'.repeat(32),
};

describe('loadEnv', () => {
  it('aplica valores por defecto cuando no se especifican', () => {
    const env = loadEnv(validEnv);

    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe('development');
    expect(env.CORS_ORIGIN).toBe('http://localhost:5173');
  });

  it('lanza un error si falta DATABASE_URL', () => {
    expect(() => loadEnv({ JWT_SECRET: 'a'.repeat(32) })).toThrow();
  });

  it('lanza un error si JWT_SECRET es demasiado corto', () => {
    expect(() =>
      loadEnv({ DATABASE_URL: validEnv.DATABASE_URL, JWT_SECRET: 'short' }),
    ).toThrow();
  });
});
