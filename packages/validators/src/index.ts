import type { ScreenSpecShape, ValidationResult } from '@con-ai/schemas'
import type { RenderProfile } from '@con-ai/renderer'
/** 승인에 필수인 check_id — 구현 에이전트가 확정한다. */
export const REQUIRED_CHECKS: string[] = []
/** 미구현 스텁 — 구현 에이전트가 교체한다. */
export function runV1(_spec: unknown, _opts: { required_cases: string[]; artifact_hash: string }): ValidationResult[] {
  throw new Error('runV1 미구현')
}
export function runV2(_html: string, _spec: ScreenSpecShape, _profile: RenderProfile, _opts: { artifact_hash: string }): ValidationResult[] {
  throw new Error('runV2 미구현')
}
export async function runV3(_html: string, _opts: { artifact_hash: string; timeout_ms?: number }): Promise<ValidationResult[]> {
  throw new Error('runV3 미구현')
}
export async function runAll(_input: { spec: unknown; html: string; profile: RenderProfile; required_cases: string[]; artifact_hash: string }): Promise<ValidationResult[]> {
  throw new Error('runAll 미구현')
}
