/** 작업대 화면 캡처 (생성·검토·완료·레퍼런스). CAPTURE=1 로만 돈다. */
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { REPO_ROOT } from './helpers.js'

const OUT = resolve(REPO_ROOT, '.local', 'captures')

test('작업대 캡처', async ({ page }) => {
  mkdirSync(OUT, { recursive: true })
  await page.setViewportSize({ width: 1440, height: 1000 })
  const shot = (n: string) => page.screenshot({ path: resolve(OUT, `${n}.png`), fullPage: true })

  await page.goto('/#/references')
  await expect(page.getByTestId('workspace-rail')).toBeVisible()
  await page.waitForTimeout(400)
  await shot('40-references')

  await page.goto('/#/advanced')
  await page.locator('[data-testid="screen-row"]').first().getByTestId('link-generate').click()
  await expect(page.getByTestId('ctxtab-generate')).toBeVisible()
  await page.waitForTimeout(400)
  await shot('41-generate')

  // 생성 → 검토·완료 화면(리비전 없는 상태)
  const url = page.url()
  await page.goto(url.replace('/generate', '/review'))
  await page.waitForTimeout(400)
  await shot('42-review-empty')
})
