/**
 * @con-ai/domain — ID·버전·매핑 규칙. 파일별 역할과 출처는 packages/domain/README.md 참고.
 * 판정 함수는 이유 목록(RuleDecision)을 돌려주고, 적용 함수는 거부 시 DomainRuleError 를 던진다 (result.ts).
 */
export * from './result.js'
export * from './external-id.js'
export * from './id-registry.js'
export * from './rtm.js'
export * from './coverage.js'
export * from './state-machines.js'
export * from './approval-gate.js'
export * from './trace-decision.js'
export * from './stale.js'
