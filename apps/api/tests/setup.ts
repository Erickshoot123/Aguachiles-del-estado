// Se ejecuta antes de cada archivo de prueba (vitest `setupFiles`), antes de
// que nada más construya un PrismaClient o llame a buildApp — así todo lo que
// lee `process.env` (el plugin de Prisma de la app, loadEnv) apunta a la base
// de datos de pruebas, no a la de desarrollo.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/aguachiles_pos_test';
process.env.JWT_SECRET = 'test-secret-para-pruebas-minimo-32-caracteres';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.CORS_ORIGIN = 'http://localhost:5173';
// app.inject() no abre un puerto real; este valor solo necesita pasar la
// validación del esquema (PORT positivo).
process.env.PORT = '3999';
// Alto a propósito: muchas pruebas hacen login en cada `beforeEach` y no
// deben chocar con el límite de fuerza bruta; rate-limit.test.ts lo baja
// explícitamente en su propio archivo para probar el límite real.
process.env.LOGIN_RATE_LIMIT_MAX = '1000';
