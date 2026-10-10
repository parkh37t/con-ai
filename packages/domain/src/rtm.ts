/**
 * RTM — 추적 체인 REQ → IA → FN → SCR 의 집계·갭 제안·G1 추적성 판정.
 * (산출물 pipeline-v2 P1-05 「ID 매핑 매트릭스」)
 *
 * 커버리지 규칙 — 부풀리지 않기 위해 코드로 고정하는 것:
 * - **분모는 프로젝트의 요구사항(REQ) 수다.** 중복 ID·문자열 출현 수·INDEX 행 수가 아니다 (CLAUDE.md).
 * - **비UI 전용 REQ 를 분모에서 빼지 않는다.** 빼면 비율이 저절로 올라간다 — 그것이 분모 조작이다.
 *   대신 `non_ui_only` 로 따로 세고 화면에 그 수를 함께 적는다.
 * - **한 REQ 가 여러 화면에 걸쳐도 분자는 1 이다.** 화면 수를 분자로 세면 100% 를 넘는다.
 * - **분모가 0 이면 비율은 null 이다.** 0/0 을 100% 로 표시하지 않는다 (coverage.ts 와 같은 규칙).
 * - 체인이 SCR 까지 닿아야 `mapped` 다. IA 까지만 닿으면 `partial` 이며 통과로 세지 않는다.
 *
 * 여기서 하지 않는 것:
 * - 수용 테스트(AcceptanceTest) 엔터티가 아직 없으므로 「검증 완료」는 계산하지 않고 `not_run` 으로 돌려준다.
 *   미실행을 통과로 표시하지 않는다 (CLAUDE.md).
 * - 갭을 자동으로 메우지 않는다. 제안만 만들고 발번·연결은 사람이 승인한다.
 *   발번 제안에는 계산된 다음 번호(`suggested_value`)를 함께 담지만 그것은 «초안» 이다 —
 *   사람이 고칠 수 있고, 저장할 때 서버가 다시 계산해 다르면 그 사실을 알린다.
 */
import type { IANode, InternalId } from '@con-ai/schemas'
import { proposeFnExternalId, proposeIaExternalId } from './id-registry.js'

// ─────────────────────────────────────────────────────────── 입력

/** 요구사항 — API 저장 문서의 평탄한 형태 (계약 §1 requirement). */
export interface RtmRequirement {
  external_id: string
  title: string
  criteria: readonly { id: string; kind: 'ui' | 'non_ui' }[]
}

/** 화면 — 목록 요약이면 충분하다. */
export interface RtmScreen {
  id: InternalId
  external_id: string
  title: string
  status: 'draft' | 'review' | 'approved'
  current_revision_id?: string | undefined
}

/** 현재 revision 의 명세가 담고 있는 요소·동작 로컬 ID 집합. 없으면 «아직 생성 안 됨». */
export interface RtmSpecIndex {
  screen_plan_id: InternalId
  element_or_action_ids: readonly string[]
}

export interface RtmInput {
  requirements: readonly RtmRequirement[]
  ia_nodes: readonly IANode[]
  screens: readonly RtmScreen[]
  /** 요소 태깅이 아직 유효한지 보기 위한 색인. 넘기지 않으면 태깅 판정은 not_run 이다. */
  spec_indexes?: readonly RtmSpecIndex[] | undefined
}

const ALLOWED_INPUT_KEYS: ReadonlySet<string> = new Set<keyof RtmInput>(['requirements', 'ia_nodes', 'screens', 'spec_indexes'])

/**
 * 입력에 허용된 키만 있는지 확인한다. coverage.ts 와 같은 장치 —
 * 중복 ID 수·문자열 출현 수·INDEX 행 수 같은 값이 분모 자리에 들어오는 것을 실행 시점에도 막는다.
 */
export function assertRtmInputKeys(input: object): string[] {
  return Object.keys(input).filter((k) => !ALLOWED_INPUT_KEYS.has(k))
}

// ─────────────────────────────────────────────────────────── 출력

/** 행 상태. 네 값의 합이 요구사항 총계와 같아야 한다 (분류 누락 방지). */
export type RtmRowStatus = 'mapped' | 'partial' | 'non_ui_only' | 'unmapped'

export interface RtmFnCell {
  id: InternalId
  name: string
  /** 발번 전이면 없다. 화면은 «미발번» 으로 적는다. */
  external_id?: string | undefined
}

export interface RtmIaCell {
  id: InternalId
  name: string
  external_id?: string | undefined
}

