/**
 * AS-IS 분석 상세 (계약 §12) — 상태 폴링(2초), 실패 코드·원인, 요약, 발견된 신호,
 * 페인포인트 카드(채택/거부 → PATCH), 스크린샷 토글, 구조 요약 전체 표(접힘).
 *
 * 읽는 순서를 결론부터로 바꿨다: **헤더 → 요약 → 발견된 신호 → 페인포인트 → 스크린샷·구조 상세**.
 * 예전에는 스크린샷이 화면 위쪽을 차지해 정작 판단에 쓰는 요약·페인포인트가 한참 아래에 있었다.
 */
import { useEffect, useState } from 'react'
import { adapterBadgeText } from '../adapter-badge.js'
import { ApiError, api } from '../api.js'
import {
  asisDurationLabel,
  asisFailureLabel,
  asisSignalRows,
  asisStatusLabel,
  asisStatusTone,
  filterPainPoints,
  isTerminalAsis,
  painPointStatusLabel,
  painPointStatusTone,
  painPointTally,
  severityLabel,
  severityTone,
  structureSummaryRows,
  type PainPointStatusFilter,
  type SeverityFilter,
} from '../asis.js'
import { Badge, Collapsible, Empty, ErrorBox, Loading, formatDateTime } from '../components/common.js'
import { JOB_POLL_INTERVAL_MS, useAsync } from '../hooks.js'
import { hrefTo } from '../router.js'
import type { AsisAnalysis, AsisStructure, PainPoint, PainPointStatus, PainPointSeverity } from '../types.js'

/** 근거 문구가 이보다 길면 한 줄에 두지 않고 접는다. */
const EVIDENCE_INLINE_MAX = 90

const SEVERITY_FILTERS: ReadonlyArray<{ value: SeverityFilter; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'high', label: '높음' },
  { value: 'medium', label: '중간' },
  { value: 'low', label: '낮음' },
]
const STATUS_FILTERS: ReadonlyArray<{ value: PainPointStatusFilter; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'proposed', label: '제안' },
  { value: 'adopted', label: '채택' },
  { value: 'rejected', label: '거부' },
]

