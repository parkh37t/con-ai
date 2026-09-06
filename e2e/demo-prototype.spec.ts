/**
 * 정적 데모(배포 주소)의 프로토타입 4단계 — `#/prototype` 에서 ① AS-IS → ② 생성 → ③ 검토·수정 → ④ 완료 가
 * **서버 없이 실제로** 끝까지 도는지 확인한다. API 서버는 띄우지 않는다 (playwright.demo.config.ts).
 *
 * 이 검사가 지키는 것
 * - 각 단계는 화면의 버튼으로 실행한다 (프로토타입 전용 뒷문을 쓰지 않는다).
 * - ④ 완료는 **필수 검사(V3 포함)가 실제로 통과해야** 넘어간다 — 통과를 흉내내지 않는다.
 * - 새로고침해도 진행 기록이 남는다.
 */
import { expect, test, type Locator, type Page } from '@playwright/test'

const STEP_TIMEOUT_MS = 120_000

async function runStep(page: Page, id: string): Promise<Locator> {
  const card = page.locator(`[data-testid="proto-step"][data-step="${id}"]`)
  await expect(card).toHaveAttribute('data-status', 'ready')
  await card.getByTestId('proto-run').click()
  // 실패하면 그 자리에서 이유를 보이고 끝낸다 (조용히 기다리지 않는다).
  await expect
    .poll(
      async () => {
        if ((await page.getByTestId('proto-error').count()) > 0) return `error: ${await page.getByTestId('proto-error').innerText()}`
        return await card.getAttribute('data-status')
      },
      { timeout: STEP_TIMEOUT_MS, message: `단계 ${id} 가 끝나지 않았다` },
    )
    .toBe('done')
  return card
}

test('정적 데모 프로토타입: 4단계를 끝까지 실행하고 새로고침해도 남는다', async ({ page }) => {
  test.setTimeout(300_000)
  const consoleErrors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))

  await page.goto('#/')
  await page.evaluate(() => localStorage.clear())
  await page.goto('#/prototype')
  await expect(page.getByTestId('proto-status')).toBeVisible({ timeout: 30_000 })

  await test.step('처음에는 첫 단계만 누를 수 있다', async () => {
    await expect(page.getByTestId('proto-progress')).toContainText('0단계')
    // 더미 어댑터라는 사실을 숨기지 않는다.
    await expect(page.getByTestId('proto-adapter')).toContainText('더미 어댑터')
    await expect(page.locator('[data-testid="proto-step"]')).toHaveCount(4)
    await expect(page.locator('[data-testid="proto-step"][data-step="generate"]')).toHaveAttribute('data-status', 'blocked')
  })

  await test.step('① AS-IS — 샘플 대상에서 페인포인트를 실제로 만든다', async () => {
    const card = await runStep(page, 'asis')
    await expect(card.getByTestId('proto-result')).toContainText('페인포인트')
    await expect(page.getByTestId('proto-note')).toContainText('페인포인트')
  })

  await test.step('② 생성 — 새 화면과 revision 1 을 만든다', async () => {
    const card = await runStep(page, 'generate')
    await expect(card.getByTestId('proto-result')).toContainText('설계서 열기')
    await expect(page.getByTestId('proto-note')).toContainText('revision 1')
  })

  await test.step('③ 검토·수정 — 코멘트를 반영해 revision 2 를 만든다', async () => {
    const card = await runStep(page, 'review')
    await expect(card.getByTestId('proto-result')).toContainText('검토 화면')
    await expect(page.getByTestId('proto-note')).toContainText('코멘트 2건')
  })

  await test.step('④ 완료 — 필수 검사가 실제로 통과해야 v1.0 이 된다', async () => {
    const card = await runStep(page, 'approve')
    await expect(card.getByTestId('proto-result')).toContainText('v1.0')
    await expect(card.getByTestId('proto-result')).toContainText('산출물 6개')
    await expect(page.getByTestId('proto-complete')).toBeVisible()
    await expect(page.getByTestId('proto-progress')).toContainText('모두 끝났습니다')
  })

  await test.step('완료 화면이 스스로와 모순되지 않는다 — 완료됨 표시 · 완료 폼 없음 · 승인 산출물 안내', async () => {
    await page.locator('[data-testid="proto-step"][data-step="approve"]').getByTestId('proto-result').click()
    await expect(page.getByTestId('precheck')).toContainText('완료됨')
    await expect(page.getByTestId('precheck')).toContainText('v1.0')
    // 이미 완료된 화면에 완료 버튼을 남겨 두지 않는다.
    await expect(page.getByTestId('approve-button')).toHaveCount(0)
    // 승인된 산출물을 「아직 승인이 아니다」 라고 적지 않는다.
    await expect(page.getByTestId('browser-export-note')).toContainText('승인(v1.0) 산출물')
  })

  await test.step('새로고침해도 진행 기록이 남는다', async () => {
    await page.goto('#/prototype')
    await expect(page.getByTestId('proto-progress')).toContainText('모두 끝났습니다', { timeout: 30_000 })
    await expect(page.locator('[data-testid="proto-step"][data-step="approve"]')).toHaveAttribute('data-status', 'done')
  })

  await test.step('가로로 넘치지 않고 콘솔 오류가 없다', async () => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(overflow, '가로 스크롤이 생겼다').toBe(false)
    expect(consoleErrors, `콘솔 오류: ${consoleErrors.join(' | ')}`).toEqual([])
  })
})
