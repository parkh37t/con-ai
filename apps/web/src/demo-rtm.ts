/**
 * 정적 데모(배포 주소)의 추적 체인·ID 발번 — `#/trace` 가 서버 없이도 실제로 동작하게 한다.
 *
 * 규칙 (CLAUDE.md)
 * - **계산 규칙을 다시 쓰지 않는다.** 커버리지·갭 제안·발번 판정은 서버와 같은 `@con-ai/domain` 함수를 그대로 부른다.
 *   여기서 하는 일은 스냅샷 상태를 도메인 입력 모양으로 옮기고 결과를 저장하는 것뿐이다.
 * - **ID 발번은 사람이 누른다.** 행위자·사유가 없으면 도메인이 거절한다 — 데모라고 느슨하게 하지 않는다.
 * - **저장 전에 스키마로 검사한다.** 서버와 같은 `IANode` zod 스키마를 통과하지 못하면 저장하지 않는다.
 * - **새로고침 후에도 남는다.** 바뀐 노드는 이 브라우저의 localStorage 에 쌓인다(`browser-run/store.ts`).
 *   다른 사람과 공유되지 않으며 원본 스냅샷 파일은 그대로다.
 */
import {
  DomainRuleError,
  IANodeSchema,
  assertAllowed,
  canIssueIaExternalId,
  computeRtm,
  issueFnExternalId,
  issueIaExternalId,
  proposeFnExternalId,
  proposeIaExternalId,
  relabelFnExternalId,
  relabelIaExternalId,
  type IANodeShape,
  type RtmInput,
  type RtmSpecIndex,
} from './browser-run/deps.js'
import { browserRuntime } from './browser-run/runtime.js'
import type { DemoResponse } from './demo-api.js'
import type { IANode, ProjectDetail, RevisionDetail } from './types.js'

/** 이 모듈이 쓰는 데모 상태의 일부 (DemoState 가 그대로 만족한다 — 순환 import 를 만들지 않으려고 좁게 받는다). */
export interface DemoRtmState {
  gets: Map<string, unknown>
  /** IA 노드 문서 revision (낙관적 잠금). 스냅샷 노드는 1 에서 시작한다. */
  ia_revisions: Map<string, number>
}

const PROJECT_PATH = /^\/api\/projects\/([^/]+)$/

// ---------------------------------------------------------------- 응답 보조

function notFound(what: string): DemoResponse {
  return { status: 404, data: { error: 'not_found', message: `${what}을(를) 찾을 수 없습니다 (정적 데모 스냅샷에 없음)` } }
}

function badRequest(error: string, message: string, extra: Record<string, unknown> = {}): DemoResponse {
  return { status: 400, data: { error, message, ...extra } }
}

function staleRevision(expected: number, current: number): DemoResponse {
  return {
    status: 409,
    data: { error: 'stale_revision', message: `문서가 그 사이 바뀌었습니다 (본 revision ${expected}, 현재 ${current}). 새로고침 후 다시 시도하세요.`, expected, current },
  }
}

function ruleRejected(error: string, e: DomainRuleError): DemoResponse {
  return { status: 400, data: { error, message: e.message, reasons: e.reasons } }
}

// ---------------------------------------------------------------- 상태 읽기

function projectDetails(state: DemoRtmState): ProjectDetail[] {
  const out: ProjectDetail[] = []
  for (const [path, value] of state.gets) {
    if (PROJECT_PATH.test(path)) out.push(value as ProjectDetail)
  }
  return out
}

function projectDetailOf(state: DemoRtmState, projectId: string): ProjectDetail | undefined {
  return state.gets.get(`/api/projects/${projectId}`) as ProjectDetail | undefined
}

/** 노드 id 로 소속 프로젝트와 노드를 찾는다. 데모에 프로젝트가 여러 개여도 맞게 고른다. */
function locate(state: DemoRtmState, nodeId: string): { detail: ProjectDetail; node: IANode } | undefined {
  for (const detail of projectDetails(state)) {
    const node = detail.ia_nodes.find((n) => n.id === nodeId)
    if (node) return { detail, node }
  }
  return undefined
}

