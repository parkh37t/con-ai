/**
 * AS-IS 분석 상세 (계약 §12) — 상태 폴링(2초), 실패 코드·원인, 데스크톱/모바일 스크린샷 토글,
 * 구조 요약 표(레이블 없는 필드·alt 없는 이미지 등 counts), 요약, 페인포인트 표(채택/거부 → PATCH).
 */
import { useEffect, useState } from 'react'
import { adapterBadgeText } from '../adapter-badge.js'
import { ApiError, api } from '../api.js'
import {
  asisFailureLabel,
  asisStatusLabel,
  asisStatusTone,
  isTerminalAsis,
  painPointStatusLabel,
  painPointStatusTone,
  severityLabel,
  severityTone,
  structureSummaryRows,
} from '../asis.js'
import { Badge, Collapsible, Empty, ErrorBox, Loading, formatDateTime } from '../components/common.js'
import { JOB_POLL_INTERVAL_MS, useAsync } from '../hooks.js'
import { hrefTo } from '../router.js'
import type { AsisAnalysis, AsisStructure, PainPointStatus } from '../types.js'

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

  return (
    <div className="page">
      <nav className="breadcrumb" aria-label="경로">
        <a href={hrefTo('asis')}>AS-IS 분석</a> › <code className="asis-url">{analysis.url}</code>
      </nav>

      <section className="card">
        <div className="card-head">
          <h2>AS-IS 분석 상세</h2>
          <span data-testid="asis-status" data-status={analysis.status}>
            <Badge tone={asisStatusTone(analysis.status)}>{asisStatusLabel(analysis.status)}</Badge>
          </span>
        </div>
        <dl className="kv">
          <dt>대상 URL</dt>
          <dd className="asis-url">
            <code>{analysis.url}</code>
          </dd>
          {analysis.note && (
            <>
              <dt>메모</dt>
              <dd>{analysis.note}</dd>
            </>
          )}
          <dt>어댑터</dt>
          <dd>
            <Badge tone={analysis.adapter === 'anthropic' ? 'green' : 'amber'}>
              {analysis.adapter === 'anthropic' ? '실제 호출 · ' : ''}
              {adapterBadgeText({ adapter: analysis.adapter, model: analysis.model })}
            </Badge>
          </dd>
          <dt>시각</dt>
          <dd>
            생성 {formatDateTime(analysis.created_at)} · 종료 {formatDateTime(analysis.finished_at)}
          </dd>
        </dl>
        {polling && <div className="notice">분석이 진행 중입니다 — 2초마다 자동 갱신됩니다. (수집 → 페인포인트 초안)</div>}
        {load.error ? <ErrorBox error={load.error} title="상태를 갱신하지 못했습니다 (다음 주기에 다시 시도)" /> : null}
      </section>

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
          <ScreenshotCard analysis={analysis} />

          <section className="card">
            <h3>요약</h3>
            <div className="asis-summary" data-testid="asis-summary">
              {analysis.summary?.trim() ? analysis.summary : '요약이 기록되지 않았습니다.'}
            </div>
          </section>

          <StructureCard structure={analysis.structure} />

          <section className="card">
            <div className="card-head">
              <h3>페인포인트</h3>
              <span className="muted small">{analysis.pain_points.length}건 · 채택/거부로 확정합니다 (초안 상태는 "제안")</span>
            </div>
            {patchError ? <ErrorBox error={patchError} title="페인포인트 상태를 바꾸지 못했습니다" /> : null}
            {analysis.pain_points.length === 0 ? (
              <Empty>페인포인트 초안이 없습니다.</Empty>
            ) : (
              <div className="table-wrap">
                <table className="table compact">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>영역</th>
                      <th>심각도</th>
                      <th>설명</th>
                      <th>근거</th>
                      <th>제안</th>
                      <th>상태</th>
                      <th>작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.pain_points.map((p) => (
                      <tr key={p.id} data-testid="asis-pain-row" data-pp-id={p.id} data-status={p.status} data-severity={p.severity}>
                        <td>
                          <code>{p.id}</code>
                        </td>
                        <td>{p.area}</td>
                        <td>
                          <Badge tone={severityTone(p.severity)}>{severityLabel(p.severity)}</Badge>
                        </td>
                        <td>{p.description}</td>
                        <td className="muted">{p.evidence}</td>
                        <td>{p.suggestion}</td>
                        <td>
                          <Badge tone={painPointStatusTone(p.status)}>{painPointStatusLabel(p.status)}</Badge>
                        </td>
                        <td className="actions">
                          <button
                            type="button"
                            className="btn btn-small"
                            data-testid="pp-adopt"
                            disabled={busyPp === p.id || p.status === 'adopted'}
                            onClick={() => void setPainPointStatus(p.id, 'adopted')}
                          >
                            채택
                          </button>
                          <button
                            type="button"
                            className="btn btn-small"
                            data-testid="pp-reject"
                            disabled={busyPp === p.id || p.status === 'rejected'}
                            onClick={() => void setPainPointStatus(p.id, 'rejected')}
                          >
                            거부
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function ScreenshotCard({ analysis }: { analysis: AsisAnalysis }) {
  const [shot, setShot] = useState<'desktop' | 'mobile'>('desktop')
  const shots = analysis.screenshots
  return (
    <section className="card">
      <div className="card-head">
        <h3>스크린샷</h3>
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

function StructureCard({ structure }: { structure: AsisStructure | undefined }) {
  const rows = structureSummaryRows(structure)
  return (
    <section className="card">
      <div className="card-head">
        <h3>구조 요약</h3>
        <span className="muted small">Playwright 가 수집한 페이지 구조 (계약 §12 structure)</span>
      </div>
      {!structure || rows.length === 0 ? (
        <Empty>구조 정보가 기록되지 않았습니다.</Empty>
      ) : (
        <>
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
