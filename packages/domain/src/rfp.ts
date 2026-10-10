/**
 * RFP 분석의 **규칙 계산** — 모델 출력을 그대로 믿지 않고 원문과 맞춰 본다.
 *
 * 이 파일이 막는 세 가지:
 * 1. **지어낸 인용.** 모델은 그럴듯한 문장을 만들어 낸다. `quote` 가 원문에 **실제로 없으면** 채택하지 않는다.
 *    공백·줄바꿈만 다른 경우는 통과시키되 그 사실을 적는다(`whitespace`) — 원문 재배치는 흔한 일이고
 *    그것까지 버리면 정상 추출이 전부 떨어진다.
 * 2. **임의 발번.** 요구사항 외부 ID 는 `{프로젝트코드}-{분류}-{3자리}` 규칙으로 **서버가 다시 계산**한다.
 *    모델이 준 번호를 그대로 쓰면 중복·건너뛴 번호가 그대로 기준정보가 된다.
 * 3. **조용한 누락.** 금융권 NFR 체크리스트(성능·가용성·보안·접근성·호환성·감리) 중 요구사항이 하나도 없는
 *    축은 「없음」이 아니라 **`missing`** 으로 적는다 (CLAUDE.md: 미실행·누락을 통과로 표시하지 않는다).
 *
 * 규격 출처: 사내 BA 표준(`ba-agent`) — 분류 5종·MoSCoW·출처 표기 필수·원문 그대로 인용.
 */
import type { MoscowPriority, NfrAxis, RfpNfrGap, RfpRequirementClass, RfpRequirementDraft } from '@con-ai/schemas'

/** 체크리스트 축 전체 — 판정에서 빠뜨리지 않기 위해 한 곳에 둔다. */
export const NFR_AXES: readonly NfrAxis[] = ['performance', 'availability', 'security', 'accessibility', 'compatibility', 'audit']

/** 분류 전체 (발번 접미어로도 쓴다). */
export const RFP_CLASSES: readonly RfpRequirementClass[] = ['FR', 'NFR', 'TR', 'OR', 'CR']

/** 우선순위 정렬 순서 — 화면·보고서가 같은 순서로 보여주기 위해. */
export const MOSCOW_ORDER: Readonly<Record<MoscowPriority, number>> = { M: 0, S: 1, C: 2, W: 3 }

export type QuoteMatchKind = 'exact' | 'whitespace' | 'none'

export interface QuoteMatch {
  kind: QuoteMatchKind
  /** 원문에서의 시작 위치. `exact` 일 때만 있다 (공백 정규화 위치는 원문 위치와 다르므로 적지 않는다). */
  offset?: number | undefined
}

/** 공백·줄바꿈을 한 칸으로 줄인다. PDF·HWP 에서 붙여넣은 원문은 줄바꿈 위치가 제멋대로다. */
export function normalizeQuote(text: string): string {
  return text.replace(/\s+/gu, ' ').trim()
}

/**
 * 인용이 원문에 실제로 있는지 본다.
 * `exact` → 글자 그대로 있다. `whitespace` → 공백만 다르다. `none` → **없다(지어낸 인용일 수 있다)**.
 */
export function findQuote(source: string, quote: string): QuoteMatch {
  const q = quote.trim()
  if (q.length === 0) return { kind: 'none' }
  const exact = source.indexOf(q)
  if (exact >= 0) return { kind: 'exact', offset: exact }
  const normalizedSource = normalizeQuote(source)
  const normalizedQuote = normalizeQuote(q)
  if (normalizedQuote.length > 0 && normalizedSource.includes(normalizedQuote)) return { kind: 'whitespace' }
  return { kind: 'none' }
}

