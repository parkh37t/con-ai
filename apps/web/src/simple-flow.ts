/**
 * "만들기" 화면(한 줄 입력 → 화면설계서)의 순수 규칙.
 *
 * 기획자는 문장 하나만 쓴다. 나머지 항목(작업 유형·CASE·참고 화면·역할·유지 조건)은 여기서 기본값으로 채운다.
 * 자동으로 채운 값과 그 근거는 화면(`autoFillNotes`)과 작업 문맥에 그대로 보여 준다 — 숨기지 않는다.
 */
import { guessScreenKind } from './browser-run/deps.js'
import type { Device, ProjectDetail, Reference, ScreenSpecLike, ScreenSummary, SliceCase, SliceGenerationRequest } from './types.js'

/** 자동으로 넣는 CASE — 정상·빈값·오류 (설계서에 최소한 이 세 가지는 있어야 검토가 된다). */
export const DEFAULT_CASES: readonly SliceCase[] = ['normal', 'empty', 'error']

/**
 * 문장에서 짐작한 화면 종류 (기본 목록).
 * "견적 목록을 조회하고 상세로 이동" 처럼 여러 낱말이 나오면 먼저 나온 쪽(= 문장의 주어)을 고른다.
 *
 * 판정 규칙은 `@con-ai/schemas` 의 guessScreenKind 하나를 쓴다 — 화면과 더미 어댑터가 다르게 짐작하면
 * 사용자는 「목록으로 짐작」이라는 안내를 보고 히어로 화면을 받는다.
 */
export function guessCategory(sentence: string): Reference['category'] {
  return guessScreenKind(sentence).kind
}

/**
 * 참고 화면 자동 선택 — 문장에서 짐작한 종류와 같은 레퍼런스 1개.
 * 근거: 레퍼런스는 S2B 학습 규격을 적용한 골든 예시라서, 같은 종류를 붙이면 열 구성·설명 순서가 규격에 맞게 나온다.
 * 같은 종류가 없으면 아무것도 고르지 않는다 (없는 것을 억지로 붙이지 않는다).
 */
export function autoReferenceIds(sentence: string, references: readonly Reference[]): string[] {
  const category = guessCategory(sentence)
  const match = references.find((r) => r.category === category) ?? (category === 'form' ? references.find((r) => r.category === 'popup') : undefined)
  return match ? [match.id] : []
}

/** 문장 → 화면 제목. 첫 문장에서 조사·서술어를 떼고 30자 이내로 줄인다. 빈 문장이면 '새 화면'. */
export function deriveTitle(sentence: string): string {
  const first = sentence
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0)
  if (!first) return '새 화면'
  // 첫 문장만 쓴다 (마침표·중점 기준).
  const head = first.split(/[.。·]/)[0]?.trim() ?? first
  // 끝에 붙은 부탁 표현만 떼어낸다 (예: "… 화면을 만들어" → "… 화면").
  const noun = head
    .replace(/\s*(을|를|이|가)?\s*(만들어|만들|생성해|생성|그려|그려줘|해줘|주세요|해 줘)\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
  const text = noun.length > 0 ? noun : head
  return text.length > 30 ? `${text.slice(0, 29)}…` : text
}

/** 만들 화면의 shell — 팝업 낱말이 있으면 팝업. 포털 이름은 프로젝트의 기존 화면에서 가져온다. */
export function deriveShell(sentence: string, screens: readonly Pick<ScreenSummary, 'shell'>[]): string {
  const portals = new Map<string, number>()
  for (const s of screens) {
    const m = /^(.+)-(?:page|popup)$/.exec(s.shell ?? '')
    if (m?.[1]) portals.set(m[1], (portals.get(m[1]) ?? 0) + 1)
  }
  let portal = 'partner'
  let best = 0
  for (const [name, n] of portals) {
    if (n > best) {
      portal = name
      best = n
    }
  }
  const category = guessCategory(sentence)
  return category === 'popup' || category === 'form' ? `${portal}-popup` : `${portal}-page`
}

export interface AutoFill {
  request: SliceGenerationRequest
  /** 자동으로 채운 값과 근거 (화면에 그대로 보여 준다). */
  notes: string[]
}

/**
 * 문장 하나 → 생성 요청. 나머지는 전부 기본값이다.
 * - `purpose` 와 `prompt_override` 에 같은 문장을 넣는다 (서버는 prompt_override 가 있으면 그것을 지시로 쓰고 문맥은 그대로 첨부한다).
 * - 요구사항·수용조건·역할·유지 조건은 비운다 (고급 화면에서 고른다).
 */
export function buildSimpleCreateRequest(input: { screen_id: string; sentence: string; device: Device; references: readonly Reference[] }): AutoFill {
  const sentence = input.sentence.trim()
  const reference_ids = autoReferenceIds(sentence, input.references)
  const request: SliceGenerationRequest = {
    screen_id: input.screen_id,
    task_type: 'create',
    purpose: sentence,
    requirement_ids: [],
    criterion_ids: [],
    reference_ids,
    cases: [...DEFAULT_CASES],
    keep_conditions: [],
    roles: [],
    device: input.device,
    prompt_override: sentence,
  }
  const refTitle = reference_ids[0] === undefined ? null : (input.references.find((r) => r.id === reference_ids[0])?.title ?? null)
  const notes = [
    `작업 유형: 신규 생성 · 기기: ${input.device === 'mobile' ? '모바일' : 'PC'}`,
    `CASE: 정상·빈값·오류 (검토에 필요한 최소 구성)`,
    refTitle ? `참고 화면: ${refTitle} — 문장에서 짐작한 종류(${guessCategory(sentence)})와 같은 골든 예시` : '참고 화면: 없음 (문장에서 종류를 짐작하지 못했습니다)',
    '요구사항·수용조건·역할·유지 조건: 비움 (고급 화면에서 고를 수 있습니다)',
  ]
  return { request, notes }
}

