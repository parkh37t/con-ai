/**
 * V1 명세 검사 (설계 §10 V1: 스키마, 참조, 역할·상태, 수용조건 연결).
 *
 * - V1.schema        : ScreenSpecShape 파싱 (구조). 실패하면 나머지 V1 은 not_run.
 * - V1.references    : checkScreenSpecReferences (target·trigger·trace·message·data_mapping·locked 참조). evidence 에 'path: message'.
 * - V1.required_cases: opts.required_cases 가 states[].case_kind 에 모두 있는지.
 * - V1.criteria_linked: requirements[].criterion_ids 가 요소·동작 trace 로 최소 1회 연결되는지 (설계 §7 수용조건 단위 추적).
 */
import { ScreenSpecShape, checkScreenSpecReferences } from '@con-ai/schemas'
import { makeResult, newRunId, notRun, pathToString, type ResultFactoryInput } from './result.js'
import type { CheckResult, V1Options } from './types.js'

export const V1_CHECKS = ['V1.schema', 'V1.references', 'V1.required_cases', 'V1.criteria_linked'] as const

/** 요소·동작 trace 에 한 번도 나오지 않는 수용조건 ID. */
export function unlinkedCriteria(spec: ScreenSpecShape): string[] {
  const linked = new Set<string>()
  for (const s of spec.sections) for (const e of s.elements) for (const c of e.trace ?? []) linked.add(c)
  for (const a of spec.actions) for (const c of a.trace ?? []) linked.add(c)
  const out: string[] = []
  for (const r of spec.requirements) for (const c of r.criterion_ids) if (!linked.has(c) && !out.includes(c)) out.push(c)
  return out
}

/** states[].case_kind 에 없는 필수 CASE 종류. */
export function missingCaseKinds(spec: ScreenSpecShape, required: readonly string[]): string[] {
  const present = new Set(spec.states.map((s) => s.case_kind ?? 'normal'))
  return required.filter((k) => !present.has(k as never))
}

export function runV1(spec: unknown, opts: V1Options): CheckResult[] {
  const base: ResultFactoryInput = { artifact_hash: opts.artifact_hash, validation_run_id: opts.validation_run_id ?? newRunId(), stage: 'V1' }
  const started = Date.now()
  const results: CheckResult[] = []

  const parsed = ScreenSpecShape.safeParse(spec)
  if (!parsed.success) {
    const evidence = parsed.error.issues.map((i) => `${pathToString(i.path)}: ${i.message}`)
    results.push(makeResult(base, { check_id: 'V1.schema', status: 'fail', required: true, message: `ScreenSpec 구조 오류 ${evidence.length}건`, evidence, started_at: started }))
    for (const id of V1_CHECKS.slice(1)) results.push(notRun(base, id, true, 'V1.schema 실패로 실행하지 않음'))
    return results
  }
  const shape = parsed.data
  results.push(makeResult(base, { check_id: 'V1.schema', status: 'pass', required: true, evidence: [`screen_id=${shape.screen_id}`, `sections=${shape.sections.length}`, `states=${shape.states.length}`], started_at: started }))

  const refIssues = checkScreenSpecReferences(shape)
  if (refIssues.length > 0) {
    const evidence = refIssues.map((i) => `${pathToString(i.path)}: ${i.message}`)
    results.push(makeResult(base, { check_id: 'V1.references', status: 'fail', required: true, message: `참조 오류 ${refIssues.length}건 (설계 §9 target 참조 검증)`, evidence, started_at: started }))
  } else {
    results.push(makeResult(base, { check_id: 'V1.references', status: 'pass', required: true, evidence: ['영역·요소·동작·CASE·메시지·데이터 매핑·잠금 참조가 모두 정의된 id 를 가리킨다'], started_at: started }))
  }

  const missing = missingCaseKinds(shape, opts.required_cases)
  const present = shape.states.map((s) => `${s.id}(${s.case_kind ?? 'normal'})`)
  if (missing.length > 0) {
    results.push(
      makeResult(base, {
        check_id: 'V1.required_cases',
        status: 'fail',
        required: true,
        message: `필수 CASE 누락: ${missing.join(', ')} (설계 §8)`,
        evidence: [`missing=${missing.join(',')}`, `present=${present.join(',')}`, `required=${opts.required_cases.join(',')}`],
        started_at: started,
      }),
    )
  } else {
    results.push(makeResult(base, { check_id: 'V1.required_cases', status: 'pass', required: true, evidence: [`present=${present.join(',')}`, `required=${opts.required_cases.join(',')}`], started_at: started }))
  }

  const unlinked = unlinkedCriteria(shape)
  const total = shape.requirements.reduce((n, r) => n + r.criterion_ids.length, 0)
  if (unlinked.length > 0) {
    results.push(
      makeResult(base, {
        check_id: 'V1.criteria_linked',
        status: 'fail',
        required: true,
        message: `요소·동작 trace 에 연결되지 않은 수용조건 ${unlinked.length}건: ${unlinked.join(', ')} (설계 §7)`,
        evidence: unlinked.map((c) => `unlinked=${c}`),
        started_at: started,
      }),
    )
  } else {
    results.push(makeResult(base, { check_id: 'V1.criteria_linked', status: 'pass', required: true, evidence: [`수용조건 ${total}개 모두 요소·동작 trace 에 연결`], started_at: started }))
  }
  return results
}