export function AsisDetailPage({ analysisId }: { analysisId: string }) {
  const load = useAsync(() => api.asisAnalysis(analysisId), [analysisId])
  // 페인포인트 PATCH 응답(갱신된 문서)이 폴링 결과보다 최신이므로 우선한다. 폴링은 종료 상태에서 멈춘다.
  const [override, setOverride] = useState<AsisAnalysis | null>(null)
  // 폴링 중 일시 오류로 useAsync 의 data 가 비어도 마지막으로 읽은 문서를 유지한다.
  const [lastKnown, setLastKnown] = useState<AsisAnalysis | null>(null)
  useEffect(() => {
    if (load.data) setLastKnown(load.data)
  }, [load.data])
  const analysis = override ?? load.data ?? lastKnown

  const status = analysis?.status
  const reload = load.reload
  // 분석이 없어진 경우(404)는 다시 시도하지 않는다. 일시 오류는 다음 주기에 다시 읽는다.
  const gone = load.error instanceof ApiError && load.error.status === 404
  useEffect(() => {
    if (gone || status === undefined || isTerminalAsis(status)) return
    const timer = setInterval(reload, JOB_POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [gone, status, reload])

  const [busyPp, setBusyPp] = useState<string | null>(null)
  const [patchError, setPatchError] = useState<unknown>(null)
  const setPainPointStatus = async (painPointId: string, next: PainPointStatus) => {
    if (!analysis) return
    setBusyPp(painPointId)
    setPatchError(null)
    try {
      setOverride(await api.patchAsisPainPoint(analysis.id, painPointId, { status: next, revision: analysis.revision ?? 1 }))
    } catch (e) {
      setPatchError(e)
    } finally {
      setBusyPp(null)
    }
  }

  if (load.error && !analysis) return <ErrorBox error={load.error} title="분석을 읽지 못했습니다" />
  if (!analysis) return <Loading text="분석을 불러오는 중…" />
  const polling = !isTerminalAsis(analysis.status)
  const duration = asisDurationLabel(analysis.created_at, analysis.finished_at)

  return (
    <div className="page page-reading">
      <nav className="breadcrumb" aria-label="경로">
        <a href={hrefTo('asis')}>AS-IS 분석</a> <span aria-hidden="true">›</span> 상세
      </nav>

      {/* 헤더 — 대상 URL 이 제목이고, 상태·어댑터·소요·시각은 그 아래 작은 한 줄 메타로 합친다. */}
      <header className="page-head asis-head">
        <h2 className="asis-head-url">{analysis.url}</h2>
        <p className="asis-head-meta">
          <span data-testid="asis-status" data-status={analysis.status}>
            <Badge tone={asisStatusTone(analysis.status)}>{asisStatusLabel(analysis.status)}</Badge>
          </span>
          <span className="muted">
            {analysis.adapter === 'anthropic' ? '실제 호출 · ' : ''}
            {adapterBadgeText({ adapter: analysis.adapter, model: analysis.model })}
          </span>
          {duration && <span className="muted">소요 {duration}</span>}
          <span className="muted">{formatDateTime(analysis.created_at)}</span>
        </p>
        {analysis.note && <p className="asis-head-note muted small">메모 · {analysis.note}</p>}
        {polling && <div className="notice">분석이 진행 중입니다 — 2초마다 자동 갱신됩니다. (수집 → 페인포인트 초안)</div>}
        {load.error ? <ErrorBox error={load.error} title="상태를 갱신하지 못했습니다 (다음 주기에 다시 시도)" /> : null}
      </header>

      {analysis.status === 'failed' && (
        <div className="error-box" role="alert" data-testid="asis-failure">
          <strong>
            분석 실패 — {asisFailureLabel(analysis.failure?.code)}
            {analysis.failure?.code ? (
              <>
                {' '}
                (코드 <code>{analysis.failure.code}</code>)
              </>
            ) : null}
          </strong>
          <div>{analysis.failure?.message ?? '실패 원인이 기록되지 않았습니다.'}</div>
          <p className="small">
            이 개발 환경에서는 외부 URL 이 네트워크 정책에 막힐 수 있습니다. 사용자 PC 에서는 제약이 없습니다. 동작 확인은 목록 화면의 데모 대상(/asis-sample)으로 할 수
            있습니다.
          </p>
        </div>
      )}

      {analysis.status === 'succeeded' && (
        <>
          <section className="card">
            <h3 className="section-title">요약</h3>
            <div className="asis-summary" data-testid="asis-summary">
              {analysis.summary?.trim() ? analysis.summary : '요약이 기록되지 않았습니다.'}
            </div>
          </section>

          <SignalsCard structure={analysis.structure} />

          <PainPointsCard
            painPoints={analysis.pain_points}
            busyPp={busyPp}
            patchError={patchError}
            onSetStatus={(id, next) => void setPainPointStatus(id, next)}
          />

          <ScreenshotCard analysis={analysis} />

          <StructureCard structure={analysis.structure} />
        </>
      )}
    </div>
  )
}

/** 발견된 신호 — 구조 요약 중 문제 있는 항목만 붉은 계열로 강조한다. 정상 항목 전체 표는 아래 접힘에 있다. */
function SignalsCard({ structure }: { structure: AsisStructure | undefined }) {
  const signals = asisSignalRows(structure)
  return (
    <section className="card">
      <div className="card-head">
        <h3 className="section-title">발견된 신호</h3>
        <span className="muted small">{signals.length === 0 ? '규칙에 걸린 항목 없음' : `${signals.length}건 · 규칙에 걸린 항목만`}</span>
      </div>
      {!structure ? (
        <Empty>구조 정보가 기록되지 않았습니다.</Empty>
      ) : signals.length === 0 ? (
        <Empty>규칙(레이블 없는 필드·alt 없는 이미지·h1 없음·평평한 메뉴·iframe·meta description)에 걸린 항목이 없습니다.</Empty>
      ) : (
        <ul className="signal-list">
          {signals.map((s) => (
            <li key={s.key} className="signal" data-testid="asis-signal" data-key={s.key}>
              <span className="signal-value">{s.value}</span>
              <span className="signal-text">
                <strong>{s.label}</strong>
                <span className="muted small">{s.hint}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function PainPointsCard({
  painPoints,
  busyPp,
  patchError,
  onSetStatus,
}: {
  painPoints: PainPoint[]
  busyPp: string | null
  patchError: unknown
  onSetStatus: (id: string, next: PainPointStatus) => void
}) {
  const [severity, setSeverity] = useState<SeverityFilter>('all')
  const [statusFilter, setStatusFilter] = useState<PainPointStatusFilter>('all')
  const tally = painPointTally(painPoints)
  const shown = filterPainPoints(painPoints, severity, statusFilter)

  return (
    <section className="card">
      <div className="card-head">
        <h3 className="section-title">페인포인트</h3>
        <span className="muted small">{painPoints.length}건 · 채택/거부로 확정합니다 (초안 상태는 "제안")</span>
      </div>
      {patchError ? <ErrorBox error={patchError} title="페인포인트 상태를 바꾸지 못했습니다" /> : null}
      {painPoints.length === 0 ? (
        <Empty>페인포인트 초안이 없습니다.</Empty>
      ) : (
        <>
          <div className="pp-filters">
            <div className="pp-filter-group" role="group" aria-label="심각도 필터">
              <span className="pp-filter-label muted small">심각도</span>
              {SEVERITY_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  className={`chip chip-button${severity === f.value ? ' chip-current' : ''}`}
                  aria-pressed={severity === f.value}
                  onClick={() => setSeverity(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="pp-filter-group" role="group" aria-label="상태 필터">
              <span className="pp-filter-label muted small">상태</span>
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  className={`chip chip-button${statusFilter === f.value ? ' chip-current' : ''}`}
                  aria-pressed={statusFilter === f.value}
                  onClick={() => setStatusFilter(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <span className="pp-tally muted small">
              제안 {tally.proposed} · 채택 {tally.adopted} · 거부 {tally.rejected}
            </span>
          </div>
          {shown.length === 0 ? (
            <Empty>이 조건에 맞는 페인포인트가 없습니다. 필터를 「전체」로 되돌리세요.</Empty>
          ) : (
            <ul className="pp-list">
              {shown.map((p) => (
                <PainPointCard key={p.id} painPoint={p} busy={busyPp === p.id} onSetStatus={onSetStatus} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

function PainPointCard({ painPoint: p, busy, onSetStatus }: { painPoint: PainPoint; busy: boolean; onSetStatus: (id: string, next: PainPointStatus) => void }) {
  return (
    <li className="pp-card" data-testid="asis-pain-row" data-pp-id={p.id} data-status={p.status} data-severity={p.severity}>
      {/* 심각도 스트라이프 — 이 화면에서 의미색을 쓰는 유일한 자리 (styles.css 주석 참고). */}
      <span className={`pp-stripe pp-stripe-${severityKey(p.severity)}`} aria-hidden="true" />
      <div className="pp-main">
        <div className="pp-head">
          <code className="pp-id">{p.id}</code>
          <span className="pp-area">{p.area}</span>
          <Badge tone={severityTone(p.severity)}>{severityLabel(p.severity)}</Badge>
          <Badge tone={painPointStatusTone(p.status)}>{painPointStatusLabel(p.status)}</Badge>
          <span className="pp-actions">
            <button
              type="button"
              className={`btn btn-small${p.status === 'adopted' ? ' is-on' : ''}`}
              data-testid="pp-adopt"
              aria-pressed={p.status === 'adopted'}
              disabled={busy || p.status === 'adopted'}
              onClick={() => onSetStatus(p.id, 'adopted')}
            >
              채택
            </button>
            <button
              type="button"
              className={`btn btn-small${p.status === 'rejected' ? ' is-on' : ''}`}
              data-testid="pp-reject"
              aria-pressed={p.status === 'rejected'}
              disabled={busy || p.status === 'rejected'}
              onClick={() => onSetStatus(p.id, 'rejected')}
            >
              거부
            </button>
          </span>
        </div>
        <p className="pp-desc">{p.description}</p>
        {p.evidence && <Evidence text={p.evidence} />}
        {p.suggestion && (
          <p className="pp-line">
            <span className="pp-tag">제안</span> {p.suggestion}
          </p>
        )}
      </div>
    </li>
  )
}

/** 근거는 모노 한 줄. 길면 접어 두고 필요할 때만 편다. */
function Evidence({ text }: { text: string }) {
  if (text.length <= EVIDENCE_INLINE_MAX) {
    return (
      <p className="pp-line">
        <span className="pp-tag">근거</span> <code className="pp-evidence">{text}</code>
      </p>
    )
  }
  return (
    <details className="pp-evidence-more">
      <summary>
        <span className="pp-tag">근거</span> <code className="pp-evidence">{text.slice(0, EVIDENCE_INLINE_MAX)}…</code>
      </summary>
      <code className="pp-evidence pp-evidence-full">{text}</code>
    </details>
  )
}

function severityKey(severity: PainPointSeverity | string): string {
  return severity === 'high' || severity === 'medium' || severity === 'low' ? severity : 'low'
}

function ScreenshotCard({ analysis }: { analysis: AsisAnalysis }) {
  const [shot, setShot] = useState<'desktop' | 'mobile'>('desktop')
  const shots = analysis.screenshots
  return (
    <section className="card">
      <div className="card-head">
        <h3 className="section-title">스크린샷</h3>
        <span className="muted small">데스크톱 1280×800 (전체 페이지) · 모바일 390×844</span>
      </div>
      {!shots ? (
        <Empty>스크린샷이 기록되지 않았습니다.</Empty>
      ) : (
        <>
          <div className="shot-toggle">
            <button type="button" className={`btn btn-small${shot === 'desktop' ? ' active' : ''}`} data-testid="asis-shot-desktop" onClick={() => setShot('desktop')}>
              데스크톱
            </button>
            <button type="button" className={`btn btn-small${shot === 'mobile' ? ' active' : ''}`} data-testid="asis-shot-mobile" onClick={() => setShot('mobile')}>
              모바일
            </button>
          </div>
          <div className="shot-wrap">
            <img
              className={`asis-screenshot shot-${shot}`}
              data-testid="asis-screenshot"
              data-shot={shot}
              src={api.asisAssetUrl(shot === 'desktop' ? shots.desktop : shots.mobile)}
              alt={`${analysis.url} ${shot === 'desktop' ? '데스크톱' : '모바일'} 스크린샷`}
            />
          </div>
        </>
      )}
    </section>
  )
}

/** 구조 요약 전체 — 문제 항목은 위 「발견된 신호」에 있으므로 여기는 접어 둔다. */
function StructureCard({ structure }: { structure: AsisStructure | undefined }) {
  const rows = structureSummaryRows(structure)
  return (
    <section className="card">
      <div className="card-head">
        <h3 className="section-title">구조 상세</h3>
        <span className="muted small">Playwright 가 수집한 페이지 구조 (계약 §12 structure)</span>
      </div>
      {!structure || rows.length === 0 ? (
        <Empty>구조 정보가 기록되지 않았습니다.</Empty>
      ) : (
        <>
          <Collapsible title={`구조 요약 전체 (${rows.length}항목)`}>
            <div className="table-wrap">
              <table className="table compact" data-testid="asis-structure">
                <thead>
                  <tr>
                    <th>항목</th>
                    <th>값</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key} data-testid="asis-structure-row" data-key={r.key} data-value={r.value}>
                      <td>{r.label}</td>
                      <td>{r.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Collapsible>
          <StructureDetails structure={structure} />
        </>
      )}
    </section>
  )
}

function StructureDetails({ structure }: { structure: AsisStructure }) {
  const headings = structure.headings ?? []
  const navLinks = structure.nav_links ?? []
  const forms = structure.forms ?? []
  const buttons = structure.buttons ?? []
  return (
    <>
      {headings.length > 0 && (
        <Collapsible title={`헤딩 (${headings.length})`}>
          <ul>
            {headings.map((h, i) => (
              <li key={i}>
                <code>h{h.level}</code> {h.text}
              </li>
            ))}
          </ul>
        </Collapsible>
      )}
      {navLinks.length > 0 && (
        <Collapsible title={`내비 링크 (${navLinks.length})`}>
          <ul>
            {navLinks.map((l, i) => (
              <li key={i}>
                {l.text || '(문구 없음)'} <code className="muted">{l.href}</code>
              </li>
            ))}
          </ul>
        </Collapsible>
      )}
      {forms.length > 0 && (
        <Collapsible title={`폼·필드 (${forms.length})`}>
          <ul>
            {forms.map((f, i) => (
              <li key={i}>
                <strong>{f.name || `(이름 없는 폼 ${i + 1})`}</strong>
                <ul>
                  {(f.fields ?? []).map((field, j) => (
                    <li key={j}>
                      <code>{field.type}</code> {field.label ? field.label : <Badge tone="amber">레이블 없음</Badge>}
                      {field.name && <span className="muted small"> name={field.name}</span>}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </Collapsible>
      )}
      {buttons.length > 0 && (
        <Collapsible title={`버튼 문구 (${buttons.length})`}>
          <div className="tags">
            {buttons.map((b, i) => (
              <span key={i} className="tag">
                {b}
              </span>
            ))}
          </div>
        </Collapsible>
      )}
    </>
  )
}