export interface RtmScrCell {
  id: InternalId
  external_id: string
  title: string
  status: 'draft' | 'review' | 'approved'
}

export interface RtmRow {
  requirement_external_id: string
  title: string
  /** 이 REQ 의 UI 수용조건 수. 0 이면 화면에 그릴 것이 없는 요구사항이다. */
  ui_criteria: number
  non_ui_criteria: number
  ia: readonly RtmIaCell[]
  fn: readonly RtmFnCell[]
  scr: readonly RtmScrCell[]
  status: RtmRowStatus
  /** mapped 가 아닌 이유. mapped 면 없다. */
  gap_reason?: string | undefined
}

/** 요소 태깅 판정 — 「요소는 FN·IA 없이 저장 불가」를 이 조각에서는 G1 미통과로만 강제한다. */
export interface RtmElementTagging {
  /** FN 이 가리키는 요소 참조 총계. */
  refs_total: number
  /** 현재 명세에 실재하는 참조. */
  refs_live: number
  /** 명세가 바뀌어 사라진 참조 (고아). 자동 복구하지 않고 사람에게 알린다. */
  refs_stale: number
  /** 아직 생성되지 않아 판정할 수 없는 화면. untagged 0 으로 세지 않는다. */
  not_run_screens: readonly string[]
}

/** 검증 완료 — 아직 셀 수단이 없다. 미실행을 통과로 표시하지 않기 위해 이 형태로 돌려준다. */
export interface RtmTestPass {
  status: 'not_run'
  reason: string
}

export interface RtmSummary {
  requirements_total: number
  mapped: number
  partial: number
  non_ui_only: number
  unmapped: number
  /** mapped / requirements_total. 분모가 0 이면 null (0/0 을 100% 로 표시하지 않는다). */
  req_to_scr_ratio: number | null
  ia_nodes_total: number
  ia_nodes_issued: number
  functions_total: number
  functions_issued: number
  /** 총계이지 비율의 분모가 아니다 — 화면에 그렇게 적는다. */
  screens_total: number
  test_pass: RtmTestPass
  element_tagging: RtmElementTagging
}

/** 갭 제안 한 건. 사람이 승인해야 실제로 반영된다. */
export interface RtmGapProposal {
  /** 무엇을 하자는 제안인가. */
  kind: 'link_requirement' | 'define_function' | 'link_screen' | 'issue_ia_id' | 'issue_fn_id'
  requirement_external_id?: string | undefined
  ia_node_id?: InternalId | undefined
  /**
   * `issue_fn_id` 의 **대상 기능**(내부 UUID).
   *
   * 이게 없어서 화면이 「보고서 전체의 첫 미발번 기능」을 집어 보냈고, 다른 노드의 기능이 집히면
   * `기능 <uuid> 가 이 IA 노드에 없다` 로 400 이 났다. 해시(`proposal_hash`)는 처음부터 기능 id 를
   * 포함했으므로, 제안이 대상을 직접 들고 오지 않으면 해시 조회도 노드 단위로밖에 못 했다.
   */
  function_id?: InternalId | undefined
  /** 제안하는 값 (외부 ID 등). 발번 제안이면 계산된 다음 번호. */
  suggested_value?: string | undefined
  /** 왜 이 제안인가 — 화면에 그대로 적는다. */
  rationale: string
  /** 제안 내용이 바뀌었는지 확인하는 값. 승인 요청이 이 값을 함께 보내 stale 제안 승인을 막는다. */
  proposal_hash: string
}

export interface RtmReport {
  summary: RtmSummary
  rows: readonly RtmRow[]
  proposals: readonly RtmGapProposal[]
  /** G1 게이트의 추적성 조건 판정. 다른 G1 조건(검증·보류 사유·사인오프)은 여기서 보지 않는다. */
  g1_traceability: { passed: boolean; reason: string }
}

// ─────────────────────────────────────────────────────────── 계산

