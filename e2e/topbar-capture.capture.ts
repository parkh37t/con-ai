/**
 * 상단 바 캡처 — 검증 테스트가 아니다. `CAPTURE=1 pnpm exec playwright test e2e/topbar-capture.capture.ts`
 * 로 실행하면 `.local/captures/` 에 넓은 화면·좁은 화면 상단 바 PNG 를 남긴다.
 */
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { REPO_ROOT } from './helpers.js'

const OUT = resolve(REPO_ROOT, '.local', 'captures')

test('상단 바 캡처', async ({ page }) => {
  mkdirSync(OUT, { recursive: true })
  const shot = (name: string, clipHeight: number) =>
    page.screenshot({ path: resolve(OUT, `${name}.png`), clip: { x: 0, y: 0, width: page.viewportSize()!.width, height: clipHeight } })

  for (const [name, width, height] of [
    ['20-topbar-1440', 1440, 900],
    ['21-topbar-1024', 1024, 800],
    ['22-topbar-390', 390, 780],
  ] as const) {
    await page.setViewportSize({ width, height })
    await page.goto('/#/asis')
    await expect(page.locator('.topbar-nav a.active')).toHaveText('AS-IS 분석')
    await page.waitForTimeout(300)
    const box = await page.locator('.topbar').boundingBox()
    await shot(name, Math.ceil((box?.height ?? 60) + 12))
    // 가로 스크롤이 생기지 않아야 한다
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, `${name} 가로 넘침`).toBeLessThanOrEqual(0)
  }
})
