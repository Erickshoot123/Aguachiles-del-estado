import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es requerida'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_TTL_HOURS: z.coerce.number().int().positive().default(12),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  POS_MODE: z.enum(['local', 'central']).default('local'),
  POS_TIME_ZONE: z.string().default('America/Mazatlan').refine((zone) => {
    try { new Intl.DateTimeFormat('en', { timeZone: zone }); return true; } catch { return false; }
  }, 'POS_TIME_ZONE debe ser una zona horaria IANA válida'),
  SYNC_CENTRAL_URL: z.string().url().optional(),
  SYNC_TOKEN: z.string().min(32).optional(),
  SYNC_INTERVAL_MS: z.coerce.number().int().min(1000).max(300000).default(15000),
}).superRefine((env, ctx) => {
  if (!!env.SYNC_CENTRAL_URL !== !!env.SYNC_TOKEN) {
    ctx.addIssue({ code: 'custom', message: 'SYNC_CENTRAL_URL y SYNC_TOKEN deben configurarse juntos' });
  }
  if (env.POS_MODE === 'central' && env.SYNC_CENTRAL_URL) {
    ctx.addIssue({ code: 'custom', message: 'La central no puede enviar eventos a otra central' });
  }
  if (env.SYNC_CENTRAL_URL) {
    const url = new URL(env.SYNC_CENTRAL_URL);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((!local && url.protocol !== 'https:') || url.username || url.password || url.search || url.hash) {
      ctx.addIssue({ code: 'custom', message: 'La central requiere HTTPS (HTTP solo en loopback) y URL sin credenciales ni parámetros' });
    }
  }
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Configuración de entorno inválida: ${result.error.message}`);
  }
  return result.data;
}
