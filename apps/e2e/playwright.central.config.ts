import { defineConfig, devices } from '@playwright/test';

const databaseUrl = process.env.E2E_CENTRAL_DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:5432/aguachiles_central_e2e';
if (new URL(databaseUrl).pathname !== '/aguachiles_central_e2e') throw new Error('Base E2E central inválida');
const apiUrl = 'http://127.0.0.1:3200';
const webUrl = 'http://127.0.0.1:5373';

export default defineConfig({
  testDir: './central-tests', timeout: 30000, workers: 1, fullyParallel: false,
  use: { baseURL: webUrl, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    { command: 'npm run dev --workspace=@aguachiles/api', url: `${apiUrl}/health`, cwd: '../..',
      env: { DATABASE_URL: databaseUrl, POS_MODE: 'central', NODE_ENV: 'test', PORT: '3200',
        JWT_SECRET: 'central-e2e-secret-only-for-test-environment', CORS_ORIGIN: webUrl } },
    { command: 'npm run dev --workspace=@aguachiles/web', url: webUrl, cwd: '../..',
      env: { VITE_DEV_PORT: '5373', VITE_POS_MODE: 'central', VITE_API_URL: apiUrl,
        VITE_PRINT_AGENT_URL: 'http://127.0.0.1:4100' } },
  ],
});
