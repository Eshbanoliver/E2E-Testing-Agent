import { test, expect } from '@playwright/test';

test('Recorded Sandbox Test', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.locator('#action-btn').click();
  await expect(page.locator('#result')).toBeVisible();
});
