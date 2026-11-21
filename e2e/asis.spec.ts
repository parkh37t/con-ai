/**
 * AS-IS 분석 e2e (계약 §12, fixture 어댑터): `#/asis` → 데모 대상(/asis-sample) 채우기 → 실행 →
 * 목록 행이 succeeded 가 될 때까지 폴링(실패면 사유와 함께 즉시 실패) → 상세(스크린샷 로드·모바일 토글·
 * 구조 요약의 "레이블 없는" 수치·요약·페인포인트 ≥3 전부 '제안' → 1건 채택) → 목록의 페인포인트 수 확인.
 * 대상은 API 서버가 직접 제공하는 합성 데모 페이지라 외부 네트워크 정책의 영향을 받지 않는다.
 */
import { expect, test } from '@playwright/test'
import { loadSeedProject } from './helpers.js'

const ASIS_SAMPLE_URL = 'http://localhost:8787/asis-sample'
/** 분석(브라우저 방문 + 스크린샷 + 초안)이 끝날 때까지 최대 60초. */
const ANALYSIS_TIMEOUT_MS = 60_000

test.describe.configure({ mode: 'serial' })

test('AS-IS 분석: 데모 대상 실행 → succeeded → 상세 확인 → 페인포인트 채택 → 목록 반영', async ({ page, request }) => {
  test.setTimeout(240_000)
  const consoleErrors: string[] = []
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`))
  const project = await loadSeedProject(request)

  // ---------------------------------------------------------------- (1) 진입 — 홈 링크·상단 내비
  await test.step('홈·좌측 레일의 "AS-IS 분석" 링크로 목록에 진입', async () => {
    // 기본 화면은 "만들기" 로 바뀌었고, 프로젝트 홈(요구사항·IA·화면 목록)은 `#/advanced` 다.
    await page.goto('/#/advanced')
    await expect(page.getByTestId('project-name')).toHaveText(project.name)
    await expect(page.getByTestId('link-asis')).toBeVisible()
    await page.getByTestId('rail-asis').click()
    await expect(page).toHaveURL(/#\/asis$/)
    // 화면 제목은 h1 이고, 구역 딱지가 «AS-IS 분석» 을 말한다 (다른 작업대 화면과 같은 머리)
    await expect(page.locator('.projhead-kicker')).toContainText('AS-IS 분석')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('페인포인트')
  })

  // ---------------------------------------------------------------- (2) 실행
  await test.step('데모 대상 채우기 → 메모 → 실행', async () => {
    await page.getByTestId('asis-sample-fill').click()
    await expect(page.getByTestId('asis-url')).toHaveValue(ASIS_SAMPLE_URL)
    await page.getByTestId('asis-note').fill('e2e 데모 분석')
    await page.getByTestId('asis-run').click()
  })

  // ---------------------------------------------------------------- (3) 목록 폴링 — queued/running → succeeded
  let analysisId = ''
  let listedUrl = ''
  await test.step('목록 행이 succeeded 로 갱신될 때까지 폴링 (failed 면 실패 사유와 함께 즉시 실패)', async () => {
    const row = page.getByTestId('asis-row')
    await expect(row).toHaveCount(1, { timeout: 15_000 })
    await expect(row).toContainText(ASIS_SAMPLE_URL)
    analysisId = (await row.getAttribute('data-analysis-id')) ?? ''
    expect(analysisId).not.toBe('')
    await expect
      .poll(async () => (await row.getAttribute('data-status')) ?? '', {
        timeout: ANALYSIS_TIMEOUT_MS,
        intervals: [1000],
        message: `분석이 ${ANALYSIS_TIMEOUT_MS / 1000}초 안에 끝나지 않았다 (2초 폴링으로 queued→running→succeeded 갱신)`,
      })
      .toMatch(/^(succeeded|failed)$/)
    const finalStatus = await row.getAttribute('data-status')
    if (finalStatus !== 'succeeded') {
      const res = await request.get(`/api/asis-analyses/${analysisId}`)
      const doc = res.ok() ? ((await res.json()) as { failure?: { code?: string; message?: string } }) : null
      const failure = doc?.failure ? `${doc.failure.code ?? '?'} — ${doc.failure.message ?? ''}` : '(실패 원인 없음)'
      throw new Error(`AS-IS 분석이 ${finalStatus} 로 끝났다: ${failure}`)
    }
    await expect(row.getByTestId('asis-row-status')).toHaveText('성공')
    listedUrl = page.url()
  })

  // ---------------------------------------------------------------- (4) 상세 — 스크린샷 토글
  await test.step('상세 — 데스크톱 스크린샷 로드(naturalWidth>0), 모바일 토글', async () => {
    await page.getByTestId('asis-detail-link').click()
    await expect(page).toHaveURL(new RegExp(`#/asis/${analysisId}$`))
    await expect(page.getByTestId('asis-status')).toHaveAttribute('data-status', 'succeeded')

    const shot = page.getByTestId('asis-screenshot')
    await expect(shot).toBeVisible()
    await expect(shot).toHaveAttribute('data-shot', 'desktop')
    await expect(shot).toHaveAttribute('src', /^\/api\/asis-assets\/.+/)
    const desktopSrc = (await shot.getAttribute('src')) ?? ''
    await expect
      .poll(
        () =>
          shot.evaluate((el) => {
            const img = el as HTMLImageElement
            return img.complete && img.naturalWidth > 0
          }),
        { timeout: 15_000, message: '데스크톱 스크린샷 이미지가 로드되지 않았다 (naturalWidth>0)' },
      )
      .toBe(true)

    await page.getByTestId('asis-shot-mobile').click()
    await expect(shot).toHaveAttribute('data-shot', 'mobile')
    const mobileSrc = (await shot.getAttribute('src')) ?? ''
    expect(mobileSrc, '모바일 스크린샷은 다른 asset 이어야 한다').not.toBe(desktopSrc)
    expect(mobileSrc).toMatch(/^\/api\/asis-assets\/.+/)
    await expect
      .poll(
        () =>
          shot.evaluate((el) => {
            const img = el as HTMLImageElement
            return img.complete && img.naturalWidth > 0
          }),
        { timeout: 15_000, message: '모바일 스크린샷 이미지가 로드되지 않았다 (naturalWidth>0)' },
      )
      .toBe(true)
    await page.getByTestId('asis-shot-desktop').click()
    await expect(shot).toHaveAttribute('data-shot', 'desktop')
  })

  // ---------------------------------------------------------------- (5) 구조 요약·요약
  await test.step('구조 요약 — "레이블 없는" 수치 표시, 요약 표시', async () => {
    const labelRow = page.locator('[data-testid="asis-structure-row"][data-key="fields_without_label"]')
    await expect(labelRow).toHaveCount(1)
    await expect(labelRow).toContainText('레이블 없는 필드')
    const labelCount = (await labelRow.getAttribute('data-value')) ?? ''
    expect(labelCount, `레이블 없는 필드 수는 숫자로 표시된다 (실제: "${labelCount}")`).toMatch(/^\d+$/)
    const altRow = page.locator('[data-testid="asis-structure-row"][data-key="images_without_alt"]')
    await expect(altRow).toContainText('alt 없는 이미지')

    const summary = page.getByTestId('asis-summary')
    await expect(summary).toBeVisible()
    expect(((await summary.textContent()) ?? '').trim().length, '요약 문구가 비어 있지 않다').toBeGreaterThan(0)
  })

  // ---------------------------------------------------------------- (6) 페인포인트 — ≥3 전부 '제안' → 1건 채택
  let painCount = 0
  await test.step('페인포인트 ≥3 전부 제안 → 1건 채택 → 상태 반영(화면·API)', async () => {
    const painRows = page.getByTestId('asis-pain-row')
    painCount = await painRows.count()
    expect(painCount, '페인포인트가 3건 이상이어야 한다').toBeGreaterThanOrEqual(3)
    const statuses = await painRows.evaluateAll((els) => els.map((el) => `${el.getAttribute('data-pp-id')}=${el.getAttribute('data-status')}`))
    const nonProposed = statuses.filter((s) => !s.endsWith('=proposed'))
    expect(nonProposed, `전부 '제안(proposed)' 이어야 한다: ${nonProposed.join(', ')}`).toEqual([])
    await expect(painRows.first()).toContainText('제안')

    const firstRow = painRows.first()
    const firstPpId = (await firstRow.getAttribute('data-pp-id')) ?? ''
    expect(firstPpId).not.toBe('')
    await firstRow.getByTestId('pp-adopt').click()
    const adoptedRow = page.locator(`[data-testid="asis-pain-row"][data-pp-id="${firstPpId}"]`)
    await expect(adoptedRow).toHaveAttribute('data-status', 'adopted')
    await expect(adoptedRow).toContainText('채택')

    // 서버 문서에도 반영됐는지 확인 (PATCH → 갱신된 문서 저장)
    const res = await request.get(`/api/asis-analyses/${analysisId}`)
    expect(res.ok(), `GET /api/asis-analyses/${analysisId} → ${res.status()}`).toBe(true)
    const doc = (await res.json()) as { pain_points: Array<{ id: string; status: string }> }
    expect(doc.pain_points.find((p) => p.id === firstPpId)?.status).toBe('adopted')
  })

  // ---------------------------------------------------------------- (7) 목록으로 — 페인포인트 수 표시
  await test.step('목록으로 돌아가 페인포인트 수 표시 확인', async () => {
    await page.getByTestId('rail-asis').click()
    await expect(page).toHaveURL(listedUrl)
    const listRow = page.locator(`[data-testid="asis-row"][data-analysis-id="${analysisId}"]`)
    await expect(listRow).toHaveCount(1)
    await expect(listRow).toHaveAttribute('data-status', 'succeeded')
    await expect(listRow.getByTestId('asis-pp-count')).toHaveText(String(painCount))
  })

  expect(consoleErrors, `페이지 오류 없음: ${consoleErrors.join(' | ')}`).toEqual([])
})