/** 결과 화면의 한 줄 수정 → edit 요청. 기준 revision·CASE 는 지금 보고 있는 설계서에서 가져온다. */
export function buildSimpleEditRequest(input: { screen_id: string; base_revision_id: string; instruction: string; device: Device; spec: ScreenSpecLike | null }): SliceGenerationRequest {
  const text = input.instruction.trim()
  const cases = casesOfSpec(input.spec)
  return {
    screen_id: input.screen_id,
    task_type: 'edit',
    purpose: text.length > 120 ? `${text.slice(0, 117)}...` : text,
    requirement_ids: [],
    criterion_ids: [],
    reference_ids: [],
    cases,
    keep_conditions: [],
    roles: [],
    device: input.device,
    base_revision_id: input.base_revision_id,
    prompt_override: text,
  }
}

/** 명세에 있는 CASE 종류 (없으면 정상만). 수정해도 CASE 가 사라지지 않게 그대로 이어 받는다. */
export function casesOfSpec(spec: ScreenSpecLike | null | undefined): SliceCase[] {
  const kinds = (spec?.states ?? []).map((s) => s.case_kind).filter((k): k is SliceCase => k !== undefined)
  const unique = [...new Set(kinds)]
  return unique.length > 0 ? unique : ['normal']
}

/**
 * 프로젝트 안에서 겹치지 않는 다음 외부 ID (`SCREEN-001`).
 * 서버 `apps/api/src/screens.ts` 의 nextScreenExternalId 와 같은 규칙이다 — 브라우저 모드(demo-api)가 같은 ID 를 붙이도록 여기에도 둔다.
 */
export function nextScreenExternalId(existing: readonly string[]): string {
  let max = 0
  for (const id of existing) {
    const m = /^SCREEN-(\d+)$/.exec(id)
    if (!m) continue
    const n = Number.parseInt(m[1] ?? '', 10)
    if (Number.isFinite(n) && n > max) max = n
  }
  const taken = new Set(existing)
  let next = max + 1
  let candidate = `SCREEN-${String(next).padStart(3, '0')}`
  while (taken.has(candidate)) {
    next += 1
    candidate = `SCREEN-${String(next).padStart(3, '0')}`
  }
  return candidate
}

// ---------------------------------------------------------------- 진행 표시

/** 단계 → 사람 말 한 줄. 기술 용어(단계 이름·작업 ID)는 쓰지 않는다. */
export const SIMPLE_STAGE_TEXT: Readonly<Record<string, string>> = {
  context_build: '자료를 정리하는 중',
  spec_generate: '명세 작성 중',
  schema_check: '내용 확인 중',
  render: '화면 그리는 중',
  validate: '검사 중',
  persist: '마무리 중',
}

/** "설계서를 만들고 있습니다 · 명세 작성 중" 같은 한 줄. */
export function progressLine(input: { status: string; stage?: string | undefined; verb?: string }): string {
  const verb = input.verb ?? '설계서를 만들고 있습니다'
  if (input.status === 'queued') return `${verb} · 준비 중`
  const text = input.stage === undefined ? undefined : SIMPLE_STAGE_TEXT[input.stage]
  return text === undefined ? verb : `${verb} · ${text}`
}

/** 실패를 사람 말 한 줄로. 원인 코드는 숨기지 않되 앞에 무엇이 잘못됐는지 먼저 쓴다. */
export const SIMPLE_FAILURE_TEXT: Readonly<Record<string, string>> = {
  model_error: 'AI 가 응답하지 못했습니다',
  schema_invalid: 'AI 가 만든 설계 내용이 규격에 맞지 않았습니다',
  reference_invalid: '참고 자료 연결이 맞지 않았습니다',
  renderer_error: '설계서를 화면으로 그리지 못했습니다',
  timeout: '시간이 너무 오래 걸려 멈췄습니다',
  cancelled: '작업이 취소되었습니다',
  internal: '알 수 없는 문제가 생겼습니다',
  no_credential: 'Claude 토큰이 필요합니다',
}

export function failureLine(failure: { code?: string; message?: string } | null | undefined): string {
  const head = SIMPLE_FAILURE_TEXT[failure?.code ?? 'internal'] ?? '만들지 못했습니다'
  const detail = failure?.message?.trim()
  return detail ? `${head} — ${detail}` : `${head}.`
}

// ---------------------------------------------------------------- 최근 설계서

export interface RecentDesign {
  screen_id: string
  revision_id: string
  external_id: string
  title: string
  versions: number
  status: ScreenSummary['status']
}

/**
 * 최근 만든 설계서 카드 — 결과(revision)가 있는 화면만, 마지막에 만든 것부터.
 * 화면 목록의 순서가 곧 만든 순서다(저장소가 created_at 순으로 준다).
 */
export function recentDesigns(detail: ProjectDetail | null | undefined, limit = 6): RecentDesign[] {
  const screens = detail?.screens ?? []
  const out: RecentDesign[] = []
  for (const s of screens) {
    if (!s.current_revision_id) continue
    out.push({ screen_id: s.id, revision_id: s.current_revision_id, external_id: s.external_id, title: s.title, versions: Math.max(1, s.revision_count), status: s.status })
  }
  return out.reverse().slice(0, limit)
}
