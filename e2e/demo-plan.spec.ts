/**
 * 정적 데모에서 **「메뉴에서 화면 만들기」** — 서버 없이 브라우저 안에서만 돈다.
 *
 * 이 검사가 지키는 것
 * - 메뉴구조도의 메뉴를 고르면 ①메뉴 ②화면 ID ③근거(SSOT) ④프롬프트 가 실제로 보인다.
 * - 프롬프트는 예시가 아니라 그 자리에서 조립한 것이다 (템플릿 버전이 붙는다).
 * - 「모두 만들기」로 만든 화면의 목업 GNB 는 **메뉴구조도에서 온다** — 메뉴에 그 화면 ID 가 붙어 있다.
 */
import { expect, test, type Page } from '@playwright/test'

const BANKING = 'b1000000-0000-4000-8000-000000000001'
const BUILD_TIMEOUT_MS = 180_000

async function openPlan(page: Page): Promise<void> {
  await page.goto('#/')
  await page.evaluate(() => localStorage.clear())
  await page.goto(`#/plan?project=${BANKING}`)
  await expect(page.getByTestId('plan-node').first()).toBeVisible({ timeout: 30_000 })
}

test('정적 데모: 메뉴 → 화면 ID → 근거(SSOT) → 프롬프트가 한 화면에 보인다', async ({ page }) => {
  test.setTimeout(240_000)
  const consoleErrors: string[] = []
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })

  await openPlan(page)

  // 메뉴구조도가 뱅킹 트리다 (포털 → 분류 → 화면).
  const labels = await page.getByTestId('plan-node').allInnerTexts()
  expect(labels.join(' ')).toContain('MY 뱅킹')
  expect(labels.join(' ')).toContain('메인 페이지')

  // 「메인 페이지」 메뉴를 고른다.
  const mainIndex = labels.findIndex((t) => t.includes('메인 페이지'))
  expect(mainIndex, '메뉴구조도에 메인 페이지 노드가 있어야 한다').toBeGreaterThanOrEqual(0)
  await page.getByTestId('plan-node').nth(mainIndex).click()

  // ① 메뉴 경로 ② 화면 ID ③ 근거
  await expect(page.getByTestId('plan-menu')).toContainText('MY 뱅킹')
  await expect(page.getByTestId('plan-screen-id')).toContainText('SAMPLE-bank-main')
  const ssot = page.getByTestId('plan-ssot')
  await expect(ssot).toContainText('기준 버전')
  await expect(ssot).toContainText('REQ-BK-005')
  await expect(ssot).toContainText('프로파일 규칙')

  // ④ 프롬프트 — 그 자리에서 조립한다 (모델 호출 없음).
  await page.getByTestId('plan-prompt').click()
  await expect(page.getByTestId('plan-prompt-view')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('plan-prompt-view')).toContainText('템플릿 v1.1')
  await expect(page.getByTestId('plan-prompt-view')).toContainText('REQ-BK-005')

  expect(consoleErrors, consoleErrors.join('\n')).toEqual([])
})

test('정적 데모: 메뉴의 화면을 모두 만들면 목업 GNB 가 메뉴구조도에서 온다', async ({ page }) => {
  test.setTimeout(300_000)
  await openPlan(page)

  await page.getByTestId('plan-build-all').click()
  await expect(page.getByTestId('plan-notice')).toContainText('만들었습니다', { timeout: BUILD_TIMEOUT_MS })

  // 만든 화면 하나를 연다 — 「설계서 보기」가 생겼다.
  const labels = await page.getByTestId('plan-node').allInnerTexts()
  const mainIndex = labels.findIndex((t) => t.includes('메인 페이지'))
  await page.getByTestId('plan-node').nth(mainIndex).click()
  await expect(page.getByTestId('plan-screen-id')).toContainText('설계서 있음')
  await page.getByTestId('plan-screen-id').getByRole('link', { name: '설계서 보기' }).click()

  const screen = page.frameLocator('[data-testid="design-iframe"]').locator('[data-region="screen"]')
  await expect(screen.locator('.gnb')).toBeVisible({ timeout: 30_000 })
  // GNB 메뉴가 메뉴구조도에서 왔다면 그 메뉴에 화면 ID 가 붙는다 (없는 화면이면 «화면 없음»).
  const navTags = await screen.locator('.gnb-menu .nav-tag').allInnerTexts()
  expect(navTags.join(' '), 'GNB 메뉴에 메뉴구조도의 화면 ID 가 붙어야 한다').toContain('SAMPLE-bank')
  // breadcrumb 도 메뉴 경로에서 온다.
  await expect(screen.locator('.breadcrumb')).toContainText('MY 뱅킹')
})
