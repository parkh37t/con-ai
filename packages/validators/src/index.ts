/**
 * @con-ai/validators — V1 명세 · V2 렌더 구조 · V3 실행(Playwright) 검사 (세로 조각 계약 §5).
 * 결과는 schemas ValidationResult(+executed_at) 이며 pass/fail/error/not_run 을 구분한다. 실행하지 않은 검사는 not_run, 도구 오류는 error 다.
 */
import { createHash } from 'node:crypto'
import { ScreenSpecShape } from '@con-ai/schemas'
import { S2B_LEARNED_PROFILE, type RenderProfile } from '@con-ai/renderer'
import { newRunId, notRun, type ResultFactoryInput } from './result.js'
import type { CheckResult } from './types.js'
import { V1_CHECKS, runV1 } from './v1.js'
import { V2_CHECKS, runV2 } from './v2.js'
import { V3_CHECKS, runV3, v3RequiredFlags } from './v3.js'

export type { CheckResult, CheckStatus, CommonOptions, V1Options, V3Options } from './types.js'
export { CHECKER_VERSION } from './result.js'
export { runV1, V1_CHECKS, unlinkedCriteria, missingCaseKinds } from './v1.js'
export { runV2, V2_CHECKS, scanTags, findRegions, findExternalRefs } from './v2.js'
export { runV3, V3_CHECKS, launchPlan, v3RequiredFlags, actionTypesOf, FALLBACK_CHROMIUM_PATH, DEFAULT_V3_TIMEOUT_MS } from './v3.js'

/**
 * 승인에 필수인 check_id 목록 (설계 §10: 필수 검사가 fail/error/not_run 이면 승인 불가).
 * V3.search_filter / V3.download 는 해당 동작(filter-fixture / download-fixture)이 명세에 있을 때만 필수다 —
 * 동작이 없으면 결과를 status not_run, required false 로 기록하므로 승인 게이트를 막지 않는다. 명세별 목록은 requiredChecksFor().
 */
export const REQUIRED_CHECKS: string[] = [...V1_CHECKS, ...V2_CHECKS, 'V3.console_errors', 'V3.case_switch', 'V3.search_filter', 'V3.download']

/** 이 명세에 실제로 필수인 check_id (조건부 V3 검사는 동작 유무로 결정). */
export function requiredChecksFor(spec: Pick<ScreenSpecShape, 'actions'>): string[] {
  const types = new Set(spec.actions.map((a) => a.type))
  return REQUIRED_CHECKS.filter((id) => {
    if (id === 'V3.search_filter') return types.has('filter-fixture')
    if (id === 'V3.download') return types.has('download-fixture')
    return true
  })
}

/** artifact hash — HTML 본문의 SHA-256 소문자 hex (설계 §6 content hash). */
export function hashHtml(html: string): string {
  return createHash('sha256').update(html, 'utf8').digest('hex')
}

export interface RunAllInput {
  spec: unknown
  html: string
  profile?: RenderProfile | undefined
  required_cases: string[]
  artifact_hash: string
  timeout_ms?: number | undefined
  validation_run_id?: string | undefined
  executable_path?: string | undefined
}

/**
 * V1 → V2 → V3 순서로 모두 실행해 한 ValidationRun 의 결과로 돌려준다.
 * V1.schema 가 실패하면 V2·V3 는 실행하지 않고 not_run 으로 기록한다 (통과 아님).
 */
export async function runAll(input: RunAllInput): Promise<CheckResult[]> {
  const validation_run_id = input.validation_run_id ?? newRunId()
  const profile = input.profile ?? S2B_LEARNED_PROFILE
  const v1 = runV1(input.spec, { required_cases: input.required_cases, artifact_hash: input.artifact_hash, validation_run_id })
  const schemaPassed = v1.some((r) => r.check_id === 'V1.schema' && r.status === 'pass')
  if (!schemaPassed) {
    const reason = 'V1.schema 실패로 실행하지 않음'
    const v2base: ResultFactoryInput = { artifact_hash: input.artifact_hash, validation_run_id, stage: 'V2' }
    const v3base: ResultFactoryInput = { artifact_hash: input.artifact_hash, validation_run_id, stage: 'V3' }
    const flags = v3RequiredFlags(input.html)
    return [...v1, ...V2_CHECKS.map((id) => notRun(v2base, id, true, reason)), ...V3_CHECKS.map((id) => notRun(v3base, id, flags[id], reason))]
  }
  const shape = ScreenSpecShape.parse(input.spec)
  const v2 = runV2(input.html, shape, profile, { artifact_hash: input.artifact_hash, validation_run_id })
  const v3 = await runV3(input.html, { artifact_hash: input.artifact_hash, validation_run_id, timeout_ms: input.timeout_ms, executable_path: input.executable_path })
  return [...v1, ...v2, ...v3]
}
