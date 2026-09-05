/**
 * 만들기 흐름 e2e (fixture 어댑터): 기본 화면(`#/`)에서 문장 한 줄 → «설계서 만들기» → 결과 화면의 iframe 에 설계서 HTML,
 * → 한 줄 수정 → v2 → HTML 다운로드 링크 → 최근 카드로 다시 열기.
 *
 * 이 흐름은 화면을 새로 만들기 때문에(외부 ID `SCREEN-00N`) 시드 화면 3개와 별개다.
 */
import { expect, test } from '@playwright/test'
import { hashQuery, loadSeedProject } from './helpers.js'

const JOB_TIMEOUT_MS = 90_000

test.describe.configure({ mode: 'serial' })

test('만들기: 한 줄 입력 → 설계서 HTML → 한 줄 수정 → v2 → 다운로드', async ({ page, request }) => {
  test.setTimeout(300_000)
  const consoleErrors: string[] = []
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`))
  const project = await loadSeedProject(request)
  const before = project.screens.length

  // ---------------------------------------------------------------- (1) 기본 화면
  await test.step('기본 화면 — 입력·기기 토글·만들기 버튼만 보인다', async () => {
    await page.goto('/#/')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('어떤 화면을 만들까요?')
    await expect(page.getByTestId('simple-input')).toBeVisible()
    await expect(page.getByTestId('simple-create')).toBeVisible()
    await expect(page.getByTestId('simple-device-desktop')).toHaveClass(/active/)
    // 어댑터 표시(더미/실제)는 기본 화면에서도 숨기지 않는다
    await expect(page.getByTestId('simple-adapter')).toContainText('더미')
    // 고급 화면 링크는 남아 있다
    await expect(page.getByTestId('link-advanced')).toHaveAttribute('href', '#/advanced')
    // 생성 작업대의 항목(요구사항 체크·CASE·프롬프트 미리보기)은 기본 화면에 없다
    await expect(page.getByTestId('case-normal')).toHaveCount(0)
    await expect(page.getByTestId('preview-button')).toHaveCount(0)
  })

  // ---------------------------------------------------------------- (2) 만들기
  let revisionId = ''
  await test.step('문장 한 줄 → 설계서 만들기 → 결과 화면(iframe 에 .root-shell)', async () => {
    await page.getByTestId('simple-input').fill('파트너가 견적 요청 목록을 조회하고 상태별로 검색하는 화면. 목록에서 상세로 이동하고 엑셀 다운로드 버튼이 있다.')
    await page.getByTestId('simple-create').click()
    // 진행 표시는 한 줄이고 단계 이름·작업 ID 같은 기술 용어를 쓰지 않는다
    const progress = page.getByTestId('simple-progress')
    await expect(progress).toBeVisible({ timeout: 30_000 })
    await expect(progress).toContainText('설계서를 만들고 있습니다')
    expect(await progress.textContent()).not.toMatch(/context_build|spec_generate|revision|artifact/i)

    await expect(page).toHaveURL(/#\/d\//, { timeout: JOB_TIMEOUT_MS })
    revisionId = page.url().split('#/d/')[1]?.split('?')[0] ?? ''
    expect(revisionId).not.toBe('')

    const frame = page.frameLocator('[data-testid="design-iframe"]')
    await expect(frame.locator('.root-shell')).toBeVisible({ timeout: 30_000 })
    await expect(frame.locator('#right-panel')).toBeAttached()
    await expect(page.getByTestId('design-iframe')).toHaveAttribute('sandbox', 'allow-scripts')
    // 버전 칩은 v1
    await expect(page.getByTestId('design-version')).toHaveCount(1)
    await expect(page.getByTestId('design-version')).toHaveText('v1')
  })

  // ---------------------------------------------------------------- (3) 새 화면 레코드
  await test.step('화면이 자동으로 만들어지고 외부 ID 가 붙는다 (시드 화면 ID 는 그대로)', async () => {
    const after = await loadSeedProject(request)
    expect(after.screens.length).toBe(before + 1)
    const created = after.screens.find((s) => s.external_id.startsWith('SCREEN-'))
    expect(created, '자동으로 만든 화면이 있어야 한다').toBeTruthy()
    expect(created?.external_id).toMatch(/^SCREEN-\d{3}$/)
    for (const id of ['SAMPLE-quote-list', 'SAMPLE-quote-detail', 'SAMPLE-quote-create-popup']) {
      expect(after.screens.some((s) => s.external_id === id), `시드 화면 ${id} 이 그대로 있어야 한다`).toBe(true)
    }
    // 결과 화면의 이름 수정 필드에 제목이 들어 있다
    await expect(page.getByTestId('design-title')).toHaveValue(/.+/)
  })

  // ---------------------------------------------------------------- (4) 다운로드·자세히
  await test.step('HTML 다운로드 링크와 «자세히»(기존 검토 화면) 링크', async () => {
    const download = page.getByTestId('design-download')
    await expect(download).toHaveAttribute('href', /\/api\/artifacts\/.+\/html$/)
    await expect(download).toHaveAttribute('download', /^SCREEN-\d{3}-v1\.html$/)
    const href = (await download.getAttribute('href')) ?? ''
    const res = await request.get(href)
    expect(res.status(), `GET ${href}`).toBe(200)
    expect(await res.text()).toContain('root-shell')
    await expect(page.getByTestId('design-detail')).toHaveAttribute('href', new RegExp(`#/screens/.+/review\\?rev=${revisionId}`))
  })

  // ---------------------------------------------------------------- (5) 한 줄 수정 → v2
  await test.step('한 줄 수정 → 새 버전(v2) → 버전 칩 전환', async () => {
    await page.getByTestId('design-edit-input').fill('검색 영역의 첫 번째 입력 라벨을 "견적명"으로 바꿔주세요')
    await page.getByTestId('design-edit-run').click()
    const progress = page.getByTestId('design-progress')
    await expect(progress).toBeVisible({ timeout: 30_000 })
    await expect(progress).toContainText('설계서를 고치는 중입니다')

    await expect(page).toHaveURL(new RegExp(`#/d/(?!${revisionId})`), { timeout: JOB_TIMEOUT_MS })
    const secondId = page.url().split('#/d/')[1]?.split('?')[0] ?? ''
    expect(secondId).not.toBe(revisionId)
    expect(hashQuery(page.url(), 'job')).toBeNull()

    await expect(page.frameLocator('[data-testid="design-iframe"]').locator('.root-shell')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('design-version')).toHaveCount(2)
    await expect(page.locator('[data-testid="design-version"][data-version="2"]')).toHaveAttribute('data-current', 'true')
    // v1 로 되돌아갈 수 있다
    await page.locator('[data-testid="design-version"][data-version="1"]').click()
    await expect(page).toHaveURL(new RegExp(`#/d/${revisionId}`))
    await expect(page.locator('[data-testid="design-version"][data-version="1"]')).toHaveAttribute('data-current', 'true')
  })

  // ---------------------------------------------------------------- (6) 최근 카드
  await test.step('기본 화면의 최근 카드로 방금 만든 설계서를 다시 연다', async () => {
    await page.getByTestId('design-back').click()
    await expect(page).toHaveURL(/#\/$/)
    const card = page.locator('[data-testid="simple-recent-card"]').first()
    await expect(card).toBeVisible()
    await card.click()
    await expect(page).toHaveURL(/#\/d\//)
    await expect(page.frameLocator('[data-testid="design-iframe"]').locator('.root-shell')).toBeVisible({ timeout: 30_000 })
  })

  expect(consoleErrors, `페이지 오류 없음: ${consoleErrors.join(' | ')}`).toEqual([])
})
