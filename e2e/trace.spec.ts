/**
 * ID 매핑 (#/trace) — 산출물 P1-05 의 추적 체인 REQ → IA → FN → SCR.
 *
 * 확인하는 것:
 * (a) 첫 화면이 갭을 정직하게 보여 준다 — 커버리지 0%, 미발번은 «(IA 코드 미발번)» 이라고 적는다.
 * (b) 사유 없이는 발번 버튼을 누를 수 없다 (서버도 같은 검사를 하지만 화면이 먼저 막는다).
 * (c) 기능 정의 → IA 발번 → FN 발번 순서로 갭을 메우면 표와 KPI 가 실제로 바뀐다.
 * (d) 세지 못하는 것을 각주에 적는다 — 0 을 「문제 없음」 으로 읽히게 두지 않는다.
 *
 * **스스로 화면을 하나 생성한 뒤 시작한다.** 시드 화면은 메뉴에 붙었을 뿐 목업이 없고, 목업 없는 화면은
 * `mapped` 로 세지 않기 때문이다. 예전에는 이 검사가 앞서 돈 다른 검사(`slice`·`simple`)가 남긴
 * revision 에 올라타 통과했다 — 혼자 돌리면 깨지는 **순서 의존**이었다.
 */
import { expect, test } from '@playwright/test'

const API = 'http://localhost:8787'

interface ScreenState {
  total: number
  built: number
  isBuilt: (externalId: string) => boolean
}

/**
 * 화면 수를 **API 에서 읽는다.** 이 검사는 하나의 서버·DB 를 다른 검사들과 나눠 쓰고
 * (`playwright.config.ts` — workers 1, DB 는 실행 시작에만 초기화) 그 검사들이 화면을 더 만든다.
 * 그래서 「생성 1건」 같은 절대 수치를 박으면 혼자 돌릴 때와 전체로 돌릴 때가 달라진다.
 */
/**
 * RTM 요약을 **API 에서 읽는다.** 요구사항 총계는 다른 검사가 바꿀 수 있다 —
 * `rfp.spec.ts` 가 RFP 초안을 **채택**하면 요구사항이 늘어난다(분모 증가가 그 검사의 요점이다).
 * 그래서 「0/5」 같은 절대 수치를 박으면 검사 순서에 따라 깨진다.
 */
async function rtmSummary(request: import('@playwright/test').APIRequestContext): Promise<{ requirements_total: number; mapped: number }> {
  const projects = (await (await request.get(`${API}/api/projects`)).json()) as Array<{ id: string }>
  const report = (await (await request.get(`${API}/api/projects/${projects[0]?.id}/rtm`)).json()) as { summary: { requirements_total: number; mapped: number } }
  return report.summary
}

async function screenState(request: import('@playwright/test').APIRequestContext): Promise<ScreenState> {
  const projects = (await (await request.get(`${API}/api/projects`)).json()) as Array<{ id: string }>
  const detail = (await (await request.get(`${API}/api/projects/${projects[0]?.id}`)).json()) as {
    screens: Array<{ external_id: string; current_revision_id?: string | null }>
  }
  const built = detail.screens.filter((x) => x.current_revision_id != null)
  return {
    total: detail.screens.length,
    built: built.length,
    isBuilt: (externalId) => built.some((x) => x.external_id === externalId),
  }
}

/**
 * 「견적 목록」 화면을 실제로 생성해 둔다 (fixture 어댑터 — 모델 호출 없음).
 * 내부 UUID 는 박아 두지 않고 API 응답에서 찾는다 (ID 안팎 분리: 사람이 보는 값은 외부 ID 다).
 */
