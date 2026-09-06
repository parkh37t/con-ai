/**
 * 셸 두 종류 — 설계 산출물 screens-v1 의 규격을 수치로 고정한다.
 *  - 진입 셸(메인·만들기·결과): 60px 얇은 상단 바 하나, 좌측 레일 없음.
 *  - 작업대 셸(홈·생성·검토·완료·AS-IS·레퍼런스): 228px 좌측 레일, 상단 가로 메뉴 없음.
 * 어떤 폭에서도 가로로 넘치지 않는다.
 */
import { expect, test } from '@playwright/test'

const WIDTHS = [1440, 1024, 390] as const

async function overflow(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
}

test('진입 셸: 얇은 상단 바 하나, 레일 없음', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/#/')
  const bar = page.locator('.apptop-inner')
  await expect(bar).toBeVisible()
  const box = await bar.boundingBox()
  expect(box?.height, '상단 바 한 줄').toBeLessThanOrEqual(72)
  await expect(page.getByTestId('workspace-rail')).toHaveCount(0)

  // 제품명은 메인으로, 오른쪽 링크는 프로젝트 홈으로
  await expect(page.locator('.apptop .brand')).toHaveText('AI 기획 에이전트')
  await expect(page.getByTestId('link-advanced')).toHaveAttribute('href', '#/advanced')
})

test('작업대 셸: 228px 좌측 레일, 단계 4항목, 현재 위치 표시', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/#/asis')
  const rail = page.getByTestId('workspace-rail')
  await expect(rail).toBeVisible()
  const box = await rail.boundingBox()
  expect(Math.round(box?.width ?? 0), '레일 폭').toBe(228)
  expect(Math.round(box?.x ?? -1), '레일은 왼쪽 끝에 붙는다').toBe(0)

  // 작업 흐름 4항목이 프로세스 순서대로 있고, 지금 화면이 표시된다
  for (const key of ['asis', 'screens', 'review', 'done']) await expect(page.getByTestId(`rail-${key}`)).toBeVisible()
  await expect(page.getByTestId('rail-asis')).toHaveAttribute('aria-current', 'page')
  // 상단 가로 메뉴는 없앴다
  await expect(page.locator('.topbar-nav')).toHaveCount(0)
})

test('어떤 폭에서도 가로로 넘치지 않는다', async ({ page }) => {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 })
    for (const path of ['/#/', '/#/new', '/#/advanced', '/#/asis']) {
      await page.goto(path)
      await page.waitForTimeout(150)
      expect(await overflow(page), `${path} ${width}px 가로 넘침`).toBeLessThanOrEqual(0)
    }
  }
})
