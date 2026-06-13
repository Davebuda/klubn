// Scenario E — confirmation email content, verified against a real Mailpit sink.
//
// Requires Email__Enabled=true + the backend pointed at Mailpit (the runner wires this; the
// EmailService test-only affordance lets it connect without SMTP auth/TLS — see the README).
// If the sink is unreachable the test fails loudly rather than silently passing.

import { test, expect } from '@playwright/test';
import {
  loadFixtures,
  uiLogin,
  selectTierAndPay,
  expectPaid,
  clearMailpit,
  waitForEmail,
} from './helpers';

const fx = loadFixtures();

test.describe('E · Confirmation email', () => {
  test('a purchase produces a KlubN confirmation email with order + ticket-access details', async ({
    page,
    request,
  }) => {
    // Sink reachable? (clear also acts as a connectivity probe.)
    try {
      await clearMailpit(request);
    } catch (e) {
      throw new Error(
        `Mailpit sink not reachable at PREDEPLOY_MAILPIT_URL — start it before this gate. ${e}`,
      );
    }

    await uiLogin(page, fx.buyer.email, fx.buyer.password);
    await selectTierAndPay(page, fx, fx.tiers.ga.name);
    await expectPaid(page);

    const msg = await waitForEmail(request, {
      to: fx.buyer.email,
      subjectIncludes: 'Your KlubN tickets',
      timeoutMs: 25000,
    });

    // Recipient + subject.
    expect(msg.To.some((t) => t.Address.toLowerCase() === fx.buyer.email.toLowerCase())).toBeTruthy();
    expect(msg.Subject).toContain('Your KlubN tickets');

    // Body: event/ticket summary (the tier name is the order line) + the /tickets access path.
    const body = `${msg.Text}\n${msg.HTML}`;
    expect(body).toContain(fx.tiers.ga.name);
    expect(body).toMatch(/\/tickets/);
    // The paid total (250.00 NOK → "250" appears in the formatted amount).
    expect(body).toMatch(/250/);
  });
});