async function generateQuoteList(request: import('@playwright/test').APIRequestContext): Promise<void> {
  const projects = (await (await request.get(`${API}/api/projects`)).json()) as Array<{ id: string }>
  const projectId = projects[0]?.id
  expect(projectId, '시드 프로젝트가 있어야 한다').toBeTruthy()

  const detail = (await (await request.get(`${API}/api/projects/${projectId}`)).json()) as {
    requirements: Array<{ id: string; external_id: string }>
    screens: Array<{ id: string; external_id: string; current_revision_id?: string | null }>
  }
  const screen = detail.screens.find((s) => s.external_id === 'SAMPLE-quote-list')
  expect(screen, 'SAMPLE-quote-list 가 있어야 한다').toBeTruthy()
  if (screen!.current_revision_id != null) return // 다른 검사가 이미 만들어 두었다

  const reqIds = ['REQ-QT-001', 'REQ-QT-004'].map((x) => detail.requirements.find((r) => r.external_id === x)?.id).filter((x): x is string => x !== undefined)
  expect(reqIds).toHaveLength(2)
  // 레퍼런스는 외부 ID 가 아니라 category 로 고른다 (ReferenceDocument 에 external_id 는 없다).
  const refs = (await (await request.get(`${API}/api/projects/${projectId}/references`)).json()) as Array<{ id: string; category: string }>
  const refId = refs.find((r) => r.category === 'list')?.id
  expect(refId, '목록 레퍼런스가 있어야 한다').toBeTruthy()

  const started = await request.post(`${API}/api/screens/${screen!.id}/generation-jobs`, {
    data: {
      task_type: 'create',
      purpose: '추적 체인 검사용 목록 생성',
      requirement_ids: reqIds,
      criterion_ids: [],
      reference_ids: [refId],
      cases: ['normal'],
      keep_conditions: [],
      roles: ['partner'],
      device: 'desktop',
    },
  })
  expect(started.status(), await started.text()).toBe(202)
  const jobId = ((await started.json()) as { job_id: string }).job_id

  // 완료를 기다린다. 실패를 성공으로 넘기지 않는다 — 상태를 그대로 단언한다.
  await expect
    .poll(async () => ((await (await request.get(`${API}/api/jobs/${jobId}`)).json()) as { status: string }).status, { timeout: 60_000, intervals: [250] })
    .toBe('succeeded')
}

