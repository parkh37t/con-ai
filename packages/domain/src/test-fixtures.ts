/**
 * 테스트 보조 — 합성 데이터 생성기. 테스트 파일에서만 쓰며 index.ts 에서 재수출하지 않는다.
 * 실제 S2B 요구사항 본문·화면 경로를 담지 않는다 (공개 저장소). ID 는 모두 EXAMPLE- 접두어다.
 */
import {
  AcceptanceCriterion,
  AcceptanceTest,
  Artifact,
  ScreenPlan,
  SourceAnchor,
  TraceLink,
  ValidationResult,
  type AcceptanceCriterion as Criterion,
  type AcceptanceTest as Test,
  type Artifact as ArtifactType,
  type ScreenPlan as Plan,
  type SourceAnchor as Anchor,
  type TraceLink as Link,
  type ValidationResult as Result,
} from '@con-ai/schemas'
import { DomainRuleError } from './result.js'

/** 결정적 UUID (v4 형식). 같은 번호는 같은 값이다. */
export function uuid(n: number): string {
  return `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`
}

/** 결정적 SHA-256 형식 hash. */
export function hash(seed: string): string {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h.toString(16).padStart(8, '0').repeat(8)
}

export const PROJECT = uuid(1)
export const BASELINE = 'EXAMPLE-baseline-1'
export const T0 = '2026-09-01T00:00:00Z'
export const T1 = '2026-09-05T00:00:00Z'

/** 필수 필드가 채워진 ScreenPlan. `over` 로 덮어쓴다. */
export function screenPlan(n: number, over: Partial<Plan> = {}): Plan {
  return ScreenPlan.parse({
    id: uuid(100 + n),
    project_id: PROJECT,
    external_id: `EXAMPLE-screen-${n}`,
    path: `example/screen-${n}.html`,
    portal: '수요기관',
    registry_status: 'registered',
    created_at: T0,
    ...over,
  })
}

export function criterion(n: number, over: Partial<Criterion> = {}): Criterion {
  return AcceptanceCriterion.parse({
    id: uuid(200 + n),
    requirement_revision_id: uuid(300),
    external_id: `EXAMPLE-AC-${n}`,
    text: `합성 수용조건 ${n}`,
    kind: 'ui',
    verification_method: 'ui_acceptance_test',
    ...over,
  })
}

export function traceLink(n: number, over: Partial<Link> = {}): Link {
  return TraceLink.parse({
    id: uuid(400 + n),
    revision: 1,
    baseline_id: BASELINE,
    requirement_revision_id: uuid(300),
    criterion_id: uuid(200 + n),
    origin: 'html_token',
    status: 'candidate',
    ...over,
  })
}

export function approvedLink(n: number, screenRevisionId: string, over: Partial<Link> = {}): Link {
  return traceLink(n, {
    status: 'approved',
    screen_revision_id: screenRevisionId,
    element_or_action_id: `element-${n}`,
    evidence: [{ anchor_id: uuid(900) }],
    decided_by: 'planner-1',
    decided_at: T1,
    ...over,
  })
}

export function artifact(n: number, over: Partial<ArtifactType> = {}): ArtifactType {
  return Artifact.parse({
    id: uuid(500 + n),
    project_id: PROJECT,
    screen_revision_id: uuid(600),
    kind: 'html',
    content_hash: hash(`artifact-${n}`),
    generation_job_id: uuid(700),
    renderer_version: '0.1.0',
    status: 'draft',
    created_at: T1,
    ...over,
  })
}

export function validationResult(checkId: string, over: Partial<Result> = {}): Result {
  return ValidationResult.parse({
    id: uuid(800),
    validation_run_id: uuid(801),
    artifact_hash: hash('artifact-1'),
    check_id: checkId,
    stage: 'V1',
    status: 'pass',
    required: true,
    checker_version: '0.1.0',
    ...over,
  })
}

export function acceptanceTest(criterionId: string, artifactHash: string, over: Partial<Test> = {}): Test {
  return AcceptanceTest.parse({
    id: uuid(850),
    criterion_id: criterionId,
    initial: { state_id: 'normal', role: 'buyer' },
    user_actions: [{ description: '검색어 입력 후 검색' }],
    expected_result: '일치하는 1건 표시',
    artifact_hash: artifactHash,
    result: 'pass',
    ...over,
  })
}

/** 원문(시트) anchor. */
export function sheetAnchor(n: number): Anchor {
  return SourceAnchor.parse({ id: uuid(900 + n), source_version_id: uuid(950), locator: { kind: 'sheet', sheet: 'SFR', row: n, column: 'A' }, excerpt: `합성 원문 ${n}` })
}

/** HTML 위치 anchor (토큰 출현). */
export function htmlAnchor(n: number): Anchor {
  return SourceAnchor.parse({ id: uuid(970 + n), source_version_id: uuid(951), locator: { kind: 'html', path: `example/screen-${n}.html`, selector: '#right-panel' }, excerpt: 'EXAMPLE-REQ-001' })
}

/** fn 이 DomainRuleError 를 던져야 통과한다. 던지지 않으면 실패한다 (단언이 건너뛰어지는 try/catch 를 피한다). */
export function captureRuleError(fn: () => unknown): DomainRuleError {
  try {
    fn()
  } catch (e) {
    if (e instanceof DomainRuleError) return e
    throw e
  }
  throw new Error('DomainRuleError 가 발생해야 하는데 발생하지 않았다')
}
