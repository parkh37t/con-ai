/**
 * RFP 분석 실행 — 어댑터(`extractRfp`)로 요구사항·평가항목 초안을 만들고 **규칙으로 검사해** 저장한다.
 *
 * 이 러너가 지키는 것:
 * - **모델 출력을 그대로 저장하지 않는다.** `checkRfpExtraction`(규칙 계산)이 인용을 원문과 맞춰 보고
 *   외부 ID 를 다시 계산한 뒤에만 `requirements` 에 들어간다. 떨어진 것은 `rejected` 로 **남긴다**(조용히 버리지 않는다).
 * - **실패를 succeeded 로 표시하지 않는다.** CLI 없음·로그인 안 됨·한도·시간 초과를 각각 다른 코드로 적는다.
 * - **채택(adopt)은 별개 작업이다.** 분석은 초안을 만들 뿐이고, 사람이 채택해야 `requirement` 문서가 된다 —
 *   그때부터 RTM 의 분모에 들어간다 (채택 전에는 분모에 넣지 않는다).
 * - 원문(`source_text`)을 문서에 보관한다. 채택 시점에 인용을 **다시** 확인하고 재분석에도 쓴다.
 *   이 값은 로컬 DB 에만 있고 저장소에 커밋하지 않는다 (CLAUDE.md: 고객 자료를 공개 저장소에 넣지 않는다).
 */
import { checkRfpExtraction, type RfpRejectReason } from '@con-ai/domain'
import { AdapterError, type ModelAdapter } from '@con-ai/model-adapter'
import type { RfpEvaluationItem, RfpNfrGap, RfpOverview, RfpRequirementDraft, RfpUnresolved } from '@con-ai/schemas'
import type { Store, StoredDocument } from '@con-ai/worker-generation'

export type RfpStatus = 'queued' | 'running' | 'succeeded' | 'failed'

/**
 * 실패 코드. 사용자가 **할 일이 다르므로** 뭉개지 않는다:
 * `auth` 는 로그인·설치, `limit` 은 기다리기, `timeout` 은 원문을 줄이기, `extract` 는 원문·스키마 문제.
 */
export type RfpFailureCode = 'auth' | 'limit' | 'timeout' | 'extract' | 'internal'

export const RFP_FAILURE_LABELS: Readonly<Record<RfpFailureCode, string>> = {
  auth: '모델을 부를 수 없습니다 (설치·로그인 확인)',
  limit: '사용 한도에 걸렸습니다',
  timeout: '시간이 너무 걸려 중단했습니다',
  extract: '원문에서 요구사항을 뽑지 못했습니다',
  internal: '서버 오류',
}

export interface RfpFailure {
  code: RfpFailureCode
  message: string
}

/** 채택되지 못한 초안 — 이유와 함께 보관해 화면에 적는다. */
export interface RfpRejectedDraft {
  reason: RfpRejectReason
  kind: RfpRequirementDraft['kind']
  title: string
  quote: string
}

/** 채택 기록 — 누가·언제·무엇을 채택했는지. */
export interface RfpAdoption {
  external_id: string
  requirement_id: string
  by: string
  reason: string
  at: string
}

export interface RfpAnalysisDocument {
  id: string
  project_id: string
  project_code: string
  source_name: string
  /** 붙여넣은 원문. 채택 시 인용을 다시 확인하고 재분석에 쓴다. 로컬 DB 에만 둔다. */
  source_text: string
  source_hash: string
  source_chars: number
  note?: string | undefined
  status: RfpStatus
  failure?: RfpFailure | undefined
  adapter: ModelAdapter['kind']
  model: string
  created_at: string
  finished_at?: string | undefined
  overview?: RfpOverview | undefined
  evaluation_items: RfpEvaluationItem[]
  /** 인용 검사를 통과하고 외부 ID 를 다시 받은 초안. 아직 채택 전이다. */
  requirements: RfpRequirementDraft[]
  /** 공백만 달라 통과시킨 건수. 0 이 아니면 화면에 적는다. */
  whitespace_matches: number
  rejected: RfpRejectedDraft[]
  nfr_gaps: RfpNfrGap[]
  unresolved: RfpUnresolved[]
  adoptions: RfpAdoption[]
}

export interface RfpRunnerDeps {
  store: Store
  adapter: ModelAdapter
  now: () => string
  log?: ((line: string) => void) | undefined
}

/** 어댑터 오류 → 실패 코드. 모르는 오류를 `extract` 로 뭉개지 않고 internal 로 남긴다. */
export function rfpFailureOf(err: unknown): RfpFailure {
  if (err instanceof AdapterError) {
    const message = err.message
    switch (err.code) {
      case 'cli_missing':
      case 'not_logged_in':
      case 'auth':
        return { code: 'auth', message }
      case 'rate_limit':
      case 'budget':
        return { code: 'limit', message }
      case 'timeout':
      case 'cancelled':
        return { code: 'timeout', message }
      case 'parse':
      case 'empty_output':
      case 'refusal':
      case 'bad_request':
        return { code: 'extract', message }
      default:
        return { code: 'internal', message }
    }
  }
  return { code: 'internal', message: err instanceof Error ? err.message : String(err) }
}

