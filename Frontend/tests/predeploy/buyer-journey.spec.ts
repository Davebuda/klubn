// Scenario A (Sandbox purchase — the HARD purchase gate) + D (buyer QR visibility).
//
// The Sandbox provider stands in for the real PSP; everything else is exercised for real through
// the UI: login, tier selection, the server quote, create, the return page (which auto-completes
// on a DEV frontend), real ticket issuance, and the QR on the wallet. See the plan for why Sandbox
// is the deployable gate and Vipps/Card are redirect-boundary / conditional.

import { test, expect } from '@playwright/test';
import { cfg, loadFixtures, uiLogin, selectTierAndPay, expectPaid } from './helpers';

const fx = loadFixtures();

test.describe('A · Sandbox purchase → success', () => {
  test('buyer buys a single-admit ticket and lands on the confirmed state', async ({ page }) => {
    await uiLogin(page, fx.buyer.email, fx.buyer.password);

    // The Pay CTA must be provider-explicit (product expectation), not the generic label.
    await page.goto(`${cfg().baseUrl}/events/${fx.eventId}/tickets`);
    const card = page.locator('div.rounded-2xl', { hasText: fx.tiers.ga.name }).first();
    await card.getByRole('button', { name: 'Increase quantity' }).click();
    await expect(
      page.getByRole('button', { name: /Pay with (Vipps|Card|Sandbox)/ }),
    ).toBeEnabled({ timeout: 10000 });

    const reference = await selectTierAndPay(page, fx, fx.tiers.ga.name);
    expect(reference).toBeTruthy();

    await expectPaid(page);
    // The authed buyer is offered the wallet, not a login wall (auth-aware CTA).
    await expect(page.getByRole('link', { name: 'View My Tickets' })).toBeVisible();
  });
});

test.describe('D · Buyer QR visibility', () => {
  test('the wallet shows the issued ticket QR + event data after purchase', async ({ page }) => {
    await uiLogin(page, fx.buyer.email, fx.buyer.password);
    await selectTierAndPay(page, fx, fx.tiers.ga.name);
    await expectPaid(page);

    await page.goto(`${cfg().baseUrl}/tickets`);
    // The wallet renders at least one ticket card for the buyer.
    const ticketCard = page.locator('.tile', { hasText: /Ticket/ });
    await expect(ticketCard.first()).toBeVisible({ timeout: 15000 });

    // ...and revealing the entry pass shows a QR (qrcode.react svg, aria-labelled).
    await page.getByRole('button', { name: 'Show entry pass' }).first().click();
    await expect(page.locator('svg[aria-label^="Entry QR"]').first()).toBeVisible();
  });
});
