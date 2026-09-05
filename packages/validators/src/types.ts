/** 세로 조각 계약 §5 — 검증 결과 타입과 옵션. */
import type { ValidationResult } from '@con-ai/schemas'

/**
 * 검사 결과. schemas `ValidationResult` 에 실행 시각(executed_at)을 더한 부분집합 타입이다.
 * `ValidationResult[]` 를 기대하는 곳에 그대로 넘길 수 있고, `ValidationResult.parse` 를 거치면 executed_at 은 제거된다.
 */
export type CheckResult = ValidationResult & { executed_at: string }

export type CheckStatus = ValidationResult['status']

export interface CommonOptions {
  /** 결과를 고정할 artifact hash (SHA-256 hex 64자). 렌더한 HTML 의 hash 다 (설계 §6). */
  artifact_hash: string
  /** 같은 실행에 속하는 결과를 묶는 ValidationRun id. 없으면 호출마다 새로 만든다. */
  validation_run_id?: string | undefined
}

export interface V1Options extends CommonOptions {
  /** states[].case_kind 에 반드시 있어야 하는 CASE 종류 (예: ['normal','empty','error']). */
  required_cases: string[]
}

export interface V3Options extends CommonOptions {
  /** 전체 V3 실행 제한 시간. 기본 20000ms. */
  timeout_ms?: number | undefined
  /** 명시 실행 파일. 없으면 PLAYWRIGHT_CHROMIUM_PATH → 기본 launch → /opt/pw-browsers/chromium 순서 (v3.ts). */
  executable_path?: string | undefined
}
