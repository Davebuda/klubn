// Scenario B (Card / Stripe) + the Vipps redirect-boundary check.
//
// Both are environment-gated and SKIP explicitly (never fake "verified") when their provider
// isn't wired into the pre-deploy env:
//   • Card  — runs as a hard gate only when PREDEPLOY_STRIPE_ENABLED is set (Stripe test keys +
//             Stripe in Payments__Providers). Drives the hosted Checkout test card to completion.
//   • Vipps — full PSP approval needs the Vipps MT app (a phone), so we only assert the redirect
//             boundary (createTicketOrder hands back a Vipps redirect) when PREDEPLOY_VIPPS_ENABLED.

import { test, expect } from '@playwright/test';
import { cfg, loadFixtures, uiLogin, apiLogin, expectPaid } from './helpers';

const fx = loadFixtures();
const vippsEnabled = !!process.env.PREDEPLOY_VIPPS_ENABLED && process.env.PREDEPLOY_VIPPS_ENABLED !== '0';

test.describe('B · Card (Stripe) purchase', () => {
  test.skip(!cfg().stripeEnabled, 'Stripe test keys not configured (PREDEPLOY_STRIPE_ENABLED unset)');

  test('buyer pays with Card via hosted Stripe Checkout and the ticket issues', async ({ page }) => {
    await uiLogin(page, fx.buyer.email, fx.buyer.password);
    await page.goto(`${cfg().baseUrl}/events/${fx.eventId}/tickets`);

    const card = page.locator('div.rounded-2xl', { hasText: fx.tiers.ga.name }).first();
    await card.getByRole('button', { name: 'Increase quantity' }).click();

    // With >1 provider enabled the picker renders — choose Card explicitly.
    await page.getByRole('radio', { name: /Card/i }).first().check();
    await Promise.all([
      page.waitForURL(/checkout\.stripe\.com|\/checkout\/return\?/, { timeout: 30000 }),
      page.getByRole('button', { name: /Pay with Card/ }).click(),
    ]);

    // Hosted Stripe Checkout test card. Selectors per Stripe's hosted page — adjust if Stripe
    // changes its markup; this branch only runs once Stripe test mode is actually wired.
    if (page.url().includes('checkout.stripe.com')) {
      await page.fill('input[name="cardNumber"]', '4242424242424242');
      await page.fill('input[name="cardExpiry"]', '12 / 34');
      await page.fill('input[name="cardCvc"]', '123');
      const name = page.locator('input[name="billingName"]');
      if (await name.count()) await name.fill('KlubN Predeploy');
      await page.getByTestId('hosted-payment-submit-button').click();
      await page.waitForURL(/\/checkout\/return\?/, { timeout: 30000 });
    }

    await expectPaid(page);
  });
});

test.describe('Vipps · redirect boundary', () => {
  test.skip(!vippsEnabled, 'Vipps not enabled in this env (PREDEPLOY_VIPPS_ENABLED unset) — full approval needs the MT app');

  test('createTicketOrder with provider=Vipps returns a Vipps redirect', async ({ request }) => {
    const { token } = await apiLogin(request, fx.baseUrlApi, fx.buyer.email, fx.buyer.password);
    const res = await request.post(`${fx.baseUrlApi}/graphql`, {
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      data: {
        query: `mutation($input: CreateTicketOrderInput!){
          createTicketOrder(input:$input){ redirectUrl provider } }`,
        variables: {
          input: {
            eventId: fx.eventId,
            lines: [{ ticketTypeId: fx.tiers.ga.id, quantity: 1 }],
            customerEmail: fx.buyer.email,
            provider: 'Vipps',
          },
        },
      },
    });
    const body = await res.json();
    const payload = body.data?.createTicketOrder;
    expect(payload?.provider).toBe('Vipps');
    expect(payload?.redirectUrl, 'redirect should target a Vipps host').toMatch(/vipps/i);
  });
});
