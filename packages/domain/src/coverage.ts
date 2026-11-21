/**
 * 커버리지 — 분모는 "승인된 범위의 수용조건". 승인 매핑 비율과 테스트 통과 비율은 따로 계산한다.
 *
 * 출처:
 * - 설계 §7: "커버리지는 승인된 범위의 수용조건을 분모로 계산한다. `승인 매핑 비율` 과 `테스트 통과 비율` 을 별도 표시하고
 *            비UI·제외 건수를 함께 보여준다. 중복 ID, 문자열 출현 수, INDEX 행 수는 커버리지 분모가 아니다."
 * - 설계 §7 표: 승인 매핑 = 동일 기준 버전에서 담당자가 확인; 검증 완료 = 연결된 수용조건 테스트가 해당 artifact 에서 통과.
 * - 설계 §10: 실행하지 않은 검사(not_run)는 통과가 아니다.
 * - 개발프롬프트: "1,428개 INDEX 행을 고유 화면 또는 검증 완료 수로 표시하지 않습니다."
 *
 * 입력 시그니처에 중복 ID 수·문자열 출현 수·INDEX 행 수 자리가 없다. 그런 키가 들어오면 실행 시점에도 거부한다.
 */
import { TraceCoverage, type AcceptanceCriterion, type AcceptanceTest, type Artifact, type Baseline, type InternalId, type TraceLink } from '@con-ai/schemas'
import { DomainRuleError } from './result.js'

/** 커버리지 입력. 승인된 범위는 baseline 이 채택한 요구사항 revision 으로 정한다 (설계 §6 Baseline). */
export interface CoverageInput {
  baseline: Pick<Baseline, 'baseline_id' | 'requirement_revision_ids'>
  /** 후보 수용조건 전체. 승인 범위 밖(baseline 이 채택하지 않은 요구사항 revision)의 조건은 분모에서 제외한다. */
  criteria: readonly AcceptanceCriterion[]
  /** 매핑. 다른 기준 버전의 링크는 세지 않는다 (설계 §7 동일 기준 버전). */
  links: readonly TraceLink[]
  /** 수용 테스트. `result === 'pass'` 이고 승인 매핑이 가리키는 화면 버전의 artifact hash 에서 실행된 것만 센다. */
  tests: readonly AcceptanceTest[]
  /** 산출물 — 화면 revision ↔ artifact hash 연결용. */
  artifacts: readonly Pick<Artifact, 'content_hash' | 'screen_revision_id'>[]
}

/** 커버리지 보고. `coverage` 는 schemas 의 TraceCoverage 그대로이고, 두 비율은 별도 필드다. */
export interface CoverageReport {
  coverage: TraceCoverage
  /** approved_links / criteria_in_scope. 분모가 0 이면 null (0/0 을 100% 로 표시하지 않는다). */
  approved_mapping_ratio: number | null
  /** tests_passed / criteria_in_scope. 분모가 0 이면 null. */
  test_pass_ratio: number | null
  /** 승인 범위 밖이라 분모에서 뺀 수용조건 수 (참고). */
  out_of_scope_criteria: number
  /** 승인 범위 안인데 아무 결정(approved/non_ui/excluded/conflict)도 없는 수용조건 — 누락 후보. */
  undecided_criterion_ids: InternalId[]
}

const ALLOWED_INPUT_KEYS: ReadonlySet<string> = new Set<keyof CoverageInput>(['baseline', 'criteria', 'links', 'tests', 'artifacts'])

/** 커버리지 입력에 허용된 키만 있는지 확인한다. 중복 ID 수·문자열 출현 수·INDEX 행 수 같은 값은 분모가 아니다 (설계 §7). */
export function assertCoverageInputKeys(input: object): void {
  const extra = Object.keys(input).filter((k) => !ALLOWED_INPUT_KEYS.has(k))
  if (extra.length > 0) {
    throw new DomainRuleError('커버리지 입력이 아니다', [
      {
        code: 'coverage.forbidden_input',
        message: `허용되지 않는 입력 키: ${extra.join(', ')} — 중복 ID 수·문자열 출현 수·INDEX 행 수는 커버리지 분모가 아니다 (설계 §7; 개발프롬프트)`,
      },
    ])
  }
}

