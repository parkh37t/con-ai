import { describe, expect, it } from 'vitest'
import * as externalIdModule from './external-id.js'
import { canPromoteToRegistry, canRenameExternalId, checkExternalIdUnique, externalIdAt, planImport, promoteToRegistry, renameExternalId, resolveExternalId } from './external-id.js'
import { DomainRuleError } from './result.js'
import { PROJECT, T1, captureRuleError, screenPlan, uuid } from './test-fixtures.js'

const change = { new_external_id: 'EXAMPLE-screen-1-renamed', reason: '파일명 변경(합성 사례)', actor: 'planner-1', at: T1 }

describe('외부 화면 ID 규칙 (설계 §6; 보고서 §3, §4)', () => {
  it('프로젝트 내 현재 외부 ID 는 유일해야 한다 — 공식 레지스트리와 겹치면 거부하고 임시 레코드와 겹쳐도 거부한다', () => {
    const registry = [screenPlan(1), screenPlan(2, { external_id: 'EXAMPLE-dup', registry_status: 'duplicate_id' })]
    expect(checkExternalIdUnique(registry, PROJECT, 'EXAMPLE-screen-9').allowed).toBe(true)
    const dup = checkExternalIdUnique(registry, PROJECT, 'EXAMPLE-screen-1')
    expect(dup.allowed).toBe(false)
    expect(dup.reasons.map((r) => r.code)).toEqual(['external_id.duplicate'])
    expect(checkExternalIdUnique(registry, PROJECT, 'EXAMPLE-dup').reasons.map((r) => r.code)).toEqual(['external_id.duplicate_pending'])
    // 다른 프로젝트의 같은 ID 는 충돌이 아니다 (유일성은 프로젝트 단위)
    expect(checkExternalIdUnique(registry, uuid(2), 'EXAMPLE-screen-1').allowed).toBe(true)
    expect(checkExternalIdUnique(registry, PROJECT, 'has space').reasons.map((r) => r.code)).toEqual(['external_id.invalid'])
  })

  it('중복 수입은 별도 임시 레코드(duplicate_id)로 분리하고 공식 레지스트리에 합치지 않는다 — 서로 다른 경로 그룹은 표시된다', () => {
    const existing = [screenPlan(1)]
    const plan = planImport(existing, PROJECT, [
      { external_id: 'EXAMPLE-screen-1', path: 'example/other/screen-1.html', portal: '수요기관', source_ref: 'INDEX:10' }, // 기존 레코드와 충돌, 경로 다름
      { external_id: 'EXAMPLE-screen-7', path: 'example/a/screen-7.html', portal: '관리자', source_ref: 'INDEX:11' },
      { external_id: 'EXAMPLE-screen-7', path: 'example/a/screen-7.html', portal: '관리자', source_ref: 'INDEX:12' }, // 같은 경로라도 병합하지 않음
      { external_id: 'EXAMPLE-screen-8', path: 'example/a/screen-8.html', portal: '관리자' },
      { external_id: 'EXAMPLE-screen-9', portal: '관리자', source_ref: 'INDEX:14' }, // 경로 없음
      { external_id: 'bad id', path: 'x.html', portal: '관리자' },
    ])
    expect(plan.register.map((r) => r.external_id)).toEqual(['EXAMPLE-screen-8'])
    expect(plan.duplicate_groups.map((g) => [g.external_id, g.rows.length, g.existing.length, g.paths_differ])).toEqual([
      ['EXAMPLE-screen-1', 1, 1, true],
      ['EXAMPLE-screen-7', 2, 0, false],
    ])
    expect(plan.path_unresolved.map((r) => r.external_id)).toEqual(['EXAMPLE-screen-9'])
    expect(plan.invalid).toHaveLength(1)
    // 수입 계획 어디에도 새로 만든 ID 가 없다 — 새 SP 번호를 강제하지 않는다
    const allIds = [...plan.register, ...plan.duplicate_groups.flatMap((g) => g.rows), ...plan.path_unresolved].map((r) => r.external_id)
    expect(allIds.every((id) => id.startsWith('EXAMPLE-screen-'))).toBe(true)
  })

  it('과거 별칭과 같은 ID 의 수입 행은 연결 후보(import_candidate)로만 두고 자동 연결하지 않는다 (보고서 §4)', () => {
    const renamed = renameExternalId([screenPlan(1)], screenPlan(1), change)
    const plan = planImport([renamed], PROJECT, [{ external_id: 'EXAMPLE-screen-1', path: 'example/screen-1.html', portal: '수요기관' }])
    expect(plan.register).toHaveLength(0)
    expect(plan.alias_collisions.map((c) => [c.row.external_id, c.plan.id, c.alias.external_id])).toEqual([['EXAMPLE-screen-1', renamed.id, 'EXAMPLE-screen-1']])
  })

  it('같은 ID 의 임시 레코드가 남아 있거나 경로가 없으면 공식 레지스트리로 승격할 수 없다', () => {
    const a = screenPlan(3, { external_id: 'EXAMPLE-dup', registry_status: 'duplicate_id', path: 'example/a.html' })
    const b = screenPlan(4, { external_id: 'EXAMPLE-dup', registry_status: 'duplicate_id', path: 'example/b.html' })
    const registry = [screenPlan(1), a, b]
    expect(canPromoteToRegistry(registry, a).reasons.map((r) => r.code)).toEqual(['external_id.duplicate_pending'])
    expect(() => promoteToRegistry(registry, a)).toThrow(DomainRuleError)
    // 사람이 b 를 다른 ID 로 개명(실제 화면 구분)한 뒤에는 a 를 등록할 수 있다
    const bRenamed = renameExternalId(registry, b, { new_external_id: 'EXAMPLE-dup-popup', reason: '실제 화면 구분: 팝업 화면', actor: 'lead-1', at: T1 })
    expect(promoteToRegistry([screenPlan(1), a, bRenamed], a).registry_status).toBe('registered')
    const noPath = screenPlan(5, { registry_status: 'path_resolution_required', path: undefined })
    expect(canPromoteToRegistry([noPath], noPath).reasons.map((r) => r.code)).toEqual(['external_id.path_required'])
  })

  it('사유·행위자·시점 없는 개명은 실패한다 (명시적 변경 작업)', () => {
    const plan = screenPlan(1)
    expect(canRenameExternalId([plan], plan, { ...change, reason: '  ' }).reasons.map((r) => r.code)).toEqual(['external_id.rename.reason_required'])
    expect(canRenameExternalId([plan], plan, { ...change, actor: '' }).reasons.map((r) => r.code)).toEqual(['external_id.rename.actor_required'])
    expect(canRenameExternalId([plan], plan, { ...change, at: '어제' }).reasons.map((r) => r.code)).toEqual(['external_id.rename.at_required'])
    expect(canRenameExternalId([plan], plan, { ...change, new_external_id: 'EXAMPLE-screen-1' }).reasons.map((r) => r.code)).toEqual(['external_id.rename.no_change'])
    expect(() => renameExternalId([plan], plan, { ...change, reason: '' })).toThrow(DomainRuleError)
    const err = captureRuleError(() => renameExternalId([plan], plan, { ...change, reason: '', actor: '' }))
    expect(err.reasons.map((r) => r.code)).toEqual(['external_id.rename.reason_required', 'external_id.rename.actor_required'])
  })

  it('개명하면 별칭 이력이 보존되고 내부 UUID 는 바뀌지 않으며 과거 ID 로도 찾을 수 있다', () => {
    const plan = screenPlan(1)
    const renamed = renameExternalId([plan], plan, change)
    expect(renamed.id).toBe(plan.id)
    expect(renamed.external_id).toBe('EXAMPLE-screen-1-renamed')
    expect(renamed.aliases).toEqual([{ external_id: 'EXAMPLE-screen-1', path: 'example/screen-1.html', valid_from: plan.created_at, valid_to: T1, reason: '파일명 변경(합성 사례) (행위자: planner-1)' }])
    expect(plan.aliases).toEqual([]) // 원본 객체는 그대로
    expect(externalIdAt(renamed, '2026-09-03T00:00:00Z')).toBe('EXAMPLE-screen-1') // 과거 승인본 시점의 ID
    expect(externalIdAt(renamed, '2026-09-06T00:00:00Z')).toBe('EXAMPLE-screen-1-renamed')
    expect(resolveExternalId([renamed], PROJECT, 'EXAMPLE-screen-1').map((m) => m.via)).toEqual(['alias'])
    expect(resolveExternalId([renamed], PROJECT, 'EXAMPLE-screen-1-renamed').map((m) => m.via)).toEqual(['current'])
    // 개명 후 두 번째 개명: 이력이 이어진다
    const again = renameExternalId([renamed], renamed, { ...change, new_external_id: 'EXAMPLE-screen-1-v3', at: '2026-09-10T00:00:00Z' })
    expect(again.aliases.map((a) => [a.external_id, a.valid_from, a.valid_to])).toEqual([
      ['EXAMPLE-screen-1', plan.created_at, T1],
      ['EXAMPLE-screen-1-renamed', T1, '2026-09-10T00:00:00Z'],
    ])
  })

  it('경로만 옮겨도 경로 이동 기록이 남고, 개명 대상 ID 가 다른 레코드와 겹치면 거부한다', () => {
    const plan = screenPlan(1)
    const moved = renameExternalId([plan], plan, { ...change, new_external_id: plan.external_id, new_path: 'example/moved/screen-1.html', reason: '경로 이동' })
    expect(moved.external_id).toBe(plan.external_id)
    expect(moved.path).toBe('example/moved/screen-1.html')
    expect(moved.aliases.map((a) => a.path)).toEqual(['example/screen-1.html'])
    const registry = [plan, screenPlan(2)]
    expect(canRenameExternalId(registry, plan, { ...change, new_external_id: 'EXAMPLE-screen-2' }).reasons.map((r) => r.code)).toEqual(['external_id.duplicate'])
  })

  it('일괄 개명·ID 생성 API 가 없다 — 개명은 한 화면씩, 사람이 준 ID 로만 한다', () => {
    const names = Object.keys(externalIdModule)
    expect(names.filter((n) => /bulk|batch|renameAll|generate|nextId|assign/i.test(n))).toEqual([])
    expect(renameExternalId.length).toBe(3) // (registry, plan 한 건, change)
  })
})
