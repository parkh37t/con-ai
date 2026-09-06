/**
 * ID 매핑 (#/trace) — 산출물 P1-05 의 추적 체인 REQ → IA → FN → SCR.
 *
 * 확인하는 것:
 * (a) 첫 화면이 갭을 정직하게 보여 준다 — 커버리지 0%, 미발번은 «(IA 코드 미발번)» 이라고 적는다.
 * (b) 사유 없이는 발번 버튼을 누를 수 없다 (서버도 같은 검사를 하지만 화면이 먼저 막는다).
 * (c) 기능 정의 → IA 발번 → FN 발번 순서로 갭을 메우면 표와 KPI 가 실제로 바뀐다.
 * (d) 세지 못하는 것을 각주에 적는다 — 0 을 「문제 없음」 으로 읽히게 두지 않는다.
 */
import { expect, test } from '@playwright/test'

test('ID 매핑: 갭 확인 → 기능 정의 → 발번 → 커버리지 상승', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })

  await test.step('첫 화면 — 갭을 정직하게 보여 준다', async () => {
    await page.goto('/#/trace')
    await expect(page.getByTestId('trace-kpis')).toBeVisible({ timeout: 30_000 })
    // 시드는 일부만 연결돼 있고 FN 이 0건이므로 완전히 이어진 체인은 없다.
    await expect(page.getByTestId('trace-kpi-coverage')).toContainText('0%')
    await expect(page.getByTestId('trace-kpi-fn')).toContainText('0')
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

  await test.step('커버리지가 실제로 오른다', async () => {
    // 「견적 목록」 노드에는 REQ-QT-001·004 가 걸려 있어 기능 하나로 두 건이 함께 연결된다 → 2/5
    await expect(rowStatus('REQ-QT-004')).toHaveAttribute('data-status', 'mapped')
    await expect(page.getByTestId('trace-kpi-coverage')).toContainText('40%')
    await expect(page.getByTestId('trace-kpi-coverage')).toContainText('2/5')
    await expect(page.getByTestId('trace-kpi-fn')).toContainText('1')
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
