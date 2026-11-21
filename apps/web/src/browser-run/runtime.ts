/**
 * 브라우저 모드 런타임 설정 — 자격 증명·fetch·저장소·시계를 한 곳에서 주입한다 (테스트가 갈아끼운다).
 * 여기서 credential 을 읽어 "브라우저 모드가 켜졌는지" 를 판단한다. 값 자체는 밖으로 내보내지 않는다.
 */
import { DEFAULT_BROWSER_MODEL, type FetchLike } from './anthropic.js'
import { credentialStore, describeCredential, type CredentialInfo, type StoredCredential } from './credential.js'
import { BrowserPipelineError } from './pipeline.js'
import { browserStore, type BrowserStore } from './store.js'
import { runV3InBrowser } from './v3-browser.js'
import type { CheckResult } from './deps.js'
import type { JobFailure, JobStage } from '../types.js'

export interface BrowserRuntime {
  /** 현재 자격 증명 (없으면 null → 스냅샷 데모 동작). */
  credential: () => StoredCredential | null
  fetch: FetchLike | undefined
  store: BrowserStore
  now: () => string
  newId: () => string
  model: string
  /** V3 실행 검사기 (격리 iframe). 테스트는 이걸 갈아끼워 검사한다. */
  runV3: (html: string, opts: { artifact_hash: string; validation_run_id: string }) => Promise<CheckResult[]>
}

export const browserRuntime: BrowserRuntime = {
  credential: () => credentialStore.load(),
  fetch: undefined,
  store: browserStore,
  now: () => new Date().toISOString(),
  newId: () => crypto.randomUUID(),
  model: DEFAULT_BROWSER_MODEL,
  runV3: runV3InBrowser,
}

/** 테스트·설정 변경용. 넘긴 항목만 바꾼다. */
export function setBrowserRuntime(patch: Partial<BrowserRuntime>): void {
  Object.assign(browserRuntime, patch)
}

/** 지금 실제 호출이 가능한지. */
export function browserModeActive(): boolean {
  return browserRuntime.credential() !== null
}

/** 화면 표시용 요약 (종류 + 끝 4자리). 값은 들어 있지 않다. */
export function browserModeInfo(): { active: boolean; model: string; credential: CredentialInfo | null } {
  const cred = browserRuntime.credential()
  return { active: cred !== null, model: browserRuntime.model, credential: describeCredential(cred) }
}

/** 파이프라인 예외 → 작업 실패 기록 (서버 job.failure 와 같은 형태). */
export function toJobFailure(e: unknown, fallbackStage: JobStage): JobFailure {
  if (e instanceof BrowserPipelineError) {
    const failure: JobFailure = { code: e.code, message: e.message, stage: e.stage }
    if (e.details.length > 0) failure.details = e.details
    return failure
  }
  return { code: 'internal', message: `예기치 않은 오류: ${e instanceof Error ? e.message : String(e)}`, stage: fallbackStage }
}
