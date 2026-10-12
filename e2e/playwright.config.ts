import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  timeout: 60000,
  expect: { timeout: 10000 },
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4500',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    browserName: 'chromium',
    ...(process.env['PLAYWRIGHT_CHROME_CHANNEL']
      ? { channel: process.env['PLAYWRIGHT_CHROME_CHANNEL'] }
      : {}),
  },
  webServer: [
    {
      command: `"${process.execPath}" --import tsx ../e2e/fixture-server.ts`,
      cwd: resolve(root, 'Backend'),
      env: { TSX_TSCONFIG_PATH: 'tsconfig.json' },
      url: 'http://127.0.0.1:4400/health',
      timeout: 180000,
      reuseExistingServer: false,
    },
    {
      command: `"${process.execPath}" ../node_modules/@angular/cli/bin/ng.js serve --host 127.0.0.1 --port 4500 --proxy-config ../e2e/proxy.conf.json`,
      cwd: resolve(root, 'Frontend'),
      url: 'http://localhost:4500',
      timeout: 180000,
      reuseExistingServer: false,
    },
  ],
});