/** 결정적 문자열 해시 (FNV-1a 32bit). 암호용이 아니라 «내용이 바뀌었는가» 만 보는 값이다. */
export function proposalHash(parts: readonly string[]): string {
  let h = 0x811c9dc5
  for (const part of parts.join('\u0000')) {
    h ^= part.codePointAt(0) ?? 0
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/** IA 노드가 담당하는 요구사항 외부 ID 집합. */
function requirementIdsOf(node: IANode): readonly string[] {
  return node.requirement_ids ?? []
}

/**
 * 이 IA 노드에서 도달할 수 있는 화면 — 자신과 모든 하위 노드의 screen_plan_id.
 * 카테고리 노드에 REQ 를 붙였을 때 그 아래 화면들이 체인에 들어오게 한다.
 */
function reachableScreenIds(nodes: readonly IANode[], rootId: InternalId): Set<InternalId> {
  const children = new Map<string, IANode[]>()
  for (const n of nodes) {
    if (n.parent_id === null) continue
    const list = children.get(n.parent_id)
    if (list) list.push(n)
    else children.set(n.parent_id, [n])
  }
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const found = new Set<InternalId>()
  const seen = new Set<string>()
  const stack: string[] = [rootId]
  while (stack.length > 0) {
    const id = stack.pop()
    if (id === undefined || seen.has(id)) continue
    seen.add(id)
    const node = byId.get(id)
    if (node?.screen_plan_id !== undefined) found.add(node.screen_plan_id)
    for (const child of children.get(id) ?? []) stack.push(child.id)
  }
  return found
}

/** 이 IA 노드와 하위 노드가 가진 기능 전부. */
function reachableFunctions(nodes: readonly IANode[], rootId: InternalId): RtmFnCell[] {
  const children = new Map<string, IANode[]>()
  for (const n of nodes) {
    if (n.parent_id === null) continue
    const list = children.get(n.parent_id)
    if (list) list.push(n)
    else children.set(n.parent_id, [n])
  }
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const out: RtmFnCell[] = []
  const seen = new Set<string>()
  const stack: string[] = [rootId]
  while (stack.length > 0) {
    const id = stack.pop()
    if (id === undefined || seen.has(id)) continue
    seen.add(id)
    const node = byId.get(id)
    for (const fn of node?.functions ?? []) out.push({ id: fn.id, name: fn.name, external_id: fn.external_id })
    for (const child of children.get(id) ?? []) stack.push(child.id)
  }
  return out
}

function taggingOf(input: RtmInput): RtmElementTagging {
  const indexes = input.spec_indexes
  let total = 0
  let live = 0
  let stale = 0
  const notRun = new Set<string>()
  const byScreen = new Map(indexes?.map((i) => [i.screen_plan_id, new Set(i.element_or_action_ids)]) ?? [])
  const screenLabel = new Map(input.screens.map((s) => [s.id, s.external_id]))

  for (const node of input.ia_nodes) {
    for (const fn of node.functions ?? []) {
      for (const ref of fn.element_refs ?? []) {
        total += 1
        const index = byScreen.get(ref.screen_plan_id)
        if (index === undefined) {
          // 명세를 읽지 못했다 — 없는 것으로 세지 않고 미실행으로 남긴다.
          notRun.add(screenLabel.get(ref.screen_plan_id) ?? ref.screen_plan_id)
          continue
        }
        if (index.has(ref.element_or_action_id)) live += 1
        else stale += 1
      }
    }
  }
  return { refs_total: total, refs_live: live, refs_stale: stale, not_run_screens: [...notRun].sort() }
}

/** RTM 을 계산한다. 순수 함수 — 저장하지 않고 매번 문서에서 만든다. */
export function computeRtm(input: RtmInput): RtmReport {
  const extra = assertRtmInputKeys(input)
  if (extra.length > 0) {
    throw new Error(`RTM 입력이 아니다 — 허용되지 않는 키: ${extra.join(', ')} (분모를 부풀리는 값을 넣지 않는다)`)
  }

  const screensById = new Map(input.screens.map((s) => [s.id, s]))
  const rows: RtmRow[] = []

  for (const req of input.requirements) {
    const uiCriteria = req.criteria.filter((c) => c.kind === 'ui').length
    const nonUiCriteria = req.criteria.length - uiCriteria

    const owningNodes = input.ia_nodes.filter((n) => requirementIdsOf(n).includes(req.external_id))
    const ia: RtmIaCell[] = owningNodes.map((n) => ({ id: n.id, name: n.name, external_id: n.external_id }))

    const fnMap = new Map<string, RtmFnCell>()
    const scrIds = new Set<InternalId>()
    for (const n of owningNodes) {
      for (const fn of reachableFunctions(input.ia_nodes, n.id)) fnMap.set(fn.id, fn)
      for (const sid of reachableScreenIds(input.ia_nodes, n.id)) scrIds.add(sid)
    }
    const fn = [...fnMap.values()]
    const scr: RtmScrCell[] = [...scrIds]
      .map((id) => screensById.get(id))
      .filter((s): s is RtmScreen => s !== undefined)
      .map((s) => ({ id: s.id, external_id: s.external_id, title: s.title, status: s.status }))

    let status: RtmRowStatus
    let gapReason: string | undefined
    if (uiCriteria === 0) {
      // 화면에 그릴 UI 수용조건이 하나도 없다. 분모에는 남기되 분자에는 넣지 않는다.
      status = 'non_ui_only'
      gapReason = 'UI 수용조건이 없어 화면으로 확인할 수 없는 요구사항이다 (분모에는 남긴다)'
    } else if (owningNodes.length === 0) {
      status = 'unmapped'
      gapReason = '이 요구사항을 담당하는 IA 노드가 없다'
    } else if (fn.length === 0) {
      status = 'partial'
      gapReason = 'IA 노드는 연결됐지만 기능(FN)이 정의되지 않았다'
    } else if (scr.length === 0) {
      status = 'partial'
      gapReason = 'IA 노드는 연결됐지만 화면(SCR)이 연결되지 않았다'
    } else {
      status = 'mapped'
    }

    rows.push({
      requirement_external_id: req.external_id,
      title: req.title,
      ui_criteria: uiCriteria,
      non_ui_criteria: nonUiCriteria,
      ia,
      fn,
      scr,
      status,
      gap_reason: gapReason,
    })
  }

  const count = (s: RtmRowStatus) => rows.filter((r) => r.status === s).length
  const total = rows.length
  const mapped = count('mapped')

  let fnTotal = 0
  let fnIssued = 0
  for (const n of input.ia_nodes) {
    for (const f of n.functions ?? []) {
      fnTotal += 1
      if (f.external_id !== undefined) fnIssued += 1
    }
  }

  const summary: RtmSummary = {
    requirements_total: total,
    mapped,
    partial: count('partial'),
    non_ui_only: count('non_ui_only'),
    unmapped: count('unmapped'),
    req_to_scr_ratio: total === 0 ? null : mapped / total,
    ia_nodes_total: input.ia_nodes.length,
    ia_nodes_issued: input.ia_nodes.filter((n) => n.external_id !== undefined).length,
    functions_total: fnTotal,
    functions_issued: fnIssued,
    screens_total: input.screens.length,
    test_pass: { status: 'not_run', reason: '수용 테스트(AcceptanceTest)를 저장하는 곳이 아직 없어 실행하지 않았다 — 미실행은 통과가 아니다' },
    element_tagging: taggingOf(input),
  }

  return { summary, rows, proposals: proposeGapFills(input, rows), g1_traceability: judgeG1Traceability(summary) }
}

/**
 * 갭 제안 — 규칙 기반이며 저장하지 않는다. 사람이 「승인 · ID 발번」 을 눌러야 반영된다.
 * 제안은 «무엇을 하면 이 행이 mapped 가 되는가» 를 한 걸음씩 적는다.
 */
export function proposeGapFills(input: RtmInput, rows: readonly RtmRow[]): RtmGapProposal[] {
  const out: RtmGapProposal[] = []
  const screensById = new Map(input.screens.map((s) => [s.id, s]))

  for (const row of rows) {
    if (row.status === 'mapped' || row.status === 'non_ui_only') continue

    if (row.status === 'unmapped') {
      // 화면 노드 중 아직 REQ 를 하나도 담당하지 않은 곳을 후보로 제시한다.
      const candidates = input.ia_nodes.filter((n) => n.kind === 'screen' && requirementIdsOf(n).length === 0)
      const first = candidates[0]
      const label = first ? `「${first.name}」` : '아직 없다 — IA 노드를 먼저 만든다'
      out.push({
        kind: 'link_requirement',
        requirement_external_id: row.requirement_external_id,
        ia_node_id: first?.id,
        suggested_value: row.requirement_external_id,
        rationale: `${row.requirement_external_id} 를 담당할 IA 노드가 없다. 후보: ${label}. 사람이 확인해 연결하면 체인이 시작된다.`,
        proposal_hash: proposalHash(['link_requirement', row.requirement_external_id, first?.id ?? '']),
      })
      continue
    }

    for (const ia of row.ia) {
      if (row.fn.length === 0) {
        out.push({
          kind: 'define_function',
          requirement_external_id: row.requirement_external_id,
          ia_node_id: ia.id,
          rationale: `${row.requirement_external_id} 가 「${ia.name}」 에 연결됐지만 기능(FN)이 없다. 기능을 정의하고 FN 번호를 발번하면 체인이 이어진다.`,
          proposal_hash: proposalHash(['define_function', row.requirement_external_id, ia.id]),
        })
      }
      // 분류(category) 노드에는 화면을 직접 붙일 수 없다 (설계 §6; `canLinkScreenToIaNode` 가 거부한다).
      // 그래서 제안하지 않는다 — 승인자·사유를 다 받고 400 을 돌려주는 **막다른 버튼**을 그리지 않기 위해서다.
      // 행의 `gap_reason` 이 이 경우를 그대로 적는다.
      const kindOf = input.ia_nodes.find((n) => n.id === ia.id)?.kind
      if (row.scr.length === 0 && kindOf !== 'category') {
        out.push({
          kind: 'link_screen',
          requirement_external_id: row.requirement_external_id,
          ia_node_id: ia.id,
          rationale: `「${ia.name}」 에 화면이 연결되지 않았다. 화면을 만들어 연결하면 SCR 까지 닿는다.`,
          proposal_hash: proposalHash(['link_screen', row.requirement_external_id, ia.id]),
        })
      }
    }
  }

  // 발번 제안 — 체인에 있는데 아직 번호가 없는 것.
  for (const node of input.ia_nodes) {
    const used = requirementIdsOf(node).length > 0 || (node.functions ?? []).length > 0 || node.screen_plan_id !== undefined
    if (!used) continue
    if (node.external_id === undefined) {
      // 제안값은 트리 위치로 계산한 다음 번호다. 사람이 고쳐 넣을 수 있고, 저장할 때 다시 계산해 다르면 알린다.
      const suggested = proposeIaExternalId(input.ia_nodes, node.id)
      out.push({
        kind: 'issue_ia_id',
        ia_node_id: node.id,
        ...(suggested === null ? {} : { suggested_value: suggested }),
        rationale: `「${node.name}」 는 체인에 쓰이는데 IA 번호가 미발번이다.${suggested === null ? ' 트리 위치를 찾지 못해 번호를 계산하지 못했다 — 사람이 직접 넣어야 한다.' : ` 트리 위치로 계산한 번호는 ${suggested} 다.`}`,
        proposal_hash: proposalHash(['issue_ia_id', node.id]),
      })
      continue
    }
    for (const fn of node.functions ?? []) {
      if (fn.external_id !== undefined) continue
      const screen = node.screen_plan_id === undefined ? undefined : screensById.get(node.screen_plan_id)
      const suggested = proposeFnExternalId(node)
      out.push({
        kind: 'issue_fn_id',
        ia_node_id: node.id,
        function_id: fn.id,
        ...(suggested === null ? {} : { suggested_value: suggested }),
        rationale: `기능 「${fn.name}」${screen ? ` (${screen.external_id})` : ''} 가 미발번이다. 소속 ${node.external_id} 아래로 번호를 발번한다.${suggested === null ? ' 남은 번호가 없어 계산하지 못했다 (01~99).' : ` 계산된 다음 번호는 ${suggested} 다.`}`,
        proposal_hash: proposalHash(['issue_fn_id', node.id, fn.id]),
      })
    }
  }
  return out
}

/**
 * G1 게이트의 추적성 조건 판정.
 * 「REQ→SCR 커버리지 100%」 하나만 본다 — 나머지 G1 조건은 이 화면이 실행하지 않으므로 판정하지 않는다.
 * 분모가 0 이거나 UI 수용조건이 하나도 없으면 통과로 보지 않는다 (0/0 을 100% 로 만들지 않는다).
 */
export function judgeG1Traceability(summary: RtmSummary): { passed: boolean; reason: string } {
  if (summary.requirements_total === 0) {
    return { passed: false, reason: '요구사항이 없어 커버리지를 계산할 수 없다 — 0/0 을 100% 로 보지 않는다' }
  }
  if (summary.req_to_scr_ratio === null) {
    return { passed: false, reason: '커버리지를 계산할 수 없다' }
  }
  if (summary.unmapped > 0 || summary.partial > 0) {
    return { passed: false, reason: `미매핑 ${summary.unmapped}건 · 부분 매핑 ${summary.partial}건이 남아 있다` }
  }
  if (summary.non_ui_only > 0) {
    return {
      passed: false,
      reason: `비UI 전용 요구사항 ${summary.non_ui_only}건은 화면으로 확인할 수 없다 — 화면 밖 처리 승인 수단이 아직 없어 통과로 보지 않는다`,
    }
  }
  return { passed: true, reason: `요구사항 ${summary.requirements_total}건이 모두 화면까지 연결됐다` }
}
