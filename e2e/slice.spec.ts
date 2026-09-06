/**
 * 세로 조각 전체 흐름 e2e (fixture 어댑터): 홈 → 포트폴리오 → 생성 작업대 → 검토(격리 iframe·코멘트·검증) → 단건 수정 → 완료 v1.0·내보내기 → 재승인 거부.
 * 서버는 playwright.config.ts 의 webServer 가 띄운다 (API 8787, 웹 5173, DB .local/e2e.db, 내보내기 .local/e2e-exports).
 */
import { expect, test } from '@playwright/test'
import { PROMPT_SECTIONS } from '../packages/prompt-templates/src/template-v1.js'
import { expectJobSucceeded, hashQuery, listExportFiles, loadSeedProject, screenByExternalId } from './helpers.js'

const JOB_TIMEOUT_MS = 90_000
const EXPORT_FILES = ['comments.json', 'index.html', 'manifest.json', 'spec.json', 'trace.json', 'validation.json']

test.describe.configure({ mode: 'serial' })

test('세로 조각: 생성 → 검토·코멘트 → 수정 → 완료(v1.0) → 내보내기 → 재승인 거부', async ({ page, request }) => {
  test.setTimeout(420_000)
  const project = await loadSeedProject(request)
  const listScreen = screenByExternalId(project, 'SAMPLE-quote-list')
  const consoleErrors: string[] = []
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`))

  // ---------------------------------------------------------------- (1) 홈
  await test.step('홈(고급) — 프로젝트명·fixture 배지·시드 화면 3개', async () => {
    // 기본 화면(`#/`)은 "만들기" 이고, 프로젝트 전체 목록은 `#/advanced` 다.
    await page.goto('/#/advanced')
    await expect(page.getByTestId('project-name')).toHaveText(project.name)
    await expect(page.getByTestId('adapter-badge')).toContainText('fixture')
    await expect(page.getByTestId('adapter-badge')).toContainText('더미')
    await expect(page.getByTestId('fixture-hint')).toContainText('MODEL_ADAPTER=anthropic')
    // 표는 프로젝트의 모든 화면을 보여준다 (다른 e2e 가 만든 화면이 있을 수 있어 API 목록과 맞춘다).
    await expect(page.getByTestId('screen-row')).toHaveCount(project.screens.length)
    for (const id of ['SAMPLE-quote-list', 'SAMPLE-quote-detail', 'SAMPLE-quote-create-popup']) {
      await expect(page.locator(`[data-testid="screen-row"][data-external-id="${id}"]`)).toHaveCount(1)
    }
    expect(project.screens.filter((s) => s.external_id.startsWith('SAMPLE-'))).toHaveLength(3)
  })

  // ---------------------------------------------------------------- (2) 레퍼런스 포트폴리오
  await test.step('레퍼런스 포트폴리오 — 카드 3개', async () => {
    await page.goto('/#/references')
    await expect(page.getByTestId('ref-card')).toHaveCount(3)
    await expect(page.getByTestId('ref-card').first()).toContainText('S2B 학습 규격')
  })

  // ---------------------------------------------------------------- (3) 생성 작업대
  let firstJobId = ''
  let firstRevisionId = ''
  await test.step('생성 작업대 — 폼 → 프롬프트 미리보기(7구역) → 생성 실행 → succeeded → 새로고침 후 유지', async () => {
    await page.goto('/#/advanced')
    await page.locator(`[data-testid="screen-row"][data-external-id="SAMPLE-quote-list"]`).getByTestId('link-generate').click()
    await expect(page).toHaveURL(new RegExp(`#/screens/${listScreen.id}/generate`))
    // 화면 이름·외부 ID·단계 탭은 컨텍스트 헤더가 갖는다 (생성·검토·완료가 같은 머리를 쓴다)
    await expect(page.locator('.ctxhead code')).toHaveText('SAMPLE-quote-list')
    await expect(page.getByTestId('ctxtab-generate')).toHaveAttribute('aria-current', 'page')

    await page.getByTestId('purpose').fill('파트너가 견적 요청 목록을 조회하고 상태별로 검색한다 (e2e)')
    // 요구사항 REQ-QT-001 의 수용조건 2개 체크 (접힌 목록을 연다)
    const req = page.getByTestId('requirement-REQ-QT-001')
    await req.locator('summary').click()
    await req.getByTestId('criterion-AC-QT-001-01').check()
    await req.getByTestId('criterion-AC-QT-001-03').check()
    await expect(req.getByTestId('requirement-check-REQ-QT-001')).toBeChecked()
    // 참고 화면 1개 (목록 골든)
    await expect(page.getByTestId('ref-card')).toHaveCount(3)
    const listRef = page.getByTestId('ref-card').filter({ hasText: '목록 골든' })
    await listRef.locator('input[type="checkbox"]').check()
    // CASE: normal(기본) + empty + error
    await expect(page.getByTestId('case-normal')).toBeChecked()
    await page.getByTestId('case-empty').check()
    await page.getByTestId('case-error').check()

    await page.getByTestId('preview-button').click()
    const userPrompt = page.getByTestId('prompt-user')
    await expect(userPrompt).toBeVisible()
    const promptText = (await userPrompt.textContent()) ?? ''
    for (const section of PROMPT_SECTIONS) expect(promptText, `user 프롬프트에 구역 "${section}" 이 있어야 한다`).toContain(`| ${section} |`)
    expect(promptText).toContain('SAMPLE-quote-list')
    expect(promptText).toContain('AC-QT-001-01')
    await expect(page.getByTestId('context-list').locator('li')).not.toHaveCount(0)
    await expect(page.getByTestId('context-list')).toContainText('참고 레퍼런스')

    await page.getByTestId('run-button').click()
    await expect(page).toHaveURL(/\?job=/)
    firstJobId = hashQuery(page.url(), 'job') ?? ''
    expect(firstJobId).not.toBe('')
    await expectJobSucceeded(page, JOB_TIMEOUT_MS)
    // 새로고침 뒤에도 ?job= 으로 상태를 다시 읽는다
    await page.reload()
    expect(hashQuery(page.url(), 'job')).toBe(firstJobId)
    await expect(page.getByTestId('job-status')).toHaveText('성공')
    const jobRes = await request.get(`/api/jobs/${firstJobId}`)
    expect(jobRes.ok()).toBe(true)
    const job = (await jobRes.json()) as { status: string; result?: { revision_id: string } }
    expect(job.status).toBe('succeeded')
    firstRevisionId = job.result?.revision_id ?? ''
    expect(firstRevisionId).not.toBe('')
    await page.getByTestId('job-success-link').click()
    await expect(page).toHaveURL(new RegExp(`#/screens/${listScreen.id}/review\\?rev=${firstRevisionId}`))
  })

  // ---------------------------------------------------------------- (4) 검토
  let commentId = ''
  await test.step('검토 — 격리 iframe·CASE 전환·요소 클릭 코멘트·검증 결과', async () => {
    await expect(page.getByTestId('revision-row')).toHaveCount(1)
    await expect(page.locator('[data-testid="revision-row"][data-revision-no="1"]')).toHaveAttribute('data-selected', 'true')

    const iframe = page.getByTestId('preview-iframe')
    await expect(iframe).toHaveAttribute('sandbox', 'allow-scripts')
    await expect(iframe).toHaveAttribute('src', /\/api\/artifacts\/.+\/html$/)
    const frame = page.frameLocator('[data-testid="preview-iframe"]')
    await expect(frame.locator('.root-shell')).toBeVisible()
    await expect(frame.locator('#right-panel')).toBeAttached()
    await expect(frame.locator('body')).toHaveAttribute('data-case', 'normal')

    // CASE 전환: 부모의 버튼 → postMessage → iframe body[data-case]
    await page.getByTestId('case-button-empty').click()
    await expect(frame.locator('body')).toHaveAttribute('data-case', 'empty')
    await expect(page.getByTestId('case-button-empty')).toHaveClass(/active/)
    // 기기 폭 전환
    await page.getByTestId('device-mobile').click()
    await expect(iframe).toHaveCSS('width', '420px')
    await page.getByTestId('device-desktop').click()
    await expect(iframe).toHaveCSS('width', '1280px')

    // iframe 안의 요소 클릭 → 코멘트 폼에 요소 id·CASE 채움
    const target = frame.locator('.screen-wrap [data-element-id][data-kind="element"]').first()
    const elementId = await target.getAttribute('data-element-id')
    const sectionId = await target.getAttribute('data-section-id')
    expect(elementId).toBeTruthy()
    await target.click()
    await expect(page.getByTestId('comment-element-id')).toHaveValue(elementId ?? '')
    await expect(page.getByTestId('comment-section-id')).toHaveValue(sectionId ?? '')
    await expect(page.getByTestId('comment-case-id')).toHaveValue('empty')

    await page.getByTestId('comment-author').fill('e2e 디자이너')
    await page.getByTestId('comment-role').selectOption('designer')
    await page.getByTestId('comment-text').fill(`${elementId} 라벨을 "e2e 변경 라벨"로 바꿔주세요`)
    await page.getByTestId('comment-blocking').check()
    await page.getByTestId('comment-save').click()
    const item = page.getByTestId('comment-item')
    await expect(item).toHaveCount(1)
    await expect(item).toContainText('디자이너')
    await expect(item).toContainText('e2e 디자이너')
    await expect(item).toContainText('차단')
    await expect(item).toContainText('e2e 변경 라벨')
    await expect(item).toHaveAttribute('data-status', 'open')
    commentId = (await item.getAttribute('data-comment-id')) ?? ''
    expect(commentId).not.toBe('')
    await expect(page.locator('[data-testid="revision-row"][data-revision-no="1"]')).toContainText('1')

    // 검증 결과: V1·V2·V3 가 모두 pass (실행하지 않은 검사를 통과로 표시하지 않으므로 not_run 도 없어야 한다)
    // 검증은 오른쪽 칸의 「검증」 탭에 있다 (코멘트·검증·수정이 한 칸을 나눠 쓴다)
    await page.getByTestId('side-tab-validation').click()
    const rows = page.getByTestId('validation-row')
    await expect(rows).not.toHaveCount(0)
    for (const id of ['V1.schema', 'V2.shell', 'V3.console_errors', 'V3.case_switch']) {
      await expect(page.locator(`[data-testid="validation-row"][data-check-id="${id}"]`), `검증 ${id}`).toHaveAttribute('data-status', 'pass')
    }
    const statuses = await rows.evaluateAll((els) => els.map((el) => `${el.getAttribute('data-check-id')}=${el.getAttribute('data-status')}`))
    const nonPass = statuses.filter((s) => /^V[123]\./.test(s) && !s.endsWith('=pass'))
    expect(nonPass, `V1·V2·V3 중 pass 가 아닌 검사: ${nonPass.join(', ')}`).toEqual([])
  })

  // ---------------------------------------------------------------- (5) 수정 요청
  let secondRevisionId = ''
  await test.step('수정 요청 — 코멘트 선택 → AI 수정 프롬프트 → 단건 수정 실행 → revision 2 → 코멘트 resolved', async () => {
    await page.getByTestId('side-tab-comments').click()
    await page.getByTestId('comment-select').check()
    await page.getByTestId('side-tab-edit').click()
    await page.getByTestId('draft-button').click()
    await expect(page.getByTestId('draft-rationale')).toContainText('코멘트 1건')
    const prompt = page.getByTestId('edit-prompt')
    await expect(prompt).not.toHaveValue('')
    await expect(prompt).toHaveValue(/SAMPLE-quote-list/)
    await expect(prompt).toHaveValue(/e2e 변경 라벨/)
    await page.getByTestId('run-edit-button').click()
    await expect(page).toHaveURL(/job=/)
    const editJobId = hashQuery(page.url(), 'job') ?? ''
    expect(editJobId).not.toBe('')
    expect(editJobId).not.toBe(firstJobId)
    await expectJobSucceeded(page, JOB_TIMEOUT_MS)
    await page.getByTestId('job-success-link').click()
    await expect(page).toHaveURL(/review\?rev=/)
    secondRevisionId = hashQuery(page.url(), 'rev') ?? ''
    expect(secondRevisionId).not.toBe('')
    expect(secondRevisionId).not.toBe(firstRevisionId)
    await expect(page.getByTestId('revision-row')).toHaveCount(2)
    await expect(page.locator('[data-testid="revision-row"][data-revision-no="2"]')).toHaveAttribute('data-selected', 'true')
    await expect(page.locator('[data-testid="revision-row"][data-revision-no="2"]')).toHaveAttribute('data-revision-id', secondRevisionId)
    // 새 revision 의 미리보기가 로드된다
    await expect(page.frameLocator('[data-testid="preview-iframe"]').locator('.root-shell')).toBeVisible()

    // revision 1 의 코멘트는 resolved (해결 revision = 2)
    // 버전 pill 이 곧 라디오다(동그라미는 감춰져 있다) — pill 을 누르고, 라디오가 실제로 켜졌는지 단언한다.
    // 해시 변경이 비동기라 check() 대신 click() 후 상태를 본다.
    const rev1 = page.locator('[data-testid="revision-row"][data-revision-no="1"]')
    const rev1Radio = rev1.getByTestId('revision-select')
    await rev1.click()
    await expect(page).toHaveURL(new RegExp(`rev=${firstRevisionId}`))
    await expect(rev1Radio).toBeChecked()
    await expect(page.locator('[data-testid="revision-row"][data-revision-no="1"]')).toHaveAttribute('data-selected', 'true')
    const resolved = page.locator(`[data-testid="comment-item"][data-comment-id="${commentId}"]`)
    await expect(resolved).toHaveAttribute('data-status', 'resolved')
    await expect(resolved).toContainText('해결')
    await expect(resolved).toContainText(secondRevisionId)
    const rev1Api = (await (await request.get(`/api/revisions/${firstRevisionId}`)).json()) as { comments: Array<{ id: string; status: string; resolved_by_revision_id?: string }> }
    expect(rev1Api.comments.find((c) => c.id === commentId)).toMatchObject({ status: 'resolved', resolved_by_revision_id: secondRevisionId })
  })

  // ---------------------------------------------------------------- (6) 완료·내보내기
  let exportPath = ''
  await test.step('완료 — 차단 코멘트 0 → 완료(v1.0) → 파일 목록·index.html·내보내기 폴더 6파일', async () => {
    await page.goto(`/#/screens/${listScreen.id}/approve?rev=${secondRevisionId}`)
    await expect(page.getByTestId('open-blocking')).toHaveText('0건')
    await expect(page.getByTestId('precheck')).toContainText('승인 가능')
    await page.getByTestId('approver').fill('e2e 기획자')
    await page.getByTestId('approve-button').click()
    const result = page.getByTestId('export-result')
    await expect(result).toBeVisible()
    await expect(page.getByTestId('export-version')).toHaveText('v1.0')
    await expect(page.getByTestId('export-file')).toHaveCount(EXPORT_FILES.length)
    for (const name of ['index.html', 'manifest.json']) await expect(page.locator(`[data-testid="export-file"][data-path="${name}"]`)).toHaveCount(1)
    await expect(page.getByTestId('design-handoff')).toBeVisible()
    await expect(page.getByTestId('handoff-revision-id')).toHaveText(secondRevisionId)
    exportPath = (await page.getByTestId('export-path').textContent())?.trim() ?? ''
    expect(exportPath).toMatch(/SAMPLE-quote-list\/v1\.0$/)

    const indexUrl = `/exports/${exportPath}/index.html`
    await expect(page.getByTestId('open-index')).toHaveAttribute('href', indexUrl)
    const indexRes = await request.get(indexUrl)
    expect(indexRes.status(), `GET ${indexUrl}`).toBe(200)
    const html = await indexRes.text()
    expect(html).toContain('root-shell')
    expect(html).toContain('right-panel')
    const manifest = (await (await request.get(`/exports/${exportPath}/manifest.json`)).json()) as { version: string; design_handoff: { screen_revision_id: string }; files: Array<{ path: string }> }
    expect(manifest.version).toBe('1.0')
    expect(manifest.design_handoff.screen_revision_id).toBe(secondRevisionId)
    expect(listExportFiles(exportPath)).toEqual(EXPORT_FILES)

    // 홈 목록에 완료·v1.0 이 반영된다
    await page.goto('/#/advanced')
    const row = page.locator('[data-testid="screen-row"][data-external-id="SAMPLE-quote-list"]')
    await expect(row).toContainText('완료')
    await expect(row).toContainText('1.0')
  })

  // ---------------------------------------------------------------- (7) 부정 경로
  await test.step('승인된 화면은 다시 승인할 수 없다 — 화면은 완료로만 말하고, 서버가 거부한다', async () => {
    await page.goto(`/#/screens/${listScreen.id}/approve?rev=${secondRevisionId}`)
    await expect(page.locator('.notice', { hasText: '이미 완료(v1.0)' })).toBeVisible()
    // 화면은 완료 사실만 적는다 — 늘 실패할 버튼을 남겨 두지 않는다.
    await expect(page.getByTestId('precheck')).toContainText('완료됨')
    await expect(page.getByTestId('approve-button')).toHaveCount(0)
    await expect(page.getByTestId('approver')).toHaveCount(0)
    await expect(page.getByTestId('export-result')).toHaveCount(0)
    // 게이트는 화면이 아니라 서버에 있다 — API 로 직접 다시 눌러도 거부한다.
    const again = await request.post(`/api/screens/${listScreen.id}/approvals`, { data: { revision_id: secondRevisionId, approver: 'e2e 기획자' } })
    expect(again.status()).toBe(400)
    const body = (await again.json()) as { reasons: Array<{ code: string; message: string }> }
    expect(body.reasons.map((r) => r.code)).toContain('approval.screen_already_approved')
    expect(body.reasons.map((r) => r.message).join(' ')).toContain('이미 v1.0')
  })

  expect(consoleErrors, `페이지 오류 없음: ${consoleErrors.join(' | ')}`).toEqual([])
})
