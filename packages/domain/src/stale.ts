/**
 * 변경 영향 — 요구사항·정책 변경 시 TraceLink 로 영향 화면·명세·테스트를 찾고 기존 승인을 stale 대상으로 표시한다.
 *
 * 출처:
 * - 설계 §11: "요구사항·정책 변경 시 TraceLink 로 영향 화면·명세·테스트를 찾고 기존 승인을 stale 로 표시한다.
 *             사람이 변경 영향 범위를 확인한 뒤 재생성한다."
 * - 설계 §6: 생성 작업은 기준 버전을 고정하며, 완료 시 최신 기준과 달라졌으면 `검토 필요` 로 표시한다.
 * - 설계 §11 산출물 상태: 변경 발생 시 새 draft 또는 stale.
 *
 * 순수 함수다. 저장소를 읽거나 쓰지 않고, 입력으로 받은 링크·산출물·테스트만으로 영향 목록과 stale 대상을 계산한다.
 * 정책 변경은 TraceLink 가 정책을 직접 가리키지 않으므로(schemas 제한) 기준 버전(baseline_id) 갱신으로 표현한다.
 */
import { Artifact, type AcceptanceTest, type ArtifactStatus, type InternalId, type ScreenRevision, type TraceLink } from '@con-ai/schemas'
import { transitionArtifact } from './state-machines.js'

/** 변경 영향 입력. 호출자는 기존 링크가 가리키는(변경 전) revision·수용조건 ID 를 넘긴다. */
export interface ChangeImpactInput {
  /** 내용이 바뀐 요구사항 revision (기존 링크가 가리키는 ID). */
  changed_requirement_revision_ids?: readonly InternalId[] | undefined
  /** 내용이 바뀐 수용조건. */
  changed_criterion_ids?: readonly InternalId[] | undefined
  /** 정책 변경 등으로 갱신된 기준 버전 — 그 baseline 에 고정된 링크·화면 revision 이 모두 영향을 받는다. */
  changed_baseline_ids?: readonly string[] | undefined
  links: readonly TraceLink[]
  artifacts: readonly Artifact[]
  /** 화면 revision (선택). 기준 버전 변경 시 baseline_id 로 영향 화면을 찾는 데 쓴다. */
  screen_revisions?: readonly Pick<ScreenRevision, 'id' | 'baseline_id'>[] | undefined
  tests?: readonly AcceptanceTest[] | undefined
}

/** stale 로 표시할 산출물과 사유. */
export interface StaleTarget {
  artifact_id: InternalId
  content_hash: string
  previous_status: ArtifactStatus
  reason: string
}

/** 변경 영향 결과. */
export interface ChangeImpact {
  /** 변경된 요구사항·수용조건·기준 버전에 연결된 매핑 (상태 무관). */
  affected_links: TraceLink[]
  /** 다시 확인해야 하는 승인 매핑 (affected_links 중 approved). TraceLinkStatus 에는 stale 값이 없어 목록으로만 돌려준다. */
  approved_links_to_review: TraceLink[]
  affected_screen_revision_ids: InternalId[]
  /** 영향 화면 revision 의 산출물 (HTML·명세·보고서 모두). */
  affected_artifacts: Artifact[]
  /** 변경된 수용조건의 테스트 또는 영향 산출물 hash 에서 실행된 테스트. */
  affected_tests: AcceptanceTest[]
  /** stale 로 표시할 대상 — 영향 산출물 중 아직 stale 이 아닌 것. */
  stale_targets: StaleTarget[]
}

/** 변경 영향을 계산한다. 변경 목록이 모두 비어 있으면 빈 결과다. */
export function findChangeImpact(input: ChangeImpactInput): ChangeImpact {
  const changedRevisions = new Set(input.changed_requirement_revision_ids ?? [])
  const changedCriteria = new Set(input.changed_criterion_ids ?? [])
  const changedBaselines = new Set(input.changed_baseline_ids ?? [])

  const linkReasons = new Map<InternalId, string[]>()
  const affectedLinks: TraceLink[] = []
  for (const link of input.links) {
    const why: string[] = []
    if (changedRevisions.has(link.requirement_revision_id)) why.push(`요구사항 revision ${link.requirement_revision_id} 변경`)
    if (changedCriteria.has(link.criterion_id)) why.push(`수용조건 ${link.criterion_id} 변경`)
    if (changedBaselines.has(link.baseline_id)) why.push(`기준 버전 ${link.baseline_id} 갱신`)
    if (why.length === 0) continue
    affectedLinks.push(link)
    linkReasons.set(link.id, why)
  }

  const screenReasons = new Map<InternalId, Set<string>>()
  const addScreen = (id: InternalId, why: readonly string[]): void => {
    const set = screenReasons.get(id) ?? new Set<string>()
    for (const w of why) set.add(w)
    screenReasons.set(id, set)
  }
  for (const link of affectedLinks) {
    if (link.screen_revision_id !== undefined) addScreen(link.screen_revision_id, linkReasons.get(link.id) ?? [])
  }
  for (const sr of input.screen_revisions ?? []) {
    if (sr.baseline_id !== undefined && changedBaselines.has(sr.baseline_id)) addScreen(sr.id, [`기준 버전 ${sr.baseline_id} 갱신`])
  }

  const affectedArtifacts = input.artifacts.filter((a) => a.screen_revision_id !== undefined && screenReasons.has(a.screen_revision_id))
  const affectedHashes = new Set(affectedArtifacts.map((a) => a.content_hash))
  const affectedTests = (input.tests ?? []).filter((t) => changedCriteria.has(t.criterion_id) || affectedHashes.has(t.artifact_hash))

  const staleTargets: StaleTarget[] = []
  for (const a of affectedArtifacts) {
    if (a.status === 'stale' || a.screen_revision_id === undefined) continue
    staleTargets.push({
      artifact_id: a.id,
      content_hash: a.content_hash,
      previous_status: a.status,
      reason: [...(screenReasons.get(a.screen_revision_id) ?? [])].join('; '),
    })
  }

  return {
    affected_links: affectedLinks,
    approved_links_to_review: affectedLinks.filter((l) => l.status === 'approved'),
    affected_screen_revision_ids: [...screenReasons.keys()],
    affected_artifacts: affectedArtifacts,
    affected_tests: affectedTests,
    stale_targets: staleTargets,
  }
}

/** 산출물을 stale 로 표시한 새 객체를 돌려준다. 전이가 허용되지 않으면(이미 stale) DomainRuleError. 사유는 비어 있을 수 없다 (Artifact 스키마). */
export function markStale(artifact: Artifact, reason: string): Artifact {
  const status = transitionArtifact(artifact.status, 'stale')
  return Artifact.parse({ ...artifact, status, stale_reason: reason })
}

/** 변경 영향의 stale 대상을 산출물 목록에 적용한다. 대상이 아닌 산출물은 그대로 돌려준다. */
export function applyStaleTargets(artifacts: readonly Artifact[], impact: Pick<ChangeImpact, 'stale_targets'>): Artifact[] {
  const byId = new Map(impact.stale_targets.map((t) => [t.artifact_id, t] as const))
  return artifacts.map((a) => {
    const target = byId.get(a.id)
    return target === undefined ? a : markStale(a, target.reason)
  })
}
