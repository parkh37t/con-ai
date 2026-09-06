/** AS-IS 목록·상세 캡처 (새 셸). CAPTURE=1 로만 돈다. */
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { REPO_ROOT } from './helpers.js'
const OUT = resolve(REPO_ROOT, '.local', 'captures')

test('AS-IS 캡처', async ({ page }) => {
  mkdirSync(OUT, { recursive: true })
  await page.setViewportSize({ width: 1440, height: 1000 })
  const shot = (n: string) => page.screenshot({ path: resolve(OUT, `${n}.png`), fullPage: true })

  await page.goto('/#/asis')
  await page.getByTestId('asis-sample-fill').click()
  await page.getByTestId('asis-run').click()
  const row = page.getByTestId('asis-row').first()
  await expect(row).toBeVisible({ timeout: 20_000 })
  await expect.poll(async () => (await row.getAttribute('data-status')) ?? '', { timeout: 60_000, intervals: [1000] }).toMatch(/^(succeeded|failed)$/)
  await shot('50-asis-list')

  await row.getByTestId('asis-detail-link').click()
  await expect(page.getByTestId('asis-screenshot')).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(600)
  await shot('51-asis-detail')
})