/** 스냅샷 노드는 revision 1 에서 시작한다 (서버가 문서를 처음 저장했을 때와 같은 값). */
export function iaRevisionOf(state: DemoRtmState, nodeId: string): number {
  return state.ia_revisions.get(nodeId) ?? 1
}

/**
 * 스냅샷 상태 → RTM 입력.
 * `spec_indexes` 는 **현재 revision 이 있는 화면만** 담는다 (apps/api 의 rtm-adapter 와 같은 규칙) —
 * 아직 만들지 않은 화면을 「요소 0개」로 넘기면 태깅이 전부 stale 로 보인다.
 */
export function demoRtmInput(state: DemoRtmState, detail: ProjectDetail): RtmInput {
  const spec_indexes: RtmSpecIndex[] = []
  for (const screen of detail.screens) {
    if (screen.current_revision_id === undefined) continue
    const revision = state.gets.get(`/api/revisions/${screen.current_revision_id}`) as RevisionDetail | undefined
    if (!revision) continue
    spec_indexes.push({ screen_plan_id: screen.id, element_or_action_ids: revision.element_index.map((e) => e.element_id) })
  }
  return {
    requirements: detail.requirements.map((r) => ({ external_id: r.external_id, title: r.title, criteria: r.criteria.map((c) => ({ id: c.id, kind: c.kind })) })),
    ia_nodes: detail.ia_nodes as IANodeShape[],
    screens: detail.screens.map((s) => ({ id: s.id, external_id: s.external_id, title: s.title, status: s.status, current_revision_id: s.current_revision_id })),
    spec_indexes,
  }
}

// ---------------------------------------------------------------- 저장

/**
 * 바뀐 노드를 스냅샷 상태에 반영하고 이 브라우저에 남긴다.
 * 저장 실패(사생활 보호 모드·용량 초과)는 삼키지 않고 응답에 적어 화면이 알리게 한다.
 */
function saveNode(state: DemoRtmState, detail: ProjectDetail, next: IANodeShape): { revision: number; stored: boolean } {
  const revision = iaRevisionOf(state, next.id) + 1
  const node = next as IANode
  detail.ia_nodes = detail.ia_nodes.map((n) => (n.id === node.id ? node : n))
  state.ia_revisions.set(node.id, revision)
  const stored = browserRuntime.store.setIaNode(node, revision)
  return { revision, stored }
}

/** 저장이 이 브라우저에 남지 않았으면 그 사실을 응답에 싣는다 (조용히 성공으로 보이게 두지 않는다). */
function storageNote(stored: boolean): Record<string, unknown> {
  if (stored) return {}
  return { storage_warning: browserRuntime.store.lastError ?? '이 브라우저에 저장하지 못했습니다 — 새로고침하면 사라집니다.' }
}

/** 스키마 검사 — 서버와 같은 지점에서 같은 스키마로 막는다. */
function checked(next: unknown, message: string): { node: IANodeShape } | { response: DemoResponse } {
  const parsed = IANodeSchema.safeParse(next)
  if (!parsed.success) {
    return {
      response: badRequest('invalid_ia_node', message, {
        reasons: parsed.error.issues.map((i) => ({ code: 'ia_node.invalid', message: `${i.path.map(String).join('.')}: ${i.message}` })),
      }),
    }
  }
  return { node: parsed.data }
}

// ---------------------------------------------------------------- 요청 본문

function asRecord(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {}
}

function text(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim().length > 0 ? v : undefined
}

/** 행위자·사유·본 revision — 세 값은 발번에도 연결에도 똑같이 필요하다. */
interface ActorBody {
  by: string
  reason: string
  revision: number
}

function actorBody(body: unknown): ActorBody | DemoResponse {
  const rec = asRecord(body)
  const by = text(rec['by'])
  const reason = text(rec['reason'])
  const revision = rec['revision']
  const issues: string[] = []
  if (by === undefined) issues.push('by(행위자) 는 빈 문자열일 수 없습니다')
  if (reason === undefined) issues.push('reason(사유) 는 빈 문자열일 수 없습니다')
  if (typeof revision !== 'number' || !Number.isInteger(revision) || revision < 1) issues.push('revision 은 1 이상의 정수여야 합니다')
  if (by === undefined || reason === undefined || typeof revision !== 'number' || !Number.isInteger(revision) || revision < 1) {
    return badRequest('invalid_request', '요청 본문이 올바르지 않습니다', { issues })
  }
  return { by, reason, revision }
}

