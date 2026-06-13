// Scenario C — promo discount + hidden-tier unlock, then a real issued ticket.
// NOTE: the promo box only renders once a tier is selected, so we always addTier() first.

import { test, expect } from '@playwright/test';
import { loadFixtures, uiLogin, gotoTickets, addTier, applyPromo, payAndReturn, expectPaid } from './helpers';

const fx = loadFixtures();

test.describe('C · Promo & unlock', () => {
  test('a percent promo lowers the price and the discounted order issues a ticket', async ({
    page,
  }) => {
    await uiLogin(page, fx.buyer.email, fx.buyer.password);
    await gotoTickets(page, fx);
    await addTier(page, fx.tiers.ga.name); // selecting first reveals the promo box

    await applyPromo(page, fx.promo.code);
    // Server-priced: a discount line (both a per-line and a summary row carry "discount", hence
    // .first()) + the applied-code chip appear once the quote re-runs. Generous timeout (login + quote).
    await expect(page.getByText(/Discount/i).first()).toBeVisible({ timeout: 15000 });
    // The code appears in both the applied chip and the "Discount (CODE)" row, hence .first().
    await expect(page.getByText(fx.promo.code).first()).toBeVisible();

    const reference = await payAndReturn(page);
    expect(reference).toBeTruthy();
    await expectPaid(page);
  });

  test('an unlock code reveals the hidden tier, which can then be purchased', async ({ page }) => {
    await uiLogin(page, fx.buyer.email, fx.buyer.password);
    await gotoTickets(page, fx);

    // Hidden tier is NOT visible without the unlock code (anti-oracle: no error, just absent).
    await expect(
      page.locator('div.rounded-2xl', { hasText: fx.tiers.vipHidden.name }),
    ).toHaveCount(0);

    // Select a visible tier to reveal the promo box, then apply the unlock code.
    await addTier(page, fx.tiers.ga.name);
    await applyPromo(page, fx.unlock.code);

    const vipCard = page.locator('div.rounded-2xl', { hasText: fx.tiers.vipHidden.name }).first();
    await expect(vipCard).toBeVisible({ timeout: 10000 });
    await expect(vipCard.getByText(/Unlocked/i)).toBeVisible();

    // Buy the revealed tier (the unlock code stays applied, so create() accepts the hidden tier).
    await addTier(page, fx.tiers.vipHidden.name);
    const reference = await payAndReturn(page);
    expect(reference).toBeTruthy();
    await expectPaid(page);
  });
});
