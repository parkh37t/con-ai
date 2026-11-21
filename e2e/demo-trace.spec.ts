/**
 * 정적 데모(배포 주소)의 ID 매핑 — `https://<pages>/#/trace` 가 서버 없이 실제로 동작하는지 확인한다.
 * API 서버는 띄우지 않는다 (playwright.demo.config.ts). 여기서 동작하면 브라우저 안에서 동작한 것이다.
 *
 * 확인하는 것:
 * (a) 이 화면이 브라우저 안에서 도는 사실을 먼저 알린다 (더미와 실제를 구분해 적는다).
 * (b) 발번 제안에 계산된 초안 번호가 들어 있고, 사유 없이는 누를 수 없다.
 * (c) 기능 정의 → IA 발번을 거치면 커버리지와 표가 실제로 바뀐다.
 * (d) **연결만 된 화면은 mapped 가 아니다** — 목업이 없으면 커버리지 분자에 들어가지 않는다.
 * (e) **새로고침 후에도 남는다** — 이 브라우저에 저장되기 때문이다 (CLAUDE.md).
 */
import { expect, test } from '@playwright/test'

test('정적 데모 ID 매핑: 갭 → 기능 정의 → IA 발번 → 새로고침 후 유지', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))

  // 이전 검사가 남긴 브라우저 저장분을 지우고 스냅샷 상태에서 시작한다.
  await page.goto('#/')
  await page.evaluate(() => localStorage.clear())

  await test.step('브라우저 안에서 돈다는 사실을 먼저 적는다', async () => {
    await page.goto('#/trace')
    await expect(page.getByTestId('trace-kpis')).toBeVisible({ timeout: 30_000 })
    const note = page.getByTestId('trace-demo-note')
    await expect(note).toContainText('이 브라우저')
    await expect(note).toContainText('같은 규칙')
  })

  const rowStatus = (req: string) => page.locator(`[data-testid="rtm-row"][data-req="${req}"]`)

  await test.step('첫 화면 — 갭을 정직하게 보여 준다', async () => {
    // 값 칸을 정확히 비교한다 (칸 전체 비교는 「40%」가 「0%」를 포함해 거짓으로 통과했다).
    await expect(page.getByTestId('trace-kpi-coverage-value')).toHaveText('0%')
    await expect(page.getByTestId('trace-kpi-fn-value')).toHaveText('0')
    await expect(page.locator('[data-testid="rtm-row"]').first()).toContainText('IA 코드 미발번')
    await expect(page.getByTestId('trace-full')).toHaveCount(0)
    await expect(rowStatus('REQ-QT-001')).toHaveAttribute('data-status', 'partial')
  })

  await test.step('발번 제안에 계산된 초안 번호가 들어 있고, 사유 없이는 누를 수 없다', async () => {
    const issue = page.locator('[data-testid="trace-proposal"][data-kind="issue_ia_id"]').first()
    await expect(issue.getByTestId('trace-value')).toHaveValue(/^IA-\d+(\.\d+)*$/)
    await expect(issue.getByTestId('trace-approve')).toBeDisabled()
  })

  await test.step('기능을 정의하면 체인이 SCR 까지 닿는다', async () => {
    await page.getByTestId('trace-actor').fill('e2e 기획자')
    const define = page.locator('[data-testid="trace-proposal"][data-kind="define_function"]').first()
    await define.getByTestId('trace-value').fill('견적 목록 조회')
    await define.getByTestId('trace-reason').fill('갭 제안 승인 (정적 데모 e2e)')
    await define.getByTestId('trace-approve').click()
    await expect(page.getByTestId('trace-notice')).toBeVisible()
    await expect(rowStatus('REQ-QT-001')).toHaveAttribute('data-status', 'mapped')
    // 기능을 추가해도 번호는 아직 없다 — 발번은 따로 누른다
    await expect(rowStatus('REQ-QT-001')).toContainText('FN 코드 미발번')
    await expect(page.getByTestId('trace-kpi-coverage-value')).toHaveText('40%')
  })

  await test.step('화면이 아직 만들어지지 않았으면 기능을 정의해도 mapped 가 아니다', async () => {
    // 스냅샷에서 「견적 상세」(REQ-QT-002) 의 화면은 메뉴에만 붙어 있고 목업이 없다.
    // 예전에는 이 상태에서도 mapped 로 세어 커버리지가 거짓으로 올랐다.
    const define = page.locator('[data-testid="trace-proposal"][data-kind="define_function"][data-req="REQ-QT-002"]')
    await define.getByTestId('trace-value').fill('견적 상세 조회')
    await define.getByTestId('trace-reason').fill('갭 제안 승인 (정적 데모 e2e)')
    await define.getByTestId('trace-approve').click()
    await expect(page.getByTestId('trace-notice')).toBeVisible()
    const row = rowStatus('REQ-QT-002')
    await expect(row).toHaveAttribute('data-status', 'partial')
    await expect(row).toContainText('아직 생성되지 않았다')
    await expect(row).toContainText('(미생성)')
    // 분자가 오르지 않는다 — 40% 그대로다.
    await expect(page.getByTestId('trace-kpi-coverage-value')).toHaveText('40%')
    // 세지 못한 것을 각주에 자백한다 (화면 3건 중 생성 1건).
    await expect(page.getByTestId('trace-kpi-scr-note')).toHaveText('총계(분모 아님) · 생성 1')
    await expect(page.getByTestId('trace-footnotes')).toContainText('목업이 만들어진 것은 1건')
  })

  let issuedId = ''
  await test.step('IA 를 발번하면 표에 코드가 나온다', async () => {
    const issue = page.locator('[data-testid="trace-proposal"][data-kind="issue_ia_id"]').first()
    issuedId = await issue.getByTestId('trace-value').inputValue()
    expect(issuedId).not.toBe('')
    await issue.getByTestId('trace-reason').fill('첫 발번 (정적 데모 e2e)')
    await issue.getByTestId('trace-approve').click()
    await expect(page.getByTestId('trace-notice')).toContainText(issuedId)
    // 초안 번호를 그대로 승인했으므로 «다시 계산한 값이 다르다» 경고는 나오지 않는다.
    await expect(page.getByTestId('trace-notice')).not.toContainText('확인해 주세요')
    await expect(rowStatus('REQ-QT-001')).toContainText(issuedId)
  })

  await test.step('새로고침해도 결과가 남는다 (이 브라우저에 저장된다)', async () => {
    await page.reload()
    await expect(page.getByTestId('trace-kpis')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('trace-kpi-coverage-value')).toHaveText('40%')
    await expect(rowStatus('REQ-QT-001')).toContainText(issuedId)
    await expect(rowStatus('REQ-QT-001')).toHaveAttribute('data-status', 'mapped')
  })

  await test.step('가로로 넘치지 않고 콘솔 오류가 없다', async () => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(overflow, '가로 스크롤이 생겼다').toBe(false)
    expect(consoleErrors, `콘솔 오류: ${consoleErrors.join(' | ')}`).toEqual([])
  })
})
