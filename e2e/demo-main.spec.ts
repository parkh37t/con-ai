/**
 * 정적 데모(배포 주소)에서 **«메인 페이지»가 실제로 만들어지는지** — 서버 없이 브라우저 안에서만 돈다.
 *
 * 이 검사가 지키는 것
 * - 문장 한 줄에 «메인» 이 있으면 목록 어휘가 아니라 히어로·KPI 인포스트립·카드 그리드로 만들어진다.
 * - 그 내용이 목업에 실제로 그려진다 (명세에만 있고 화면은 빈 상자인 상태를 잡는다).
 * - 「도메인」 같은 낱말이 「메인」으로 오판되지 않는다.
 */
import { expect, test } from '@playwright/test'

const JOB_TIMEOUT_MS = 90_000

test('정적 데모: 한 줄에 «메인» → 히어로·KPI·카드 그리드로 만들어지고 목업에 그려진다', async ({ page }) => {
  test.setTimeout(240_000)
  const consoleErrors: string[] = []
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })

  await page.goto('#/')
  await page.evaluate(() => localStorage.clear())
  await page.goto('#/new')

  await page.getByTestId('simple-input').fill('뱅킹 앱 메인 페이지를 만든다. 대표 안내와 통합검색, 요약 지표, 자주 쓰는 기능 카드, 최근 공지를 보여 준다.')
  await page.getByTestId('simple-create').click()
  await expect(page).toHaveURL(/#\/d\//, { timeout: JOB_TIMEOUT_MS })

  const frame = page.frameLocator('[data-testid="design-iframe"]')
  await expect(frame.locator('.root-shell')).toBeVisible({ timeout: 30_000 })

  // 세 컴포넌트가 «화면 영역» 에 그려져 있어야 한다 (설명 패널이 아니라).
  const screen = frame.locator('[data-region="screen"]')
  await expect(screen.locator('.hero .hero-headline')).toBeVisible()
  await expect(screen.locator('.stat-strip .stat-value').first()).toBeVisible()
  await expect(screen.locator('.card-grid .card-title').first()).toBeVisible()
  // 표시값이 더미임을 화면에서 말한다 (CLAUDE.md: 더미와 실제 연계를 구분한다).
  await expect(screen.locator('.static-note').first()).toContainText('실제 데이터 미연결')
  // 외부 이미지를 끌어오지 않는다.
  await expect(screen.locator('img')).toHaveCount(0)

  expect(consoleErrors, consoleErrors.join('\n')).toEqual([])
})

test('정적 데모: 「도메인」이 들어간 목록 요청은 메인으로 오판하지 않는다', async ({ page }) => {
  test.setTimeout(240_000)
  await page.goto('#/')
  await page.evaluate(() => localStorage.clear())
  await page.goto('#/new')

  await page.getByTestId('simple-input').fill('커머스 도메인 주문 목록을 조회하고 상태로 검색하는 화면')
  await page.getByTestId('simple-create').click()
  await expect(page).toHaveURL(/#\/d\//, { timeout: JOB_TIMEOUT_MS })

  const screen = page.frameLocator('[data-testid="design-iframe"]').locator('[data-region="screen"]')
  await expect(screen.locator('table.grid')).toBeVisible({ timeout: 30_000 })
  await expect(screen.locator('.hero')).toHaveCount(0)
})
