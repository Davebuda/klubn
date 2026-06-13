// Scenario F (single-admit: first scan admits, second is rejected) +
// Scenario G (multi-admit: each scan decrements remaining admits, then locks at zero).
//
// The QR token is the REAL issued `qrCode` (read owner-scoped via the API after a real UI
// purchase), pasted into the scanner's manual-entry fallback — the same redeemTicket mutation
// the camera path triggers. This proves "an issued ticket is redeemable exactly once" (and
// "N times for a wave ticket") without brittle headless camera-frame decoding. Runs serially
// (see playwright.config.ts) so issued tickets aren't contended across workers.

import { test, expect } from '@playwright/test';
import { loadFixtures, uiLogin, selectTierAndPay, expectPaid, latestQrToken, uiScan } from './helpers';

const fx = loadFixtures();

test.describe('F · Single-admit scan lifecycle', () => {
  test('first valid scan admits; a second scan of the same ticket is rejected', async ({
    page,
    request,
  }) => {
    // Buy a single-admit ticket for real.
    await uiLogin(page, fx.buyer.email, fx.buyer.password);
    await selectTierAndPay(page, fx, fx.tiers.ga.name);
    await expectPaid(page);

    const { token } = await latestQrToken(request, fx, { minAdmits: 1 });

    // Door staff scans it.
    await uiLogin(page, fx.admin.email, fx.admin.password);
    const first = await uiScan(page, token);
    expect(first.kind, `first scan should admit (got: ${first.text})`).toBe('admit');

    const second = await uiScan(page, token);
    expect(second.kind, 'second scan of a single-admit ticket must be rejected').toBe('deny');
    expect(second.text).toMatch(/already used|not valid|invalid/i);
  });
});

test.describe('G · Multi-admit decrement', () => {
  test('each scan decrements remaining admits until zero, then further scans are rejected', async ({
    page,
    request,
  }) => {
    const admitCount = fx.tiers.table.admitCount; // 4
    await uiLogin(page, fx.buyer.email, fx.buyer.password);
    await selectTierAndPay(page, fx, fx.tiers.table.name);
    await expectPaid(page);

    const { token } = await latestQrToken(request, fx, { minAdmits: admitCount });

    await uiLogin(page, fx.admin.email, fx.admin.password);

    // Admit one person at a time; remaining should count down N-1 … 0.
    for (let i = 1; i <= admitCount; i++) {
      const v = await uiScan(page, token, { admits: 1 });
      expect(v.kind, `scan ${i}/${admitCount} should admit (got: ${v.text})`).toBe('admit');
      expect(v.remaining, `remaining after scan ${i}`).toBe(admitCount - i);
    }

    // The (N+1)th scan is rejected — the ticket is fully redeemed.
    const overflow = await uiScan(page, token, { admits: 1 });
    expect(overflow.kind, 'scan past zero must be rejected').toBe('deny');
    expect(overflow.text).toMatch(/already used|remaining|not valid/i);
  });
});
