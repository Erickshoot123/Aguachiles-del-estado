import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 15000,
    hookTimeout: 15000,
    // Las pruebas de integración comparten una sola base de datos de prueba
    // y la truncan entre cada una (ver tests/testDb.ts); correrlas en
    // paralelo pisaría los datos de otra prueba a medio correr.
    fileParallelism: false,
  },
});