/** FNV-1a 32bit — 「같은 원문인가」만 보는 값이다 (RTM 의 proposalHash 와 같은 규칙). */
export function sourceHash(text: string): string {
  let h = 0x811c9dc5
  for (const ch of text) {
    h ^= ch.codePointAt(0) ?? 0
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

export async function runRfpAnalysis(analysisId: string, deps: RfpRunnerDeps): Promise<void> {
  const stored = deps.store.get<RfpAnalysisDocument>('rfp_analysis', analysisId)
  if (!stored) throw new Error(`RFP 분석 문서를 찾을 수 없다: ${analysisId}`)
  if (stored.data.status !== 'queued') throw new Error(`queued 상태의 분석만 실행할 수 있다: ${analysisId} 는 ${stored.data.status}`)

  /** 항상 최신 revision 을 다시 읽어 저장한다 (채택 PATCH 와의 충돌 방지). */
  const save = (patch: Partial<RfpAnalysisDocument>): StoredDocument<RfpAnalysisDocument> => {
    const fresh = deps.store.get<RfpAnalysisDocument>('rfp_analysis', analysisId)
    if (!fresh) throw new Error(`RFP 분석 문서가 사라졌다: ${analysisId}`)
    return deps.store.put<RfpAnalysisDocument>('rfp_analysis', analysisId, { ...fresh.data, ...patch }, fresh.revision)
  }

  save({ status: 'running' })
  const doc = stored.data
  try {
    const wire = await deps.adapter.extractRfp({
      text: doc.source_text,
      source_name: doc.source_name,
      ...(doc.note === undefined ? {} : { note: doc.note }),
    })

    // 이미 이 프로젝트에 있는 요구사항 번호는 건너뛴다 (번호를 재사용하지 않는다).
    const used = deps.store
      .list<{ project_id: string; external_id: string }>('requirement', (d) => d.data.project_id === doc.project_id)
      .map((d) => d.data.external_id)

    const checked = checkRfpExtraction({
      source_text: doc.source_text,
      // wire 에는 external_id 가 없다 — 발번은 여기서 한다. 자리만 채워 넘긴다.
      drafts: wire.requirements.map((r) => ({ ...r, external_id: '(미발번)', criteria: r.criteria ?? [] })),
      project_code: doc.project_code,
      used,
    })

    save({
      status: 'succeeded',
      finished_at: deps.now(),
      overview: wire.overview,
      evaluation_items: wire.evaluation_items,
      requirements: checked.accepted.map((a) => a.requirement),
      whitespace_matches: checked.whitespace_matches,
      rejected: checked.rejected.map((r) => ({ reason: r.reason, kind: r.requirement.kind, title: r.requirement.title, quote: r.requirement.source.quote })),
      nfr_gaps: [...checked.nfr_gaps],
      unresolved: wire.unresolved,
    })
    deps.log?.(`[rfp] ${analysisId} 완료 — 채택 가능 ${checked.accepted.length}건 · 거부 ${checked.rejected.length}건`)
  } catch (err) {
    const failure = rfpFailureOf(err)
    save({ status: 'failed', failure, finished_at: deps.now() })
    deps.log?.(`[rfp] ${analysisId} 실패 (${failure.code})`)
  }
}

/** 큐 밖에서 예외가 났는데 분석이 아직 종료 상태가 아니면 failed(internal) 로 닫는다. */
export function markRfpFailedIfUnfinished(store: Store, analysisId: string, at: string, message: string): void {
  const doc = store.get<RfpAnalysisDocument>('rfp_analysis', analysisId)
  if (!doc) return
  if (doc.data.status !== 'queued' && doc.data.status !== 'running') return
  store.put<RfpAnalysisDocument>('rfp_analysis', analysisId, { ...doc.data, status: 'failed', finished_at: at, failure: { code: 'internal', message } }, doc.revision)
}

/** 서버 시작 시: queued/running 으로 남은 분석을 failed 로 정리한다 (생성 작업·AS-IS 와 같은 관례). */
export function recoverInterruptedRfpAnalyses(store: Store, now: () => string): string[] {
  const interrupted = store.list<RfpAnalysisDocument>('rfp_analysis', (d) => d.data.status === 'queued' || d.data.status === 'running')
  const at = now()
  const ids: string[] = []
  for (const doc of interrupted) {
    store.put<RfpAnalysisDocument>('rfp_analysis', doc.id, { ...doc.data, status: 'failed', finished_at: at, failure: { code: 'internal', message: '서버 재시작으로 중단' } }, doc.revision)
    ids.push(doc.id)
  }
  return ids
}
