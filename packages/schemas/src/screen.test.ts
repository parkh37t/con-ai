import { describe, expect, it } from 'vitest'
import { IANode, NonUIScreenWork, ScreenPlan, ScreenRevision, ShellId, ShellProfile, shellKindOf } from './screen.js'
import { issuePaths } from './test-utils.js'

const UUID = '11111111-1111-4111-8111-111111111111'

describe('화면 (설계 §6 IANode / ScreenPlan / ScreenRevision / NonUIScreenWork, §9 shell 프로파일)', () => {
  it('shell ID 는 <포털>-page|popup 형식이며 종류를 읽을 수 있다', () => {
    expect(ShellId.safeParse('buyer-page').success).toBe(true)
    expect(ShellId.safeParse('admin-popup').success).toBe(true)
    expect(ShellId.safeParse('buyer').success).toBe(false)
    expect(shellKindOf('admin-popup')).toBe('popup')
    expect(shellKindOf('buyer-page')).toBe('page')
  })

  it('ShellProfile 의 kind 는 ID 의 종류와 일치해야 한다 (페이지 구조를 팝업에 복사하지 않음)', () => {
    const base = { project_id: UUID, portal: '수요기관', root_selector: '.popup-shell', screen_selector: '.screen-wrap', spec_panel_selector: '.spec-side' }
    expect(ShellProfile.safeParse({ ...base, id: 'buyer-popup', kind: 'popup' }).success).toBe(true)
    expect(issuePaths(ShellProfile.safeParse({ ...base, id: 'buyer-popup', kind: 'page' }))).toEqual(['kind'])
  })

  it('IA 카테고리 노드는 화면을 직접 연결하지 않는다', () => {
    const base = { id: UUID, project_id: UUID, parent_id: null, name: '주문', order: 0, portal: '수요기관' }
    expect(IANode.safeParse({ ...base, kind: 'screen', screen_plan_id: UUID }).success).toBe(true)
    expect(issuePaths(IANode.safeParse({ ...base, kind: 'category', screen_plan_id: UUID }))).toEqual(['screen_plan_id'])
  })

  it('ScreenPlan 은 기존 외부 ID 와 별칭 이력을, ScreenRevision 은 당시 ID 를 보존한다', () => {
    const plan = ScreenPlan.safeParse({
      id: UUID, project_id: UUID, external_id: 'EXAMPLE-order-list', portal: '수요기관', registry_status: 'registered', created_at: '2026-09-05T00:00:00Z',
      aliases: [{ external_id: 'EXAMPLE-order-list-old', valid_from: '2026-01-01T00:00:00Z', valid_to: '2026-09-01T00:00:00Z', reason: '파일명 변경' }],
    })
    expect(plan.success).toBe(true)
    const rev = ScreenRevision.safeParse({ id: UUID, screen_plan_id: UUID, revision: 2, external_id: 'EXAMPLE-order-list-old', purpose: '주문 목록', shell: 'buyer-page', device: 'desktop', roles: ['buyer'], created_at: '2026-09-05T00:00:00Z' })
    expect(rev.success).toBe(true)
    expect(ScreenPlan.safeParse({ id: UUID, project_id: UUID, external_id: 'x', portal: 'p', registry_status: 'done', created_at: '2026-09-05T00:00:00Z' }).success).toBe(false)
  })

  it('비UI 작업은 수용조건 연결과 담당이 필요하다 (설계 §7 제외·비UI)', () => {
    expect(NonUIScreenWork.safeParse({ id: UUID, project_id: UUID, kind: 'batch', title: '월말 집계 배치(합성)', criterion_ids: [UUID], owner: 'dev-1' }).success).toBe(true)
    expect(issuePaths(NonUIScreenWork.safeParse({ id: UUID, project_id: UUID, kind: 'batch', title: 'x', criterion_ids: [], owner: 'dev-1' }))).toEqual(['criterion_ids'])
  })
})
