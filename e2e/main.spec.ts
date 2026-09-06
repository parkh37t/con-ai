/**
 * 메인(랜딩, `#/`) e2e (fixture 어댑터): 메인 → 4단계 프로세스 카드 → «설계서 만들기» → `#/new` → 문장 한 줄 → 결과,
 * 그리고 자격 증명 없이 «예시 열어보기» 가 설계서를 연다.
 *
 * 메인은 새 데이터를 만들지 않는다 — 최근 설계서가 없으면 «예시 열어보기» 를 열 수 있는 것처럼 보이게 하지 않는다.
 */
import { expect, test } from '@playwright/test'
import { CREDENTIAL_STORAGE_KEY } from '../apps/web/src/browser-run/credential.js'

const JOB_TIMEOUT_MS = 90_000

test.describe.configure({ mode: 'serial' })

test('메인: 4단계 프로세스 → 설계서 만들기 → 결과 → 예시 열어보기', async ({ page }) => {
  test.setTimeout(300_000)
  const consoleErrors: string[] = []
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`console: ${msg.text()}`)
  })

  // ---------------------------------------------------------------- (1) 메인
  await test.step('메인 화면 — 히어로·4단계 카드·시작 안내', async () => {
    await page.goto('/#/')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('화면설계서가 나옵니다')
    await expect(page.getByTestId('main-create')).toHaveAttribute('href', '#/new')
    // 프로젝트 홈 링크는 진입 셸의 얇은 상단 바가 가진다 (화면마다 따로 두지 않는다)
    await expect(page.getByTestId('link-advanced')).toHaveAttribute('href', '#/advanced')

    // 4단계 카드 4장 — 번호·링크가 프로세스 순서와 같다
    const steps = page.getByTestId('main-step')
    await expect(steps).toHaveCount(4)
    await expect(steps.nth(0)).toContainText('AS-IS 분석')
    await expect(steps.nth(1)).toContainText('생성')
    await expect(steps.nth(2)).toContainText('검토')
    await expect(steps.nth(3)).toContainText('완료·이관')
    for (const [i, href] of ['#/asis', '#/new', '#/advanced', '#/advanced'].entries()) {
      await expect(steps.nth(i)).toHaveAttribute('href', href)
    }
    // 서버 모드에서는 네 단계 모두 동작하므로 "지금 가능" 이다
    await expect(page.getByTestId('main-step-flag')).toHaveCount(4)
    for (let i = 0; i < 4; i += 1) await expect(page.getByTestId('main-step-flag').nth(i)).toHaveText('지금 가능')

    // 「예시 열어보기」는 실제로 열 설계서가 있을 때만 링크가 된다
    const recentCount = await page.getByTestId('main-recent-card').count()
    const available = await page.getByTestId('main-example').getAttribute('data-available')
    expect(available === 'true', `최근 설계서 ${recentCount}개일 때 예시 링크 available=${available}`).toBe(recentCount > 0)
  })

  // ---------------------------------------------------------------- (2) API 키 안내
  await test.step('«Claude API 키 받는 법» 접이식 — 기본은 접혀 있고 펼치면 키 받는 곳과 보관 규칙이 나온다', async () => {
    const help = page.getByTestId('main-key-help')
    await expect(help).toHaveJSProperty('open', false)
    await help.locator('summary').click()
    await expect(help).toHaveJSProperty('open', true)
    await expect(help).toContainText('platform.claude.com')
    await expect(help).toContainText('ant auth login')
    await expect(help).toContainText('api.anthropic.com 으로만 전송')
    await expect(help.locator('a[href="https://platform.claude.com"]')).toHaveCount(1)

    // 자격 증명 패널의 링크(#/?help=key)로 들어오면 펼친 채로 보인다
    await page.goto('/#/?help=key')
    await expect(page.getByTestId('main-key-help')).toHaveJSProperty('open', true)
  })

  // ---------------------------------------------------------------- (3) 설계서 만들기
  let revisionId = ''
  await test.step('«설계서 만들기» → `#/new` → 문장 한 줄 → 결과 화면', async () => {
    await page.goto('/#/')
    await page.getByTestId('main-create').click()
    await expect(page).toHaveURL(/#\/new$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('어떤 화면을 만들까요?')

    await page.getByTestId('simple-input').fill('고객사 담당자가 계약 목록을 조회하고 상태별로 검색하는 화면. 목록에서 상세로 이동한다.')
    await page.getByTestId('simple-create').click()
    await expect(page).toHaveURL(/#\/d\//, { timeout: JOB_TIMEOUT_MS })
    revisionId = page.url().split('#/d/')[1]?.split('?')[0] ?? ''
    expect(revisionId).not.toBe('')
    await expect(page.frameLocator('[data-testid="design-iframe"]').locator('.root-shell')).toBeVisible({ timeout: 30_000 })
  })

  // ---------------------------------------------------------------- (4) 예시 열어보기
  await test.step('자격 증명 없이 «예시 열어보기» 가 설계서를 연다', async () => {
    // 메인으로 돌아가는 길은 상단 바의 제품명이다
    await page.locator('.apptop .brand').click()
    await expect(page).toHaveURL(/#\/$/)

    // 이 브라우저에 저장된 자격 증명이 없다는 것을 확인한 뒤 연다
    const stored = await page.evaluate((key) => ({ session: sessionStorage.getItem(key), local: localStorage.getItem(key) }), CREDENTIAL_STORAGE_KEY)
    expect(stored).toEqual({ session: null, local: null })

    await expect(page.getByTestId('main-recent-card').first()).toBeVisible()
    const example = page.getByTestId('main-example')
    await expect(example).toHaveAttribute('data-available', 'true')
    await example.click()
    await expect(page).toHaveURL(/#\/d\//)
    await expect(page.frameLocator('[data-testid="design-iframe"]').locator('.root-shell')).toBeVisible({ timeout: 30_000 })
  })

  // ---------------------------------------------------------------- (5) 카드로 이동
  await test.step('프로세스 카드 ②를 누르면 만들기 화면으로 간다', async () => {
    await page.goto('/#/')
    await page.locator('[data-testid="main-step"][data-step="2"]').click()
    await expect(page).toHaveURL(/#\/new$/)
    await expect(page.getByTestId('simple-input')).toBeVisible()
  })

  expect(consoleErrors, `콘솔·페이지 오류 없음: ${consoleErrors.join(' | ')}`).toEqual([])
})
