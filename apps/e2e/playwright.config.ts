import { defineConfig, devices } from '@playwright/test';

const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/aguachiles_pos_e2e';

const API_URL = 'http://127.0.0.1:3100';
const WEB_URL = 'http://127.0.0.1:5273';
const PRINT_AGENT_URL = 'http://127.0.0.1:4100';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run dev --workspace=@aguachiles/api',
      url: `${API_URL}/health`,
      cwd: '../..',
      reuseExistingServer: !process.env.CI,
      env: {
        DATABASE_URL: E2E_DATABASE_URL,
        JWT_SECRET: 'e2e-secret-para-pruebas-minimo-32-caracteres',
        PORT: '3100',
        CORS_ORIGIN: WEB_URL,
      },
    },
    {
      command: 'npm run dev --workspace=@aguachiles/print-agent',
      url: `${PRINT_AGENT_URL}/printers`,
      cwd: '../..',
      reuseExistingServer: !process.env.CI,
      env: { PORT: '4100' },
    },
    {
      command: 'npm run dev --workspace=@aguachiles/web',
      url: WEB_URL,
      cwd: '../..',
      reuseExistingServer: !process.env.CI,
      env: {
        VITE_DEV_PORT: '5273',
        VITE_API_URL: API_URL,
        VITE_PRINT_AGENT_URL: PRINT_AGENT_URL,
      },
    },
  ],
});
