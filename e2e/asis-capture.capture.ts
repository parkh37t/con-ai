/**
 * AS-IS 분석 화면 캡처 — 검증 테스트가 아니다. `CAPTURE=1 pnpm exec playwright test e2e/asis-capture.capture.ts`
 * 로 실행하면 `.local/captures/` 에 PNG 를 남긴다(목록·실행, 분석 대상 원본, 상세: 스크린샷·구조·페인포인트).
 */
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { REPO_ROOT } from './helpers.js'

const OUT = resolve(REPO_ROOT, '.local', 'captures')

test('AS-IS 분석 화면 캡처', async ({ page }) => {
  mkdirSync(OUT, { recursive: true })
  await page.setViewportSize({ width: 1440, height: 900 })
  const shot = (name: string) => page.screenshot({ path: resolve(OUT, `${name}.png`), fullPage: true })

  // 분석 대상(합성 레거시 데모 페이지) 자체
  await page.goto('http://localhost:8787/asis-sample')
  await shot('10-asis-sample-target')

  await page.goto('/#/asis')
  await page.getByTestId('asis-sample-fill').click()
  await page.getByTestId('asis-note').fill('레거시 파트너몰 개선 전 현황 파악')
  await shot('11-asis-list-form')

  await page.getByTestId('asis-run').click()
  const row = page.getByTestId('asis-row').first()
  await expect(row).toBeVisible({ timeout: 20_000 })
  await expect
    .poll(async () => (await row.getAttribute('data-status')) ?? '', { timeout: 60_000, intervals: [1000] })
    .toMatch(/^(succeeded|failed)$/)
  const status = await row.getAttribute('data-status')
  if (status !== 'succeeded') throw new Error(`분석이 ${status} 로 끝났다`)
  await shot('12-asis-list-succeeded')

  await row.getByTestId('asis-detail-link').click()
  await expect(page.getByTestId('asis-screenshot')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('asis-pain-row').first()).toBeVisible()
  await page.waitForTimeout(500)
  await shot('13-asis-detail')

  await page.getByTestId('asis-shot-mobile').click()
  await page.waitForTimeout(500)
  await shot('14-asis-detail-mobile')

  await page.getByTestId('asis-pain-row').first().getByTestId('pp-adopt').click()
  await expect(page.getByTestId('asis-pain-row').first()).toHaveAttribute('data-status', 'adopted', { timeout: 15_000 })
  await shot('15-asis-pain-adopted')
})
