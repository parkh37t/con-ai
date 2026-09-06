/**
 * 상단 바 레이아웃: 메뉴가 화면 정중앙에 오고, 좁은 폭에서도 가로 스크롤이 생기지 않는다.
 * 사람이 「가운데로 보이는지」로 판단하던 것을 수치로 고정한다.
 */
import { expect, test } from '@playwright/test'

const WIDTHS = [1440, 1024, 390] as const

test('상단 메뉴는 가운데 정렬이고 어떤 폭에서도 가로로 넘치지 않는다', async ({ page }) => {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/#/asis')
    // 현재 화면 표시(밑줄)가 살아 있어야 메뉴가 제 구실을 한다
    await expect(page.locator('.topbar-nav a.active')).toHaveText('AS-IS 분석')

    const nav = await page.locator('.topbar-nav').boundingBox()
    if (!nav) throw new Error(`${width}px: 메뉴를 찾지 못했다`)
    // 좌우 칸을 같은 폭(minmax(0, 1fr))으로 잡았으므로 오차 1px 이내여야 한다
    expect(Math.abs(nav.x + nav.width / 2 - width / 2), `${width}px 메뉴 중앙 어긋남`).toBeLessThanOrEqual(1)

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, `${width}px 가로 넘침`).toBeLessThanOrEqual(0)
  }
})

test('제품명은 AI 기획 에이전트이고 메인으로 간다', async ({ page }) => {
  await page.goto('/#/asis')
  const brand = page.locator('.topbar .brand')
  await expect(brand).toHaveText('AI 기획 에이전트')
  await brand.click()
  await expect(page.getByTestId('main-create')).toBeVisible()
})
