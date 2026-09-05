import { describe, expect, it } from 'vitest'
import { PROCESS_STEPS, STEP_STATUS_NOW, STEP_STATUS_SERVER, stepHref, stepStatus } from './main-steps.js'

describe('메인 화면 4단계 프로세스', () => {
  it('CLAUDE.md 의 4단계를 순서대로 담는다', () => {
    expect(PROCESS_STEPS.map((s) => s.no)).toEqual([1, 2, 3, 4])
    expect(PROCESS_STEPS.map((s) => s.title)).toEqual(['AS-IS 분석', '생성', '검토', '완료·이관'])
  })

  it('카드 링크 — 생성은 만들기, AS-IS 는 분석 목록, 검토·완료는 고급 화면', () => {
    expect(PROCESS_STEPS.map((s) => stepHref(s))).toEqual(['#/asis', '#/new', '#/advanced', '#/advanced'])
  })

  it('브라우저(정적 배포) 모드에서는 서버가 필요한 단계를 "지금 가능" 으로 표시하지 않는다', () => {
    const labels = PROCESS_STEPS.map((s) => stepStatus(s, { browserMode: true }).label)
    expect(labels).toEqual([STEP_STATUS_SERVER, STEP_STATUS_NOW, STEP_STATUS_NOW, STEP_STATUS_SERVER])
    const asis = stepStatus(PROCESS_STEPS[0]!, { browserMode: true })
    expect(asis.kind).toBe('server_required')
    expect(asis.title).toContain('정적 배포')
  })

  it('서버 모드에서는 네 단계 모두 지금 가능이다 (되는 일을 못 한다고 적지 않는다)', () => {
    const statuses = PROCESS_STEPS.map((s) => stepStatus(s, { browserMode: false }))
    expect(statuses.map((s) => s.kind)).toEqual(['now', 'now', 'now', 'now'])
    expect(statuses.map((s) => s.label)).toEqual([STEP_STATUS_NOW, STEP_STATUS_NOW, STEP_STATUS_NOW, STEP_STATUS_NOW])
  })
})
