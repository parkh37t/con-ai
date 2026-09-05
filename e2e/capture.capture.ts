/**
 * 화면 캡처 전용 — 검증 테스트가 아니다. `CAPTURE=1 pnpm exec playwright test e2e/capture.capture.ts` 로 실행하면
 * 세로 조각 흐름을 따라가며 `.local/captures/` 에 PNG 를 남긴다(홈, 포트폴리오, 생성 작업대, 검토, 완료, 내보낸 HTML).
 * CAPTURE 가 없으면 건너뛴다(검사 결과로 세지 않는다).
 */
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { expectJobSucceeded, loadSeedProject, REPO_ROOT, screenByExternalId } from './helpers.js'

const OUT = resolve(REPO_ROOT, '.local', 'captures')
// playwright.config.ts 의 testMatch 가 CAPTURE=1 일 때만 *.capture.ts 를 포함한다

test('세로 조각 화면 캡처', async ({ page, request }) => {
  mkdirSync(OUT, { recursive: true })
  await page.setViewportSize({ width: 1440, height: 900 })
  const shot = (name: string) => page.screenshot({ path: resolve(OUT, `${name}.png`), fullPage: true })
  const project = await loadSeedProject(request)
  const listScreen = screenByExternalId(project, 'SAMPLE-quote-list')

  await page.goto('/#/')
  await expect(page.getByTestId('screen-row')).toHaveCount(3)
  await shot('01-home')

  await page.goto('/#/references')
  await expect(page.getByTestId('ref-card')).toHaveCount(3)
  await shot('02-references')

  await page.goto(`/#/screens/${listScreen.id}/generate`)
  await page.getByTestId('purpose').fill('파트너가 견적 요청 목록을 조회하고 상태별로 검색한다')
  const req = page.getByTestId('requirement-REQ-QT-001')
  await req.locator('summary').click()
  await req.getByTestId('criterion-AC-QT-001-01').check()
  await req.getByTestId('criterion-AC-QT-001-03').check()
  await page.getByTestId('ref-card').filter({ hasText: '목록 골든' }).locator('input[type="checkbox"]').check()
  await page.getByTestId('case-empty').check()
  await page.getByTestId('case-error').check()
  await page.getByTestId('preview-button').click()
  await expect(page.getByTestId('prompt-user')).toBeVisible()
  await shot('03-generate-prompt-preview')
  await page.getByTestId('run-button').click()
  await expectJobSucceeded(page, 90_000)
  await shot('04-generate-job-succeeded')

  await page.getByTestId('job-success-link').click()
  const frame = page.frameLocator('[data-testid="preview-iframe"]')
  await expect(frame.locator('.root-shell')).toBeVisible()
  await expect(frame.locator('#right-panel')).toBeVisible()
  await expect(page.getByTestId('validation-row').first()).toBeVisible()
  await page.waitForTimeout(500)
  await shot('05-review')
  await page.getByTestId('case-button-empty').click()
  await page.waitForTimeout(300)
  await frame.locator('[data-element-id]').first().click()
  await page.getByTestId('comment-author').fill('디자이너 A')
  await page.getByTestId('comment-role').selectOption('designer')
  await page.getByTestId('comment-text').fill('검색어 입력 라벨을 "견적명"으로 바꿔주세요')
  await page.getByTestId('comment-blocking').check()
  await page.getByTestId('comment-save').click()
  await expect(page.getByTestId('comment-item')).toHaveCount(1)
  await page.getByTestId('comment-select').check()
  await page.getByTestId('draft-button').click()
  await expect(page.getByTestId('edit-prompt')).toBeVisible()
  await shot('06-review-comment-and-ai-prompt')
  await page.getByTestId('run-edit-button').click()
  await expectJobSucceeded(page, 90_000)
  await page.getByTestId('job-success-link').click()
  await expect(page.getByTestId('revision-row')).toHaveCount(2)
  const rev2 = page.locator('[data-testid="revision-row"][data-revision-no="2"]')
  const rev2Id = await rev2.getAttribute('data-revision-id')

  await page.goto(`/#/screens/${listScreen.id}/approve?rev=${rev2Id}`)
  await expect(page.getByTestId('precheck')).toContainText('승인 가능')
  await page.getByTestId('approver').fill('기획자 B')
  await page.getByTestId('approve-button').click()
  await expect(page.getByTestId('export-version')).toHaveText('v1.0')
  await shot('07-approve-export')

  const indexUrl = await page.getByTestId('open-index').getAttribute('href')
  await page.goto(`http://localhost:8787${indexUrl}`)
  await expect(page.locator('.root-shell')).toBeVisible()
  await page.waitForTimeout(300)
  await shot('08-exported-index-html')
})