function isResponse(v: ActorBody | DemoResponse): v is DemoResponse {
  return 'status' in v
}

// ---------------------------------------------------------------- 처리기

/** `GET /api/projects/:id/rtm` — 저장하지 않고 매번 계산한다 (서버와 같다). */
export function demoRtm(state: DemoRtmState, projectId: string): DemoResponse {
  const detail = projectDetailOf(state, projectId)
  if (!detail) return notFound('프로젝트')
  return { status: 200, data: computeRtm(demoRtmInput(state, detail)) }
}

/** `GET /api/ia-nodes/:id` — 화면이 저장 직전에 현재 revision 을 읽는다. */
export function demoIaNode(state: DemoRtmState, nodeId: string): DemoResponse {
  const found = locate(state, nodeId)
  if (!found) return notFound('IA 노드')
  return { status: 200, data: { ia_node: found.node, revision: iaRevisionOf(state, nodeId) } }
}

/** `PATCH /api/ia-nodes/:id` — 요구사항 연결·기능 정의. 번호는 여기서 붙이지 않는다. */
export function demoPatchIaNode(state: DemoRtmState, nodeId: string, body: unknown): DemoResponse {
  const found = locate(state, nodeId)
  if (!found) return notFound('IA 노드')
  const parsed = actorBody(body)
  if (isResponse(parsed)) return parsed
  const current = iaRevisionOf(state, nodeId)
  if (parsed.revision !== current) return staleRevision(parsed.revision, current)

  const rec = asRecord(body)
  let next: IANode = { ...found.node }

  const requirementIds = rec['requirement_ids']
  if (requirementIds !== undefined) {
    if (!Array.isArray(requirementIds) || requirementIds.some((r) => text(r) === undefined)) {
      return badRequest('invalid_request', '요청 본문이 올바르지 않습니다', { issues: ['requirement_ids 는 빈 문자열이 아닌 문자열 배열이어야 합니다'] })
    }
    // 없는 REQ 를 연결하면 커버리지가 거짓이 된다 — 저장 전에 막는다 (서버와 같은 검사).
    const known = new Set(found.detail.requirements.map((r) => r.external_id))
    const unknown = (requirementIds as string[]).filter((r) => !known.has(r))
    if (unknown.length > 0) {
      return badRequest('requirement_not_found', '없는 요구사항은 연결할 수 없다', {
        reasons: unknown.map((r) => ({ code: 'rtm.requirement_unknown', message: `${r} 는 이 프로젝트에 없다` })),
      })
    }
    next = { ...next, requirement_ids: requirementIds as string[], change_reason: parsed.reason }
  }

  const addFunction = rec['add_function']
  if (addFunction !== undefined) {
    const fn = asRecord(addFunction)
    const name = text(fn['name'])
    if (name === undefined) return badRequest('invalid_request', '요청 본문이 올바르지 않습니다', { issues: ['add_function.name 은 빈 문자열일 수 없습니다'] })
    const kind = fn['kind'] === 'exception' ? 'exception' : 'normal'
    const base = text(fn['base_function_id'])
    next = {
      ...next,
      functions: [...(next.functions ?? []), { id: browserRuntime.newId(), name, kind, ...(base === undefined ? {} : { base_function_id: base }) }],
    }
  }

  const check = checked(next, 'IA 노드 규칙에 어긋난다')
  if ('response' in check) return check.response
  const saved = saveNode(state, found.detail, check.node)
  return { status: 200, data: { ia_node: check.node, revision: saved.revision, ...storageNote(saved.stored) } }
}

/**
 * `POST /api/ia-nodes/:id/id-issuances` — 사람이 「승인 · ID 발번」 을 눌렀을 때만 온다.
 * 번호를 **다시 계산**해 요청값과 다르면 그 사실을 응답에 실어 화면이 알린다 (서버와 같다).
 */