/** 외부 ID 발번 — `{코드}-{분류}-{3자리}`. 이미 쓰인 번호는 건너뛴다 (재사용하지 않는다). */
export function nextRfpExternalId(code: string, kind: RfpRequirementClass, used: Iterable<string>): string {
  const prefix = `${code}-${kind}-`
  let max = 0
  for (const id of used) {
    if (!id.startsWith(prefix)) continue
    const n = Number.parseInt(id.slice(prefix.length), 10)
    if (Number.isFinite(n) && n > max) max = n
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`
}

export type RfpRejectReason = 'quote_not_found' | 'empty_title' | 'empty_priority_reason'

export const RFP_REJECT_LABELS: Readonly<Record<RfpRejectReason, string>> = {
  quote_not_found: '원문에서 그 인용을 찾지 못했다 (지어낸 인용일 수 있어 채택하지 않는다)',
  empty_title: '요구사항명이 비어 있다',
  empty_priority_reason: '우선순위 근거가 없다 (임의 판단은 채택하지 않는다)',
}

export interface RfpCheckedRequirement {
  requirement: RfpRequirementDraft
  /** 인용 확인 결과. `whitespace` 는 통과지만 화면에 그 사실을 적는다. */
  quote_match: QuoteMatchKind
}

export interface RfpRejectedRequirement {
  requirement: RfpRequirementDraft
  reason: RfpRejectReason
}

export interface RfpCheckResult {
  /** 채택 가능한 것 — 외부 ID 를 **다시 계산해** 넣었다. */
  accepted: readonly RfpCheckedRequirement[]
  /** 채택하지 않은 것과 이유. 조용히 버리지 않고 화면에 적는다. */
  rejected: readonly RfpRejectedRequirement[]
  /** 공백만 달라 통과시킨 건수 — 0 이 아니면 화면에 적는다. */
  whitespace_matches: number
  nfr_gaps: readonly RfpNfrGap[]
}

/**
 * 모델이 낸 요구사항 초안을 원문과 맞춰 보고, 외부 ID 를 다시 계산한다.
 *
 * - `source_text` 는 **사용자가 붙여넣은 원문** 그대로여야 한다. 자른 원문을 넘기면 정상 인용도 `none` 이 된다.
 * - `used` 에 기존 요구사항 외부 ID 를 넣으면 그 번호를 건너뛴다 (프로젝트에 이미 REQ 가 있을 때).
 */
export function checkRfpExtraction(input: {
  source_text: string
  drafts: readonly RfpRequirementDraft[]
  project_code: string
  used?: Iterable<string> | undefined
}): RfpCheckResult {
  const used = new Set<string>(input.used ?? [])
  const accepted: RfpCheckedRequirement[] = []
  const rejected: RfpRejectedRequirement[] = []
  let whitespace = 0

  for (const draft of input.drafts) {
    if (draft.title.trim().length === 0) {
      rejected.push({ requirement: draft, reason: 'empty_title' })
      continue
    }
    if (draft.priority_reason.trim().length === 0) {
      rejected.push({ requirement: draft, reason: 'empty_priority_reason' })
      continue
    }
    const match = findQuote(input.source_text, draft.source.quote)
    if (match.kind === 'none') {
      rejected.push({ requirement: draft, reason: 'quote_not_found' })
      continue
    }
    if (match.kind === 'whitespace') whitespace += 1

    const external_id = nextRfpExternalId(input.project_code, draft.kind, used)
    used.add(external_id)
    accepted.push({
      requirement: {
        ...draft,
        external_id,
        source: { ...draft.source, ...(match.offset === undefined ? {} : { char_offset: match.offset }) },
      },
      quote_match: match.kind,
    })
  }

  return { accepted, rejected, whitespace_matches: whitespace, nfr_gaps: rfpNfrGaps(accepted.map((a) => a.requirement)) }
}

/**
 * 금융권 NFR 체크리스트 판정.
 *
 * 한 축을 덮는 요구사항이 하나도 없으면 `missing` 이다 — 「그 항목이 필요 없다」는 뜻이 **아니다.**
 * 화면은 그 사실을 적고, 사람이 RFP 를 다시 보거나 「해당 없음」을 명시적으로 확인해야 한다.
 */
export function rfpNfrGaps(requirements: readonly RfpRequirementDraft[]): RfpNfrGap[] {
  return NFR_AXES.map((axis) => {
    // NFR·CR 만 축을 가질 수 있다 (기능 요구사항에 성능 축을 붙여 체크리스트를 덮은 것처럼 만들지 않는다).
    const found = requirements.filter((r) => r.nfr_axis === axis && (r.kind === 'NFR' || r.kind === 'CR')).map((r) => r.external_id)
    return { axis, status: found.length > 0 ? ('covered' as const) : ('missing' as const), found }
  })
}

/** 화면·보고서용 정렬 — 우선순위(M→W) → 분류(FR→CR) → 외부 ID. */
export function sortRfpRequirements(requirements: readonly RfpRequirementDraft[]): RfpRequirementDraft[] {
  const classOrder = new Map(RFP_CLASSES.map((c, i) => [c, i]))
  return [...requirements].sort((a, b) => {
    const p = MOSCOW_ORDER[a.priority] - MOSCOW_ORDER[b.priority]
    if (p !== 0) return p
    const k = (classOrder.get(a.kind) ?? 9) - (classOrder.get(b.kind) ?? 9)
    if (k !== 0) return k
    return a.external_id.localeCompare(b.external_id)
  })
}
