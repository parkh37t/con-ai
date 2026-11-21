/** 검토·완료 화면 캡처 (실제 revision 을 하나 만들어 본다). CAPTURE=1 로만 돈다. */
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { REPO_ROOT } from './helpers.js'

const OUT = resolve(REPO_ROOT, '.local', 'captures')

test('검토·완료 캡처', async ({ page }) => {
  mkdirSync(OUT, { recursive: true })
  await page.setViewportSize({ width: 1440, height: 1000 })
  const shot = (n: string) => page.screenshot({ path: resolve(OUT, `${n}.png`), fullPage: true })

  // 만들기로 revision 하나를 만든다 (fixture 어댑터 — 결정적)
  await page.goto('/#/new')
  await page.getByTestId('simple-input').fill('파트너가 견적 요청 목록을 조회하고 상태별로 검색하는 화면')
  await page.getByTestId('simple-create').click()
  await expect(page.getByTestId('design-iframe')).toBeVisible({ timeout: 60_000 })
  await page.waitForTimeout(800)
  await shot('43-design')

  await page.getByTestId('design-detail').click()
  await expect(page.getByTestId('ctxtab-review')).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(1200)
  await shot('44-review')

  await page.getByTestId('ctxtab-approve').click()
  await expect(page.getByTestId('ctxtab-approve')).toHaveAttribute('aria-current', 'page')
  await page.waitForTimeout(800)
  await shot('45-approve')
})