export function demoIssueId(state: DemoRtmState, nodeId: string, body: unknown): DemoResponse {
  const found = locate(state, nodeId)
  if (!found) return notFound('IA 노드')
  const parsed = actorBody(body)
  if (isResponse(parsed)) return parsed
  const rec = asRecord(body)
  const externalId = text(rec['external_id'])
  if (externalId === undefined) return badRequest('invalid_request', '요청 본문이 올바르지 않습니다', { issues: ['external_id 는 빈 문자열일 수 없습니다'] })
  const current = iaRevisionOf(state, nodeId)
  if (parsed.revision !== current) return staleRevision(parsed.revision, current)

  const functionId = text(rec['function_id'])
  const expectedHash = text(rec['expected_proposal_hash'])
  // 화면이 본 제안이 그 사이 바뀌었으면 승인하지 않는다 (문서 revision 만으로는 제안 내용 변경을 못 잡는다).
  if (expectedHash !== undefined) {
    const kind = functionId === undefined ? 'issue_ia_id' : 'issue_fn_id'
    const proposal = computeRtm(demoRtmInput(state, found.detail)).proposals.find((p) => p.kind === kind && p.ia_node_id === nodeId)
    if (proposal === undefined || proposal.proposal_hash !== expectedHash) {
      return { status: 409, data: { error: 'stale_proposal', message: '화면에 보인 제안이 그 사이 바뀌었다. 새로고침 후 다시 확인한다' } }
    }
  }

  const nodes = found.detail.ia_nodes as IANodeShape[]
  const target = found.node as IANodeShape
  const input = { external_id: externalId, by: parsed.by, reason: parsed.reason, at: browserRuntime.now() }
  let next: IANodeShape
  let recomputed: string | null
  try {
    if (functionId === undefined) {
      recomputed = proposeIaExternalId(nodes, nodeId)
      assertAllowed(canIssueIaExternalId(nodes, target, input), 'IA 외부 ID 를 발번할 수 없다')
      next = issueIaExternalId(nodes, target, input)
    } else {
      recomputed = proposeFnExternalId(target)
      next = issueFnExternalId(target, functionId, input)
    }
  } catch (e) {
    if (e instanceof DomainRuleError) return ruleRejected('id_issuance_rejected', e)
    throw e
  }

  const check = checked(next, '발번 결과가 IA 노드 규칙에 어긋난다')
  if ('response' in check) return check.response
  const saved = saveNode(state, found.detail, check.node)
  return {
    status: 200,
    data: {
      ia_node: check.node,
      revision: saved.revision,
      issued_external_id: externalId,
      recomputed_external_id: recomputed,
      differs: recomputed !== null && recomputed !== externalId,
      ...storageNote(saved.stored),
    },
  }
}

/** `POST /api/ia-nodes/:id/id-relabels` — 옛 값을 지우지 않고 별칭으로 내린다. */
export function demoRelabelId(state: DemoRtmState, nodeId: string, body: unknown): DemoResponse {
  const found = locate(state, nodeId)
  if (!found) return notFound('IA 노드')
  const parsed = actorBody(body)
  if (isResponse(parsed)) return parsed
  const rec = asRecord(body)
  const externalId = text(rec['external_id'])
  if (externalId === undefined) return badRequest('invalid_request', '요청 본문이 올바르지 않습니다', { issues: ['external_id 는 빈 문자열일 수 없습니다'] })
  const current = iaRevisionOf(state, nodeId)
  if (parsed.revision !== current) return staleRevision(parsed.revision, current)

  const functionId = text(rec['function_id'])
  const nodes = found.detail.ia_nodes as IANodeShape[]
  const target = found.node as IANodeShape
  const input = { external_id: externalId, by: parsed.by, reason: parsed.reason, at: browserRuntime.now() }
  let next: IANodeShape
  try {
    next = functionId === undefined ? relabelIaExternalId(nodes, target, input) : relabelFnExternalId(target, functionId, input)
  } catch (e) {
    if (e instanceof DomainRuleError) return ruleRejected('id_relabel_rejected', e)
    throw e
  }

  const check = checked(next, '개명 결과가 IA 노드 규칙에 어긋난다')
  if ('response' in check) return check.response
  const saved = saveNode(state, found.detail, check.node)
  return { status: 200, data: { ia_node: check.node, revision: saved.revision, ...storageNote(saved.stored) } }
}
