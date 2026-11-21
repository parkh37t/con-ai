/**
 * 화면에 보여줄 집계 (순수 함수): 검증 요약, 열린 코멘트, 승인 사전 판정, IA 트리, 명세 요약.
 * 승인의 최종 판정은 서버(packages/domain evaluateApprovalGate)가 한다. 여기서는 사용자가 미리 볼 수 있는 이유만 계산한다.
 */
import type { ArtifactStatus, Comment, IANode, ScreenSpecLike, ValidationResult, ValidationStatus, ValidationSummary } from './types.js'

export const EMPTY_SUMMARY: Readonly<ValidationSummary> = { pass: 0, fail: 0, error: 0, not_run: 0 }

/** 검증 결과를 pass/fail/error/not_run 로 센다. 네 값 외의 상태는 not_run 으로 세지 않고 무시한다(실행 안 한 것과 다르므로). */
export function summarizeValidation(results: readonly Pick<ValidationResult, 'status'>[]): ValidationSummary {
  const summary: ValidationSummary = { ...EMPTY_SUMMARY }
  for (const r of results) {
    if (r.status === 'pass' || r.status === 'fail' || r.status === 'error' || r.status === 'not_run') summary[r.status] += 1
  }
  return summary
}

export const VALIDATION_STATUS_LABELS: Readonly<Record<ValidationStatus, string>> = {
  pass: '통과',
  fail: '실패',
  error: '오류',
  not_run: '미실행',
}

export const ARTIFACT_STATUS_LABELS: Readonly<Record<ArtifactStatus, string>> = {
  draft: '초안',
  validation_pending: '검증 대기',
  review_ready: '검토 가능',
  approved: '승인됨',
  stale: '무효(stale)',
}

export function countOpenComments(comments: readonly Pick<Comment, 'status'>[]): number {
  return comments.filter((c) => c.status === 'open').length
}

export function countOpenBlockingComments(comments: readonly Pick<Comment, 'status' | 'blocking'>[]): number {
  return comments.filter((c) => c.status === 'open' && c.blocking).length
}

export interface ApprovalPrecheckInput {
  artifact_status: ArtifactStatus
  artifact_hash: string
  validation_results: readonly Pick<ValidationResult, 'status' | 'required' | 'check_id' | 'artifact_hash' | 'stage'>[]
  comments: readonly Pick<Comment, 'status' | 'blocking'>[]
}
export interface ApprovalPrecheck {
  ok: boolean
  reasons: string[]
  summary: ValidationSummary
  open_blocking: number
  required_blockers: string[]
}

/**
 * 승인 전 사전 판정 — 서버 판정을 대신하지 않는다. 필수 검사 미통과, 다른 hash 의 결과, 열린 차단 코멘트, 산출물 상태를 미리 보여준다.
 */
export function approvalPrecheck(input: ApprovalPrecheckInput): ApprovalPrecheck {
  const relevant = input.validation_results.filter((r) => r.artifact_hash === input.artifact_hash)
  const foreign = input.validation_results.length - relevant.length
  const summary = summarizeValidation(relevant)
  const reasons: string[] = []
  const requiredBlockers = relevant.filter((r) => r.required && r.status !== 'pass').map((r) => `${r.check_id}(${r.stage}) ${VALIDATION_STATUS_LABELS[r.status] ?? r.status}`)
  if (input.artifact_status !== 'review_ready') {
    reasons.push(`산출물 상태가 '${ARTIFACT_STATUS_LABELS[input.artifact_status] ?? input.artifact_status}' 입니다 — 검토 가능(review_ready) 상태에서만 완료할 수 있습니다.`)
  }
  if (relevant.length === 0) reasons.push('이 artifact hash 에 대한 검증 결과가 없습니다 — 실행하지 않은 검사는 통과가 아닙니다.')
  if (foreign > 0) reasons.push(`검증 결과 ${foreign}건이 다른 artifact hash 의 것입니다 — 현재 산출물에서 재검증이 필요합니다.`)
  for (const b of requiredBlockers) reasons.push(`필수 검사 미통과: ${b}`)
  const openBlocking = countOpenBlockingComments(input.comments)
  if (openBlocking > 0) reasons.push(`열린 차단 코멘트 ${openBlocking}건이 있습니다 — 해결하거나 반영하지 않음으로 닫아야 합니다.`)
  return { ok: reasons.length === 0, reasons, summary, open_blocking: openBlocking, required_blockers: requiredBlockers }
}

// ---------------------------------------------------------------- IA 트리
export interface IATreeNode {
  node: IANode
  children: IATreeNode[]
}

/** parent_id 로 트리를 만든다. 형제는 order → name 순. 부모가 목록에 없는 노드는 최상위로 올린다(고아 노드를 잃지 않기 위해). */
export function buildIATree(nodes: readonly IANode[]): IATreeNode[] {
  const ids = new Set(nodes.map((n) => n.id))
  const byParent = new Map<string | null, IANode[]>()
  for (const n of nodes) {
    const key = n.parent_id !== null && ids.has(n.parent_id) ? n.parent_id : null
    const list = byParent.get(key) ?? []
    list.push(n)
    byParent.set(key, list)
  }
  const sortNodes = (list: IANode[]) => [...list].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'ko'))
  const visited = new Set<string>()
  const build = (parent: string | null): IATreeNode[] =>
    sortNodes(byParent.get(parent) ?? [])
      .filter((n) => !visited.has(n.id))
      .map((n) => {
        visited.add(n.id)
        return { node: n, children: build(n.id) }
      })
  return build(null)
}

// ---------------------------------------------------------------- 명세 요약
export interface SpecSummary {
  sections: number
  elements: number
  cases: number
  actions: number
  messages: number
  unresolved: number
  locked: number
}

export function summarizeSpec(spec: ScreenSpecLike | null | undefined): SpecSummary {
  const sections = spec?.sections ?? []
  return {
    sections: sections.length,
    elements: sections.reduce((n, s) => n + (s.elements?.length ?? 0), 0),
    cases: spec?.states?.length ?? 0,
    actions: spec?.actions?.length ?? 0,
    messages: spec?.messages?.length ?? 0,
    unresolved: spec?.unresolved?.length ?? 0,
    locked: (spec?.locked_elements?.length ?? 0) + (spec?.locked_actions?.length ?? 0),
  }
}

/** CASE 버튼 목록 — id 와 종류(없으면 id 로 추정). */
export function caseButtons(spec: ScreenSpecLike | null | undefined): Array<{ id: string; kind: string; label: string }> {
  const states = spec?.states ?? []
  return states.map((s) => {
    const kind = s.case_kind ?? guessCaseKind(s.id)
    return { id: s.id, kind, label: `${CASE_LABELS[kind] ?? kind} (${s.id})` }
  })
}

export const CASE_LABELS: Readonly<Record<string, string>> = {
  normal: '정상',
  empty: '빈값',
  error: '오류',
  permission: '권한',
  processing: '처리중',
}

function guessCaseKind(id: string): string {
  const lower = id.toLowerCase()
  for (const kind of Object.keys(CASE_LABELS)) if (lower.includes(kind)) return kind
  return 'normal'
}
