import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, join, relative, isAbsolute } from 'node:path';
// Each suite gets a new API, real auth limiter and replica set, with owned scratch space.
const cli = fileURLToPath(new URL('../node_modules/@playwright/test/cli.js', import.meta.url));
const cacheRoot = fileURLToPath(new URL('../node_modules/.cache/commerceos-e2e/', import.meta.url));
await mkdir(cacheRoot, { recursive: true });
const suites = ['checkout', 'admin', 'ui'];
const selected = process.argv
  .slice(2)
  .find((arg) => arg.startsWith('--suite='))
  ?.slice(8);
if (selected && !suites.includes(selected)) throw new Error('Use --suite=checkout, admin or ui');
const args = process.argv.slice(2).filter((arg) => !arg.startsWith('--suite='));
for (const suite of (selected ? [selected] : suites).map((name) => `${name}.spec.ts`)) {
  const scratch = await mkdtemp(join(cacheRoot, 'run-'));
  const childPath = relative(cacheRoot, scratch);
  if (!childPath || childPath.startsWith('..') || isAbsolute(childPath))
    throw new Error('Invalid test scratch directory');
  let status;
  try {
    status = await new Promise((resolveStatus, reject) => {
      const child = spawn(
        process.execPath,
        [cli, 'test', '--config', 'e2e/playwright.config.ts', suite, ...args],
        {
          stdio: 'inherit',
          env: {
            ...process.env,
            TMP: scratch,
            TEMP: scratch,
            TMPDIR: scratch,
            PLAYWRIGHT_HTML_OUTPUT_DIR: resolve('playwright-report', suite.replace('.spec.ts', '')),
          },
        },
      );
      child.on('error', reject);
      child.on('close', (code) => resolveStatus(code ?? 1));
    });
  } finally {
    // Delete only the fresh directory created above, after the suite's server processes stop.
    await rm(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
  if (status !== 0) process.exit(status);
}