test('ID 매핑: 갭 확인 → 기능 정의 → 발번 → 커버리지 상승', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })

  // 목업이 있는 화면이 하나 있어야 「SCR 까지 닿았다」를 확인할 수 있다 (연결 ≠ 생성).
  await generateQuoteList(page.request)

  await test.step('첫 화면 — 갭을 정직하게 보여 준다', async () => {
    await page.goto('/#/trace')
    await expect(page.getByTestId('trace-kpis')).toBeVisible({ timeout: 30_000 })
    // 시드는 일부만 연결돼 있고 FN 이 0건이므로 완전히 이어진 체인은 없다.
    // **값 칸을 정확히** 비교한다. 예전에는 칸 전체에 toContainText('0%') 를 걸어 40%·100% 에서도
    // 통과했고(「40%」⊃「0%」), FN 은 각주의 「발번 0」 때문에 총계가 3이어도 통과했다.
    const start = await rtmSummary(page.request)
    expect(start.mapped, '시드에는 완전히 이어진 체인이 없다').toBe(0)
    await expect(page.getByTestId('trace-kpi-coverage-value')).toHaveText('0%')
    await expect(page.getByTestId('trace-kpi-coverage-note')).toHaveText(`0/${start.requirements_total} 요구사항`)
    await expect(page.getByTestId('trace-kpi-fn-value')).toHaveText('0')
    // 미발번을 빈칸으로 두지 않는다
    await expect(page.locator('[data-testid="rtm-row"]').first()).toContainText('IA 코드 미발번')
    // 100% 배너는 없고 G1 미충족 이유가 적힌다
    await expect(page.getByTestId('trace-full')).toHaveCount(0)
    await expect(page.getByTestId('trace-verdict')).toContainText('G1 추적성 미충족')
  })

  await test.step('세지 않는 것을 각주에 적는다', async () => {
    const notes = page.getByTestId('trace-footnotes')
    await expect(notes).toContainText('미실행은 통과가 아니다')
    await expect(notes).toContainText('출처')
    await expect(notes).toContainText('세지 않음')
  })

  await test.step('승인자·사유가 없으면 버튼을 누를 수 없다', async () => {
    const first = page.locator('[data-testid="trace-proposal"]').first()
    await expect(first.getByTestId('trace-approve')).toBeDisabled()
  })

  const rowStatus = (req: string) => page.locator(`[data-testid="rtm-row"][data-req="${req}"]`)

  await test.step('기능을 정의하면 REQ-QT-001 이 연결됨으로 바뀐다', async () => {
    await expect(rowStatus('REQ-QT-001')).toHaveAttribute('data-status', 'partial')
    await page.getByTestId('trace-actor').fill('e2e 기획자')
    const proposal = page.locator('[data-testid="trace-proposal"][data-kind="define_function"]').first()
    await proposal.getByTestId('trace-value').fill('견적 목록 조회')
    await proposal.getByTestId('trace-reason').fill('갭 제안 승인 (e2e)')
    await proposal.getByTestId('trace-approve').click()
    await expect(page.getByTestId('trace-notice')).toBeVisible()
    await expect(rowStatus('REQ-QT-001')).toHaveAttribute('data-status', 'mapped')
    // 기능을 추가해도 번호는 아직 없다 — 발번은 따로 누른다
    await expect(rowStatus('REQ-QT-001')).toContainText('FN 코드 미발번')
  })

  await test.step('커버리지가 실제로 오른다 (목업이 있는 화면만)', async () => {
    // 「견적 목록」 노드에는 REQ-QT-001·004 가 걸려 있어 **기능 하나로 두 건**이 함께 연결된다.
    // 분모는 다른 검사(rfp)가 바꿀 수 있으므로 API 에서 읽고, **분자가 2 로 오른 것**을 단언한다.
    await expect(rowStatus('REQ-QT-004')).toHaveAttribute('data-status', 'mapped')
    const after = await rtmSummary(page.request)
    expect(after.mapped).toBe(2)
    await expect(page.getByTestId('trace-kpi-coverage-note')).toHaveText(`2/${after.requirements_total} 요구사항`)
    await expect(page.getByTestId('trace-kpi-coverage-value')).not.toHaveText('0%')
    await expect(page.getByTestId('trace-kpi-fn-value')).toHaveText('1')
    // 생성된 화면 수를 함께 적는다 — 「연결된 화면」과 「만들어진 화면」을 한 칸에서 구분한다.
    const scr = await screenState(page.request)
    await expect(page.getByTestId('trace-kpi-scr-note')).toHaveText(`총계(분모 아님) · 생성 ${scr.built}`)
    expect(scr.built, '목업이 있는 화면이 적어도 하나 있어야 한다').toBeGreaterThan(0)
  })

  await test.step('연결만 된 화면은 기능을 정의해도 mapped 가 아니다', async () => {
    // 「견적 상세」(REQ-QT-002) 의 화면은 메뉴에 붙었지만 목업이 없다. 예전에는 이 상태도 mapped 로 셌다.
    // 전제를 조용히 넘기지 않고 단언한다 — 다른 검사가 이 화면을 만들어 버리면 여기서 그 사실이 드러난다.
    const before = await screenState(page.request)
    expect(before.isBuilt('SAMPLE-quote-detail'), '이 단계는 목업이 없는 화면이 필요하다').toBe(false)
    const define = page.locator('[data-testid="trace-proposal"][data-kind="define_function"][data-req="REQ-QT-002"]')
    await define.getByTestId('trace-value').fill('견적 상세 조회')
    await define.getByTestId('trace-reason').fill('갭 제안 승인 (e2e)')
    await define.getByTestId('trace-approve').click()
    await expect(page.getByTestId('trace-notice')).toBeVisible()
    const row = rowStatus('REQ-QT-002')
    await expect(row).toHaveAttribute('data-status', 'partial')
    await expect(row).toContainText('아직 생성되지 않았다')
    await expect(row).toContainText('(미생성)')
    // 분자가 오르지 않는다 (분모는 다른 검사가 바꿀 수 있으므로 API 에서 읽는다)
    const still = await rtmSummary(page.request)
    expect(still.mapped).toBe(2)
    await expect(page.getByTestId('trace-kpi-coverage-note')).toHaveText(`2/${still.requirements_total} 요구사항`)
    await expect(page.getByTestId('trace-footnotes')).toContainText(`목업이 만들어진 것은 ${before.built}건`)
  })

  await test.step('IA 를 발번하면 표에 코드가 나온다 (포털부터 3단)', async () => {
    const proposal = page.locator('[data-testid="trace-proposal"][data-kind="issue_ia_id"]').first()
    await proposal.getByTestId('trace-value').fill('IA-1.1.1')
    await proposal.getByTestId('trace-reason').fill('첫 발번 (e2e)')
    await proposal.getByTestId('trace-approve').click()
    await expect(page.getByTestId('trace-notice')).toContainText('IA-1.1.1')
    await expect(rowStatus('REQ-QT-001')).toContainText('IA-1.1.1')
  })

  await test.step('콘솔 오류 없음', () => {
    expect(consoleErrors, `콘솔 오류: ${consoleErrors.join(' | ')}`).toEqual([])
  })
})
