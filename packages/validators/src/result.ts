/**
 * 결과 생성 보조 — 모든 검사가 같은 형태의 ValidationResult 를 만든다 (설계 §10: pass/fail/error/not_run, fail·error 는 원인 필수).
 *
 * id 는 전역 `crypto.randomUUID()` 로 만든다 (Node 22 와 브라우저 보안 컨텍스트 모두 제공).
 * 이 파일은 V1·V2 와 함께 브라우저 번들(apps/web/src/browser-run)에서도 쓰이므로 node: 모듈을 import 하지 않는다.
 */
import type { ValidationStage } from '@con-ai/schemas'
import type { CheckResult, CheckStatus } from './types.js'

/** 검사 도구 버전 — 검사 규칙이 바뀌면 올린다 (설계 §6 검사 버전). */
export const CHECKER_VERSION = 'con-ai-validators/0.1.0'

export interface ResultFactoryInput {
  artifact_hash: string
  validation_run_id: string
  stage: ValidationStage
}

export interface MakeResultArgs {
  check_id: string
  status: CheckStatus
  required: boolean
  message?: string | undefined
  evidence?: string[] | undefined
  started_at?: number | undefined
}

export function newRunId(): string {
  return crypto.randomUUID()
}

export function makeResult(base: ResultFactoryInput, args: MakeResultArgs): CheckResult {
  const now = Date.now()
  const out: CheckResult = {
    id: crypto.randomUUID(),
    validation_run_id: base.validation_run_id,
    artifact_hash: base.artifact_hash,
    check_id: args.check_id,
    stage: base.stage,
    status: args.status,
    required: args.required,
    evidence: args.evidence ?? [],
    checker_version: CHECKER_VERSION,
    executed_at: new Date(now).toISOString(),
  }
  const message = args.message ?? (args.status === 'fail' || args.status === 'error' ? '원인 미기록' : undefined)
  if (message !== undefined) out.message = message
  if (args.started_at !== undefined) out.duration_ms = Math.max(0, now - args.started_at)
  return out
}

/** 실행하지 않은 검사를 not_run 으로 기록한다 (통과 아님). */
export function notRun(base: ResultFactoryInput, check_id: string, required: boolean, reason: string): CheckResult {
  return makeResult(base, { check_id, status: 'not_run', required, message: reason })
}

/** issue 경로를 'a.0.b' 형태로. */
export function pathToString(path: readonly PropertyKey[]): string {
  return path.map(String).join('.')
}
