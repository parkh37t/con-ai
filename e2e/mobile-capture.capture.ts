/** 좁은 화면(390px) 확인. CAPTURE=1 로만 돈다. */
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { REPO_ROOT } from './helpers.js'
const OUT = resolve(REPO_ROOT, '.local', 'captures')

test('모바일 캡처', async ({ page }) => {
  mkdirSync(OUT, { recursive: true })
  await page.setViewportSize({ width: 390, height: 900 })
  const shot = (n: string) => page.screenshot({ path: resolve(OUT, `${n}.png`), fullPage: false })
  await page.goto('/#/')
  await expect(page.getByTestId('main-create')).toBeVisible()
  await shot('60-mobile-main')
  await page.goto('/#/advanced')
  await expect(page.getByTestId('workspace-rail')).toBeVisible()
  await shot('61-mobile-home')
})
