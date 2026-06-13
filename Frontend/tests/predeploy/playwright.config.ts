// Pre-deploy gate config. Run via ephemeral npx (Playwright is intentionally NOT in package.json):
//   cd Frontend
//   npx --yes @playwright/test test -c tests/predeploy/playwright.config.ts
//
// NOTE: this file must NOT `import` from '@playwright/test' at runtime — under ephemeral `npx` the
// package isn't resolvable from the project's module graph when the config is loaded (the spec
// files are fine; Playwright's own loader injects the module for them). So we export a plain object
// (a `type`-only import is erased at compile time and is safe).
//
// Serial + single worker on purpose: issued tickets are shared state across scenarios, and this is
// a gate (determinism > speed). Base URLs / sink / fixtures come from env (see helpers.ts).
import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  testDir: '.',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  // retries:1 absorbs a DEV-ONLY flake: React StrictMode double-mounts AuthProvider on the
  // checkout-return reload, firing two concurrent /api/auth/refresh calls that can race the
  // refresh-token rotation and intermittently land logged-out. StrictMode is dev-only (not in the
  // prod bundle), so this never happens in production; a single retry keeps the gate deterministic.
  retries: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    headless: true,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    // Skip the ScrollReveal/framer-motion entrance animations so card clicks are immediately stable.
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Camera permission + a fake media stream so the scanner's camera view initializes cleanly,
    // even though the specs use the (stable) manual-paste path for redemption.
    permissions: ['camera'],
    launchOptions: {
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    },
  },
};

export default config;
