import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, expect, test, type BrowserContext, type Page } from '@playwright/test';

const extensionPath = resolve(process.cwd(), '.output/chrome-mv3');
const searchFixturePath = resolve(process.cwd(), 'tests/fixtures/detectors/linkedin-guest-search.html');
const detailFixturePath = resolve(process.cwd(), 'tests/fixtures/detectors/linkedin-unified-detail.html');

async function openExtensionPage(context: BrowserContext, extensionId: string, name: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/${name}`);
  return page;
}

async function waitForPage(context: BrowserContext, fragment: string): Promise<Page> {
  const existing = context.pages().find((page) => page.url().includes(fragment));
  if (existing) return existing;
  return context.waitForEvent('page').then(async (page) => {
    await page.waitForLoadState('domcontentloaded');
    if (!page.url().includes(fragment)) {
      throw new Error(`Expected a page containing ${fragment}, received ${page.url()}.`);
    }
    return page;
  });
}

test('discovers cards, saves one, and clips a detail posting to the dashboard', async () => {
  const userDataDirectory = await mkdtemp(join(tmpdir(), 'joblint-e2e-'));
  const searchHtml = await readFile(searchFixturePath, 'utf8');
  const detailHtml = await readFile(detailFixturePath, 'utf8');
  const context = await chromium.launchPersistentContext(userDataDirectory, {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  try {
    const serviceWorker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const extensionId = serviceWorker.url().split('/')[2];
    if (!extensionId) throw new Error('Could not determine the JobLint extension ID.');

    const searchPage = await context.newPage();
    await searchPage.route('https://www.linkedin.com/**', (route) => route.fulfill({
      body: searchHtml,
      contentType: 'text/html',
      status: 200,
    }));
    await searchPage.goto('https://www.linkedin.com/jobs/search/?keywords=product%20designer');
    await searchPage.waitForTimeout(1_000);

    const scanPopup = await openExtensionPage(context, extensionId, 'popup.html');
    await expect(scanPopup.getByRole('button', { name: 'Scan this LinkedIn / Indeed search page' })).toBeVisible();
    await searchPage.bringToFront();
    const dashboardPromise = waitForPage(context, 'dashboard.html#discovery');
    await scanPopup.getByRole('button', { name: 'Scan this LinkedIn / Indeed search page' }).evaluate((button) => {
      (button as HTMLButtonElement).click();
    });
    const dashboard = await dashboardPromise;
    await expect(dashboard.getByRole('heading', { name: 'Discovery inbox' })).toBeVisible();
    await expect(dashboard.getByRole('heading', { name: 'Staff Product Designer' })).toBeVisible();

    await dashboard.getByRole('button', { name: 'Save to Kanban' }).first().click();
    await expect(dashboard.getByRole('status')).toContainText('Saved: Staff Product Designer');
    await dashboard.getByRole('button', { name: 'Close dialog' }).click();
    await expect(dashboard.getByRole('heading', { name: 'Staff Product Designer' })).toBeVisible();

    const detailPage = await context.newPage();
    await detailPage.route('https://www.linkedin.com/**', (route) => route.fulfill({
      body: detailHtml,
      contentType: 'text/html',
      status: 200,
    }));
    await detailPage.goto('https://www.linkedin.com/jobs/view/4231045678/');
    await detailPage.waitForTimeout(1_000);

    const clipPopup = await openExtensionPage(context, extensionId, 'popup.html');
    await detailPage.bringToFront();
    await clipPopup.getByRole('button', { name: '+ Clip' }).evaluate((button) => {
      (button as HTMLButtonElement).click();
    });
    await expect(clipPopup.getByRole('status')).toContainText('Clipped: Staff Frontend Engineer');
    await expect(dashboard.getByRole('heading', { name: 'Staff Frontend Engineer' })).toBeVisible();
    await expect(dashboard.getByText('Aurora Systems · London, England · Hybrid')).toBeVisible();
  } finally {
    await context.close();
    await rm(userDataDirectory, { recursive: true, force: true });
  }
});
