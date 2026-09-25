import { expect, test } from '@playwright/test';

test.describe('fixture inspector snapshots', () => {
  test('keeps a stable detail extraction snapshot', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /indeed-legacy-detail\.html/ }).click();
    await expect(page.locator('#extraction')).toMatchAriaSnapshot();
  });

  test('keeps a stable discovery extraction snapshot', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /linkedin-guest-search\.html/ }).click();
    await expect(page.locator('#extraction')).toMatchAriaSnapshot();
  });

  test('keeps a stable blocked-state snapshot', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /linkedin-consent-wall\.html/ }).click();
    await expect(page.locator('#extraction')).toMatchAriaSnapshot();
  });
});
