import { describe, expect, it } from 'vitest'
import { EXAMPLE_ORDER_LIST, EXAMPLE_ORDER_LIST_EXTENDED } from '@con-ai/schemas'
import { runV1, V1_CHECKS } from './v1.js'
import { REQUIRED_CHECKS } from './index.js'
import { byId, expectSchemaConform, hashOf, loadFixtureSpec, loadManifestRequiredCases, statusOf } from './test-helpers.js'

const HASH = hashOf('v1')
const required_cases = loadManifestRequiredCases()

describe('V1 명세 검사 — fixtures/screen-specs (설계 §10 V1; 개발프롬프트 첫 수용조건)', () => {
  it('manifest 의 필수 CASE 는 normal·empty·error 다', () => {
    expect(required_cases).toEqual(['normal', 'empty', 'error'])
  })

  it('valid: 네 검사 모두 pass 이고 결과는 ValidationResult 로 파싱된다', () => {
    const results = runV1(loadFixtureSpec('valid'), { required_cases, artifact_hash: HASH })
    expect(results.map((r) => r.check_id)).toEqual([...V1_CHECKS])
    expect(statusOf(results)).toEqual({ 'V1.schema': 'pass', 'V1.references': 'pass', 'V1.required_cases': 'pass', 'V1.criteria_linked': 'pass' })
    expectSchemaConform(results)
    for (const r of results) {
      expect(r.artifact_hash).toBe(HASH)
      expect(r.stage).toBe('V1')
      expect(r.required).toBe(true)
      expect(REQUIRED_CHECKS).toContain(r.check_id)
      expect(r.executed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    }
    const runIds = new Set(results.map((r) => r.validation_run_id))
    expect(runIds.size).toBe(1)
    expect(byId(results, 'V1.criteria_linked').evidence).toEqual(['수용조건 4개 모두 요소·동작 trace 에 연결'])
  })

  it('bad-mapping: V1.references 가 fail 이고 evidence 에 잘못된 경로 두 곳이 있다', () => {
    const results = runV1(loadFixtureSpec('bad-mapping'), { required_cases, artifact_hash: HASH })
    const refs = byId(results, 'V1.references')
    expect(byId(results, 'V1.schema').status).toBe('pass')
    expect(refs.status).toBe('fail')
    expect(refs.message).toContain('참조 오류 2건')
    expect(refs.evidence.map((e) => e.split(':')[0])).toEqual(['sections.1.elements.0.trace.0', 'actions.0.target'])
    expect(refs.evidence.join('\n')).toContain('EXAMPLE-AC-99')
    expect(refs.evidence.join('\n')).toContain('result-table')
    // 표의 trace 는 AC-99 로 바뀌었지만 정렬 동작(sort-orders)이 AC-02 를 여전히 가리키므로 연결 검사는 통과한다
    expect(byId(results, 'V1.criteria_linked').status).toBe('pass')
    expect(byId(results, 'V1.required_cases').status).toBe('pass')
    expectSchemaConform(results)
  })

  it('missing-case: V1.required_cases 가 empty·error 누락으로 fail, EXAMPLE-AC-03 미연결로 V1.criteria_linked 도 fail', () => {
    const results = runV1(loadFixtureSpec('missing-case'), { required_cases, artifact_hash: HASH })
    expect(statusOf(results)).toEqual({ 'V1.schema': 'pass', 'V1.references': 'pass', 'V1.required_cases': 'fail', 'V1.criteria_linked': 'fail' })
    const cases = byId(results, 'V1.required_cases')
    expect(cases.message).toBe('필수 CASE 누락: empty, error (설계 §8)')
    expect(cases.evidence).toContain('missing=empty,error')
    expect(cases.evidence).toContain('present=normal(normal),searched(normal)')
    expect(byId(results, 'V1.criteria_linked').evidence).toEqual(['unlinked=EXAMPLE-AC-03'])
    expectSchemaConform(results)
  })

  it('stale-baseline 은 V1 로는 통과한다 (기준 버전 비교는 V0/V5 몫)', () => {
    const results = runV1(loadFixtureSpec('stale-baseline'), { required_cases, artifact_hash: HASH })
    expect(results.every((r) => r.status === 'pass')).toBe(true)
  })

  it('구조가 깨진 입력은 V1.schema fail 이고 나머지는 not_run (통과 아님)', () => {
    const results = runV1({ screen_id: 'x' }, { required_cases, artifact_hash: HASH })
    expect(statusOf(results)).toEqual({ 'V1.schema': 'fail', 'V1.references': 'not_run', 'V1.required_cases': 'not_run', 'V1.criteria_linked': 'not_run' })
    const schema = byId(results, 'V1.schema')
    expect(schema.evidence.length).toBeGreaterThan(3)
    expect(schema.evidence.some((e) => e.startsWith('sections:'))).toBe(true)
    expect(byId(results, 'V1.references').message).toBe('V1.schema 실패로 실행하지 않음')
    expectSchemaConform(results)
    expect(() => runV1(null, { required_cases, artifact_hash: HASH })).not.toThrow()
  })

  it('schemas 예시: 확장본은 pass, 최소 완성본은 case_kind 없는 empty 와 error 누락으로 fail (CASE 종류는 id 가 아니라 case_kind 로 판단)', () => {
    expect(statusOf(runV1(EXAMPLE_ORDER_LIST_EXTENDED, { required_cases, artifact_hash: HASH }))).toEqual({
      'V1.schema': 'pass',
      'V1.references': 'pass',
      'V1.required_cases': 'pass',
      'V1.criteria_linked': 'pass',
    })
    const minimal = runV1(EXAMPLE_ORDER_LIST, { required_cases, artifact_hash: HASH })
    expect(byId(minimal, 'V1.required_cases').status).toBe('fail')
    expect(byId(minimal, 'V1.required_cases').evidence).toContain('missing=empty,error')
    expect(byId(minimal, 'V1.required_cases').evidence).toContain('present=normal(normal),empty(normal)')
    // 요구한 CASE 가 없으면 통과
    expect(byId(runV1(EXAMPLE_ORDER_LIST, { required_cases: [], artifact_hash: HASH }), 'V1.required_cases').status).toBe('pass')
  })
})
