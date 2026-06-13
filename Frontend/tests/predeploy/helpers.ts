// Shared helpers for the KlubN pre-deploy Playwright suite.
//
// Design + rationale: docs/plans/predeploy-playwright-suite.md.
// Run model mirrors ws3b.spec.ts — Playwright is intentionally NOT a package.json dependency;
// run via `npx --yes @playwright/test`. All config comes from env + the seeded fixtures file
// (scripts/e2e/seed_predeploy.py writes Frontend/tests/predeploy/.fixtures.json).

import { expect, type Page, type APIRequestContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ─── Config (env-driven) ──────────────────────────────────────────────────────

export interface PredeployConfig {
  /** Frontend under test. Dev server :3000 for the pure-UI buyer journey (Sandbox auto-completes). */
  baseUrl: string;
  /** Mailpit HTTP API base (the email sink). */
  mailpitUrl: string;
  /** Path to the JSON fixtures emitted by seed_predeploy.py. */
  fixturesPath: string;
  /** True when Stripe test mode is wired into the env → the Card path becomes a hard gate. */
  stripeEnabled: boolean;
}

export function cfg(): PredeployConfig {
  return {
    baseUrl: (process.env.PREDEPLOY_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
    mailpitUrl: (process.env.PREDEPLOY_MAILPIT_URL ?? 'http://localhost:8025').replace(/\/$/, ''),
    // ESM-safe (the Frontend project is "type":"module", so no __dirname). The runner always
    // sets PREDEPLOY_FIXTURES to an absolute path; this cwd-relative default assumes the
    // documented `cd Frontend` invocation.
    fixturesPath:
      process.env.PREDEPLOY_FIXTURES ?? path.resolve('tests/predeploy/.fixtures.json'),
    // Card is a hard gate only when BOTH a Stripe test key is present AND the suite is told
    // Stripe is enabled in the backend's Payments__Providers.
    stripeEnabled:
      !!process.env.PREDEPLOY_STRIPE_ENABLED &&
      process.env.PREDEPLOY_STRIPE_ENABLED !== '0' &&
      process.env.PREDEPLOY_STRIPE_ENABLED.toLowerCase() !== 'false',
  };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

export interface Fixtures {
  baseUrlApi: string; // GraphQL host, e.g. http://localhost:5102
  eventId: string;
  tiers: {
    ga: TierFixture;
    table: TierFixture;
    vipHidden: TierFixture;
  };
  promo: { code: string; percent: number };
  unlock: { code: string; revealsTierName: string };
  buyer: { email: string; password: string; userId: string };
  admin: { email: string; password: string };
}
export interface TierFixture {
  id: string;
  name: string;
  priceMinor: number;
  admitCount: number;
}

export function loadFixtures(): Fixtures {
  const p = cfg().fixturesPath;
  if (!fs.existsSync(p)) {
    throw new Error(
      `Fixtures not found at ${p}. Run scripts/e2e/seed_predeploy.py first (the runner does this).`,
    );
  }
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as Fixtures;
}

// ─── GraphQL over Playwright's request context (server-trustable assertions) ────

async function gql<T = any>(
  request: APIRequestContext,
  apiBase: string,
  query: string,
  variables: Record<string, unknown>,
  token?: string,
): Promise<T> {
  const res = await request.post(`${apiBase}/graphql`, {
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    data: { query, variables },
  });
  const body = await res.json();
  if (body.errors?.length) {
    throw new Error(`GraphQL error: ${JSON.stringify(body.errors)}`);
  }
  return body.data as T;
}

/** Log in via the API and return the access token (used to read server-trustable ticket/QR state). */
export async function apiLogin(
  request: APIRequestContext,
  apiBase: string,
  email: string,
  password: string,
): Promise<{ token: string; userId: string; role: string }> {
  const data = await gql<{ login: { accessToken: string; user: { id: string; role: string } } }>(
    request,
    apiBase,
    `mutation($email:String!,$password:String!){
       login(input:{email:$email,password:$password}){ accessToken user { id role } } }`,
    { email, password },
  );
  return { token: data.login.accessToken, userId: data.login.user.id, role: data.login.user.role };
}

export interface ApiTicket {
  id: string;
  ticketNumber: string;
  status: string;
  qrCode: string;
  admitCount: number;
  admitsRemaining: number;
  event: { id: string; title: string };
}

/** Read the buyer's issued tickets (owner-scoped) — the `qrCode` is the real redeemable token. */
export async function getUserTickets(
  request: APIRequestContext,
  apiBase: string,
  token: string,
  userId: string,
): Promise<ApiTicket[]> {
  // ticketsByUser(userId) takes a String! (the user id), NOT UUID! — unlike most Guid args here.
  const data = await gql<{ ticketsByUser: ApiTicket[] }>(
    request,
    apiBase,
    `query($userId:String!){ ticketsByUser(userId:$userId){
       id ticketNumber status qrCode admitCount admitsRemaining event { id title } } }`,
    { userId },
    token,
  );
  return data.ticketsByUser ?? [];
}

/** The most-recently-issued Active ticket's QR token for a given event (for the scanner step). */
export async function latestQrToken(
  request: APIRequestContext,
  fx: Fixtures,
  opts?: { minAdmits?: number },
): Promise<{ token: string; ticketNumber: string; admitCount: number }> {
  const { token } = await apiLogin(request, fx.baseUrlApi, fx.buyer.email, fx.buyer.password);
  const tickets = await getUserTickets(request, fx.baseUrlApi, token, fx.buyer.userId);
  const candidates = tickets
    .filter((t) => t.event.id.toLowerCase() === fx.eventId.toLowerCase())
    .filter((t) => t.status === 'Active' && !!t.qrCode)
    .filter((t) => (opts?.minAdmits ? t.admitCount >= opts.minAdmits : true));
  const t = candidates[candidates.length - 1];
  if (!t) throw new Error('No Active ticket with a QR found for the buyer/event.');
  return { token: t.qrCode, ticketNumber: t.ticketNumber, admitCount: t.admitCount };
}

// ─── Mailpit (the email sink) ──────────────────────────────────────────────────

export interface MailpitMessage {
  ID: string;
  To: { Address: string }[];
  Subject: string;
}
export interface MailpitMessageFull extends MailpitMessage {
  Text: string;
  HTML: string;
}

export async function clearMailpit(request: APIRequestContext): Promise<void> {
  await request.delete(`${cfg().mailpitUrl}/api/v1/messages`);
}

/** Poll Mailpit for a message to `to` whose subject contains `subjectIncludes`. */
export async function waitForEmail(
  request: APIRequestContext,
  opts: { to: string; subjectIncludes?: string; timeoutMs?: number },
): Promise<MailpitMessageFull> {
  const deadline = Date.now() + (opts.timeoutMs ?? 20000);
  let lastSeen = 0;
  while (Date.now() < deadline) {
    const res = await request.get(`${cfg().mailpitUrl}/api/v1/messages?limit=50`);
    if (res.ok()) {
      const body = (await res.json()) as { messages: MailpitMessage[] };
      lastSeen = body.messages?.length ?? 0;
      const hit = (body.messages ?? []).find(
        (m) =>
          m.To?.some((t) => t.Address.toLowerCase() === opts.to.toLowerCase()) &&
          (!opts.subjectIncludes || m.Subject.includes(opts.subjectIncludes)),
      );
      if (hit) {
        const full = await request.get(`${cfg().mailpitUrl}/api/v1/message/${hit.ID}`);
        return (await full.json()) as MailpitMessageFull;
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(
    `No email to ${opts.to}${opts.subjectIncludes ? ` matching "${opts.subjectIncludes}"` : ''} ` +
      `within timeout (${lastSeen} messages in sink).`,
  );
}

// ─── UI flows (user-visible behavior first) ────────────────────────────────────

/** Log in through the real login form (mirrors ws3b's helper). */
export async function uiLogin(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${cfg().baseUrl}/login`);
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
}

export interface PayOptions {
  /** Pick a specific provider in the picker when >1 is available (e.g. 'Card' or 'Vipps'). */
  pickProvider?: 'Vipps' | 'Card';
}

export async function gotoTickets(page: Page, fx: Fixtures): Promise<void> {
  await page.goto(`${cfg().baseUrl}/events/${fx.eventId}/tickets`);
}

/** Increase the quantity of a (visible) tier by `qty`. */
export async function addTier(page: Page, tierName: string, qty = 1): Promise<void> {
  const card = page.locator('div.rounded-2xl', { hasText: tierName }).first();
  await expect(card, `tier card "${tierName}" should be visible`).toBeVisible({ timeout: 10000 });
  for (let i = 0; i < qty; i++) {
    await card.getByRole('button', { name: 'Increase quantity' }).click();
  }
}

/** Click the (provider-explicit) Pay CTA and wait for the checkout-return URL; returns the reference. */
export async function payAndReturn(page: Page, opts: PayOptions = {}): Promise<string> {
  const payButton = page.getByRole('button', { name: /Pay with|Continue to payment/ });
  await expect(payButton).toBeEnabled({ timeout: 10000 }); // quote settled
  if (opts.pickProvider) {
    const radio = page.getByRole('radio', { name: new RegExp(opts.pickProvider, 'i') });
    if (await radio.count()) await radio.first().check();
  }
  await Promise.all([
    page.waitForURL(/\/checkout\/return\?/, { timeout: 20000 }),
    payButton.click(),
  ]);
  const reference = new URL(page.url()).searchParams.get('reference');
  if (!reference) throw new Error('No order reference on the return URL.');
  return reference;
}

/**
 * Convenience: open the ticket page, select ONE of `tierName`, pay, and (Sandbox on a DEV frontend)
 * land on the auto-completing return page. Returns the order reference. For promo/unlock flows use
 * gotoTickets + addTier + applyPromo + payAndReturn directly (the promo box only renders once a
 * tier is selected).
 */
export async function selectTierAndPay(
  page: Page,
  fx: Fixtures,
  tierName: string,
  opts: PayOptions = {},
): Promise<string> {
  await gotoTickets(page, fx);
  await addTier(page, tierName, 1);
  return payAndReturn(page, opts);
}

/** Apply a promo/unlock code in the order-summary panel. Requires a tier already selected
 *  (the promo disclosure only renders when the cart is non-empty). */
export async function applyPromo(page: Page, code: string): Promise<void> {
  const haveCode = page.getByRole('button', { name: 'Have a code?' });
  if (await haveCode.count()) await haveCode.click();
  const input = page.getByLabel('Promo code');
  await input.fill(code);
  await page.getByRole('button', { name: 'Apply' }).click();
}

/** Assert the return page reached the paid/confirmed success state. */
export async function expectPaid(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Payment confirmed' })).toBeVisible({
    timeout: 30000,
  });
}

export type ScanVerdict =
  | { kind: 'admit'; remaining: number; text: string }
  | { kind: 'deny'; text: string };

/**
 * Drive the admin door scanner via the manual-paste fallback (the stable, fully-realistic path —
 * same redeemTicket mutation the camera triggers). `admits` selects wave-entry count (default: all).
 */
export async function uiScan(
  page: Page,
  token: string,
  opts: { admits?: number } = {},
): Promise<ScanVerdict> {
  if (!page.url().includes('/scan')) {
    await page.goto(`${cfg().baseUrl}/scan`);
  }
  // If a previous verdict is showing, advance to the next scan.
  const scanNext = page.getByRole('button', { name: 'Scan next' });
  if (await scanNext.isVisible().catch(() => false)) await scanNext.click();

  // Ensure MANUAL entry: the scanner opens in camera mode; switch and WAIT for the textarea
  // (the camera<->manual toggle is async, so we must not race it before filling).
  const tokenBox = page.locator('#manual-token');
  if (!(await tokenBox.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: 'Manual entry' }).click();
  }
  await expect(tokenBox).toBeVisible({ timeout: 10000 });

  // Wave-entry count: the stepper starts at ALL; one "Fewer admits" click sets it to 1, then up.
  if (opts.admits != null) {
    await page.getByRole('button', { name: 'Fewer admits' }).click(); // -> 1
    for (let i = 1; i < opts.admits; i++) {
      await page.getByRole('button', { name: 'More admits' }).click();
    }
  }

  await tokenBox.fill(token);
  await page.getByRole('button', { name: 'Validate' }).click();

  const admit = page.locator('[role="status"]');
  const deny = page.locator('[role="alert"]');
  await expect(admit.or(deny)).toBeVisible({ timeout: 10000 });

  if (await admit.count()) {
    const text = (await admit.innerText()).replace(/\s+/g, ' ').trim();
    const m = text.match(/(\d+)\s+admit/);
    const remaining = /fully redeemed/i.test(text) ? 0 : m ? Number(m[1]) : 0;
    return { kind: 'admit', remaining, text };
  }
  const text = (await deny.innerText()).replace(/\s+/g, ' ').trim();
  return { kind: 'deny', text };
}

export function minorToKr(minor: number): string {
  return (minor / 100).toFixed(2);
}
