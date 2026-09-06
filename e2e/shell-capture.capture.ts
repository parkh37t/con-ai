/** 새 셸(진입 상단 바 · 좌측 레일 · 컨텍스트 헤더) 캡처. CAPTURE=1 로만 돈다. */
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { REPO_ROOT } from './helpers.js'

const OUT = resolve(REPO_ROOT, '.local', 'captures')

test('새 셸 캡처', async ({ page }) => {
  mkdirSync(OUT, { recursive: true })
  await page.setViewportSize({ width: 1440, height: 980 })
  const shot = (n: string) => page.screenshot({ path: resolve(OUT, `${n}.png`), fullPage: true })

  await page.goto('/#/')
  await expect(page.getByTestId('main-create')).toBeVisible()
  await shot('30-main')

  await page.goto('/#/advanced')
  await expect(page.getByTestId('workspace-rail')).toBeVisible()
  await expect(page.getByTestId('project-name')).toBeVisible()
  await shot('31-home')

  await page.goto('/#/asis')
  await expect(page.getByTestId('workspace-rail')).toBeVisible()
  await shot('32-asis')

  await page.goto('/#/new')
  await shot('33-create')
})
