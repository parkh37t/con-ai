/** ID 매핑 화면 캡처. CAPTURE=1 로만 돈다. */
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { REPO_ROOT } from './helpers.js'
const OUT = resolve(REPO_ROOT, '.local', 'captures')

test('ID 매핑 캡처', async ({ page }) => {
  mkdirSync(OUT, { recursive: true })
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto('/#/trace')
  await expect(page.getByTestId('trace-kpis')).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: resolve(OUT, '70-trace.png'), fullPage: true })
})
