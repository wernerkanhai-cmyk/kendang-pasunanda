import { test, expect } from '@playwright/test';

/**
 * E2E smoke-test.
 *  - "Onbewerkt" draait altijd (geen login nodig): app boot, loginscherm rendert,
 *    geen uncaught JS-fouten.
 *  - "Ingelogd" draait alleen met E2E_EMAIL + E2E_PASSWORD in de omgeving:
 *      E2E_EMAIL=... E2E_PASSWORD=... npm run test:e2e
 *  Doel-URL: standaard de live site; overschrijf met E2E_BASE_URL.
 */

// Verzamel echte crashes (uncaught exceptions). Console.error-ruis (Supabase 401
// vóór login e.d.) negeren we — dat zegt niets over een app-crash.
function trackPageErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  return errors;
}

test.describe('Smoke — onbewerkt (geen login)', () => {
  test('app boot + loginscherm rendert + geen uncaught JS-fouten', async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto('/');

    // Loginscherm: e-mail- en wachtwoordveld aanwezig.
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    // Merknaam zichtbaar als login-titel — exacte match, zodat de (verborgen)
    // rotate-prompt "…to use Kendang Pasunanda" niet meetelt.
    await expect(page.getByText('Kendang Pasunanda', { exact: true })).toBeVisible();

    await page.waitForTimeout(500);
    expect(errors, `uncaught fouten:\n${errors.join('\n')}`).toEqual([]);
  });

  test('document.title bevat de app-naam', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Kendang|Pasunanda/i);
  });
});

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

test.describe('Flow — ingelogd', () => {
  test.skip(!EMAIL || !PASSWORD, 'Zet E2E_EMAIL en E2E_PASSWORD om de ingelogde flow te draaien.');

  test('inloggen → app verschijnt', async ({ page }) => {
    await page.goto('/');
    await page.locator('input[type="email"]').fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole('button', { name: /inloggen|log in|masuk|registreren|sign up|daftar/i }).first().click();
    // Na succesvolle login is het loginscherm weg.
    await expect(page.locator('input[type="email"]')).toHaveCount(0);
  });
});