/** 커버리지를 계산한다. 결과의 `coverage` 는 TraceCoverage 스키마로 검사한 값이다. */
export function computeCoverage(input: CoverageInput): CoverageReport {
  assertCoverageInputKeys(input)
  const { baseline } = input
  const scopeRevisionIds = new Set(baseline.requirement_revision_ids)
  const inScope = input.criteria.filter((c) => scopeRevisionIds.has(c.requirement_revision_id))
  const outOfScope = input.criteria.length - inScope.length

  // 동일 기준 버전의 링크만 센다.
  const linksByCriterion = new Map<InternalId, TraceLink[]>()
  for (const link of input.links) {
    if (link.baseline_id !== baseline.baseline_id) continue
    const list = linksByCriterion.get(link.criterion_id) ?? []
    list.push(link)
    linksByCriterion.set(link.criterion_id, list)
  }

  const hashesByScreenRevision = new Map<InternalId, Set<string>>()
  for (const a of input.artifacts) {
    if (a.screen_revision_id === undefined) continue
    const set = hashesByScreenRevision.get(a.screen_revision_id) ?? new Set<string>()
    set.add(a.content_hash)
    hashesByScreenRevision.set(a.screen_revision_id, set)
  }

  const testsByCriterion = new Map<InternalId, AcceptanceTest[]>()
  for (const t of input.tests) {
    const list = testsByCriterion.get(t.criterion_id) ?? []
    list.push(t)
    testsByCriterion.set(t.criterion_id, list)
  }

  let approved = 0
  let passed = 0
  let nonUi = 0
  let excluded = 0
  let conflicts = 0
  const undecided: InternalId[] = []

  for (const criterion of inScope) {
    const links = linksByCriterion.get(criterion.id) ?? []
    const approvedLinks = links.filter((l) => l.status === 'approved')
    const hasNonUi = criterion.kind === 'non_ui' || links.some((l) => l.status === 'non_ui')
    const hasExcluded = links.some((l) => l.status === 'excluded')
    const hasConflict = links.some((l) => l.status === 'conflict')

    if (approvedLinks.length > 0) approved += 1 // 다대다: 승인 링크가 여럿이어도 수용조건은 한 번만 센다
    if (hasNonUi) nonUi += 1
    if (hasExcluded) excluded += 1
    if (hasConflict) conflicts += 1
    if (approvedLinks.length === 0 && !hasNonUi && !hasExcluded && !hasConflict) undecided.push(criterion.id)

    // 테스트 통과: 승인 매핑이 가리키는 화면 버전의 artifact 에서 pass 한 테스트가 있어야 한다.
    const validHashes = new Set<string>()
    for (const l of approvedLinks) {
      if (l.screen_revision_id === undefined) continue
      for (const h of hashesByScreenRevision.get(l.screen_revision_id) ?? []) validHashes.add(h)
    }
    const tests = testsByCriterion.get(criterion.id) ?? []
    if (tests.some((t) => t.result === 'pass' && validHashes.has(t.artifact_hash))) passed += 1
  }

  const coverage = TraceCoverage.parse({
    baseline_id: baseline.baseline_id,
    criteria_in_scope: inScope.length,
    approved_links: approved,
    tests_passed: passed,
    non_ui: nonUi,
    excluded,
    conflicts,
  })
  const denominator = coverage.criteria_in_scope
  return {
    coverage,
    approved_mapping_ratio: denominator === 0 ? null : coverage.approved_links / denominator,
    test_pass_ratio: denominator === 0 ? null : coverage.tests_passed / denominator,
    out_of_scope_criteria: outOfScope,
    undecided_criterion_ids: undecided,
  }
}
