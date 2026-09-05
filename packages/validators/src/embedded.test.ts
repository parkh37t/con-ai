/**
 * 렌더 HTML 의 격리 표시·postMessage 프로토콜 검사 (계약 §4).
 * 렌더러 패키지는 브라우저 의존성이 없어 Playwright 를 가진 이 패키지에서 확인한다.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { chromium, type Browser } from 'playwright'
import { ensureChromiumEnv, loadFixtureSpec, renderFixture } from './test-helpers.js'
import { launchPlan } from './v3.js'

const LONG = 60_000
let browser: Browser

beforeAll(async () => {
  ensureChromiumEnv()
  const plan = launchPlan(process.env)
  const first = plan[0]
  if (!first) throw new Error('launch plan 이 비어 있다')
  browser = await chromium.launch(first.executablePath !== undefined ? { headless: true, executablePath: first.executablePath } : { headless: true })
}, LONG)
afterAll(async () => {
  await browser?.close()
})

const PARENT_HTML =
  '<html><body><script>window.__msgs=[];window.addEventListener("message",function(e){window.__msgs.push(e.data)});</script>' +
  '<iframe id="f" sandbox="allow-scripts" style="width:1200px;height:800px"></iframe></body></html>'

describe('sandbox="allow-scripts" iframe 안의 목업 (계약 §4 postMessage)', () => {
  it(
    '부모 창이 있으면 툴바를 숨기고, 요소·설명 클릭을 con-ai:element-click 으로 보내며, set-case·highlight 를 받는다',
    async () => {
      const { html } = renderFixture(loadFixtureSpec('valid'))
      const page = await browser.newPage({ viewport: { width: 1300, height: 900 } })
      const errors: string[] = []
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text())
      })
      page.on('pageerror', (e) => errors.push(e.message))
      await page.setContent(PARENT_HTML)
      await page.evaluate((h) => {
        const f = document.getElementById('f') as HTMLIFrameElement
        f.srcdoc = h
      }, html)
      const frame = page.frames()[1]
      if (!frame) throw new Error('iframe 프레임이 없다')
      await frame.waitForSelector('.screen-wrap')

      expect(await frame.evaluate(() => document.body.classList.contains('is-embedded'))).toBe(true)
      expect(await frame.locator('[data-toolbar]').isHidden()).toBe(true)

      await frame.click('[data-element-id="period"] .field-label')
      await frame.click('[data-desc-key="sections"] [data-element-id="order-table"]')
      const send = (msg: Record<string, string>) =>
        page.evaluate((m) => {
          const f = document.getElementById('f') as HTMLIFrameElement
          f.contentWindow?.postMessage(m, '*')
        }, msg)
      await send({ type: 'con-ai:set-case', case_id: 'error' })
      await frame.waitForFunction(() => document.body.getAttribute('data-case') === 'error')
      await send({ type: 'con-ai:highlight', element_id: 'download-button' })
      await frame.waitForSelector('.is-highlighted')
      await frame.click('[data-element-id="search-button"] button')

      const msgs = await page.evaluate(() => (window as unknown as { __msgs: unknown[] }).__msgs)
      expect(msgs).toEqual([
        { type: 'con-ai:element-click', element_id: 'period', section_id: 'search', case_id: 'normal', target: 'screen', display_no: 'b' },
        { type: 'con-ai:element-click', element_id: 'order-table', section_id: 'results', case_id: 'normal', target: 'description', display_no: 'a' },
        { type: 'con-ai:element-click', element_id: 'search-button', section_id: 'search', case_id: 'error', target: 'screen', display_no: 'd' },
      ])
      expect(await frame.locator('tr[data-row]').count()).toBe(0)
      expect(await frame.locator('[data-messages] [data-message-id="msg-error"]').count()).toBe(1)
      expect(await frame.locator('[data-region="screen"] .is-highlighted[data-element-id="download-button"]').count()).toBe(1)
      expect(await frame.locator('[data-region="description"] .is-highlighted[data-element-id="download-button"]').count()).toBeGreaterThanOrEqual(1)
      expect(errors).toEqual([])
      await page.close()
    },
    LONG,
  )

  it(
    '부모 창이 없으면 툴바가 보이고 CASE 버튼·폭 토글로 조작한다',
    async () => {
      const { html } = renderFixture(loadFixtureSpec('valid'))
      const page = await browser.newPage({ viewport: { width: 1300, height: 900 } })
      await page.setContent(html)
      expect(await page.locator('[data-toolbar]').isVisible()).toBe(true)
      expect(await page.evaluate(() => document.body.classList.contains('is-embedded'))).toBe(false)
      await page.click('[data-device-toggle="mobile"]')
      expect(await page.getAttribute('[data-shell-root]', 'data-device')).toBe('mobile')
      expect(await page.locator('.screen-wrap').evaluate((el) => el.getBoundingClientRect().width)).toBeLessThanOrEqual(420)
      await page.click('button[data-case="empty"]')
      expect(await page.getAttribute('body', 'data-case')).toBe('empty')
      expect(await page.locator('[data-messages] [data-message-id="msg-empty"]').count()).toBe(1)
      await page.close()
    },
    LONG,
  )
})
