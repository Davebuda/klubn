// Prod-build smoke — proves the EXACT deployable artifact (nginx-served production bundle) carries
// the real security headers (CSP etc.). The runner invokes this pass with PREDEPLOY_BASE_URL
// pointed at the nginx build (:8080).
//
// The full buyer journey is exercised by the dev pass; a purchase on the PROD bundle is NOT run by
// default because the prod CSP (`connect-src 'self' https://api.klubn.no ...`) correctly forbids the
// SPA from talking to a cross-origin localhost backend. Reproducing it faithfully needs prod-like
// same-origin routing (Traefik / an nginx that proxies /graphql+/api to the backend) — gated behind
// PREDEPLOY_PRODBUILD_SAMEORIGIN; otherwise the real prod-bundle purchase is a post-deploy manual smoke.

import { test, expect } from '@playwright/test';
import { cfg, loadFixtures, uiLogin, selectTierAndPay, expectPaid } from './helpers';

const fx = loadFixtures();
const sameOrigin =
  !!process.env.PREDEPLOY_PRODBUILD_SAMEORIGIN && process.env.PREDEPLOY_PRODBUILD_SAMEORIGIN !== '0';

test.describe('Prod-build smoke', () => {
  test('the nginx-served bundle sets a Content-Security-Policy on the HTML document', async ({
    request,
  }) => {
    const res = await request.get(`${cfg().baseUrl}/`);
    expect(res.ok()).toBeTruthy();
    const csp =
      res.headers()['content-security-policy'] ?? res.headers()['content-security-policy-report-only'];
    expect(csp, 'production nginx must serve a Content-Security-Policy header on the HTML').toBeTruthy();
    expect(csp).toContain("script-src 'self'");
    // The other security headers must ride along on the document too (nginx add_header inheritance).
    expect(res.headers()['x-frame-options'], 'X-Frame-Options on the HTML').toBeTruthy();
    expect(res.headers()['x-content-type-options'], 'X-Content-Type-Options on the HTML').toBeTruthy();
  });

  test('buyer completes a purchase on the deployed bundle (same-origin routing)', async ({ page }) => {
    test.skip(
      !sameOrigin,
      'prod-bundle purchase needs same-origin backend routing (prod Traefik); the prod CSP blocks a ' +
        'cross-origin localhost backend. Covered by the dev pass + post-deploy manual smoke.',
    );
    await uiLogin(page, fx.buyer.email, fx.buyer.password);
    const reference = await selectTierAndPay(page, fx, fx.tiers.ga.name);
    expect(reference).toBeTruthy();
    await expectPaid(page);
    await expect(page.getByRole('link', { name: 'View My Tickets' })).toBeVisible();
  });
});
