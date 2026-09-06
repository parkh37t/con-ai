/**
 * AS-IS 분석 목록·실행 (계약 §12, 4단계 프로세스 ①) — URL·메모 입력 → 202 분석 시작 →
 * 목록을 2초 폴링해 queued → running → succeeded/failed 갱신. 데모 대상(/asis-sample) 채우기 버튼 포함.
 *
 * 화면 구성 원칙
 * - 제목은 `AS-IS 분석` 한 줄. 프로젝트명·단계 설명은 그 아래 작은 메타 줄에 **한 번만** 둔다(설명 중복 금지).
 * - 실행은 한 줄: URL 입력 + 실행 버튼. 메모는 보조 입력으로 아래 줄에 둔다.
 * - 목록은 표가 아니라 행 카드 — URL 을 크게(모노) 두고 상태·페인포인트 수·시각을 한 줄 메타로 붙인다.
 */
import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { ASIS_SAMPLE_PATH, ASIS_SAMPLE_URL, asisStatusLabel, asisStatusTone, isTerminalAsis, painPointCountOf, validateAsisUrl } from '../asis.js'
import { Empty, ErrorBox, Loading, formatDateTime } from '../components/common.js'
import { JOB_POLL_INTERVAL_MS, notifyDataChanged, useAsync } from '../hooks.js'
import { hrefToAsisDetail } from '../router.js'
import type { AsisAnalysisSummary, Project } from '../types.js'

export function AsisListPage({ project }: { project: Project }) {
  const list = useAsync(() => api.asisAnalyses(project.id), [project.id])
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [runError, setRunError] = useState<unknown>(null)
  const [running, setRunning] = useState(false)

  // 폴링 중 일시 오류로 useAsync 의 data 가 비어도 마지막 목록을 유지한다 (목록이 사라지거나 폴링이 멈추지 않게).
  const [lastRows, setLastRows] = useState<AsisAnalysisSummary[] | null>(null)
  useEffect(() => {
    if (!list.data) return
    setLastRows(list.data)
    // 목록이 새로 읽힐 때마다 레일의 건수도 같이 맞춘다 (실행 직후·폴링 중 모두).
    notifyDataChanged()
  }, [list.data])
  const rows = list.data ?? lastRows ?? []
  const hasActive = rows.some((a) => !isTerminalAsis(a.status))
  const reload = list.reload

  // 진행 중(queued/running) 분석이 있는 동안 2초마다 목록을 다시 읽는다.
  useEffect(() => {
    if (!hasActive) return
    const timer = setInterval(reload, JOB_POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [hasActive, reload])

  const run = async () => {
    const err = validateAsisUrl(url)
    setFormError(err)
    if (err) return
    setRunning(true)
    setRunError(null)
    try {
      const trimmedNote = note.trim()
      await api.createAsisAnalysis(project.id, { url: url.trim(), ...(trimmedNote ? { note: trimmedNote } : {}) })
      reload()
    } catch (e) {
      setRunError(e)
    } finally {
      setRunning(false)
    }
  }

  const sorted = [...rows].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))

  return (
    <div className="page page-reading">
      {/* 다른 작업대 화면과 같은 머리 — 구역 딱지 → 제목 → 설명. 설명은 여기 한 곳에만 둔다. */}
      <header className="projhead">
        <div className="projhead-copy">
          <span className="projhead-kicker">
            <span className="kicker-no" aria-hidden="true">
              1
            </span>
            AS-IS 분석 · <span data-testid="project-name">{project.name}</span>
          </span>
          <h1>대상 서비스를 분석해 페인포인트를 찾습니다</h1>
          <p>
            URL 을 넣으면 서버가 Playwright 로 방문해 데스크톱·모바일 스크린샷과 페이지 구조를 수집하고, 모델 어댑터가 페인포인트 초안을 만듭니다. 기획자가 채택·거부로
            확정합니다.
          </p>
        </div>
      </header>

      <section className="card">
        <h3 className="section-title">분석 실행</h3>
        {/* 한 줄 실행 — URL 과 버튼을 같은 줄에 둔다. */}
        <div className="asis-run-row">
          <input
            type="text"
            className="asis-url-input"
            data-testid="asis-url"
            value={url}
            aria-label="대상 URL (http/https 만)"
            placeholder="분석할 URL (http:// 또는 https://)"
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !running) void run()
            }}
          />
          <button type="button" className="btn btn-primary" data-testid="asis-run" onClick={() => void run()} disabled={running}>
            {running ? '시작 중…' : '분석 실행'}
          </button>
        </div>
        <p className="asis-run-hint muted small">
          외부 URL 이 네트워크 정책에 막힐 수 있습니다. 데모 대상{' '}
          <button type="button" className="link" data-testid="asis-sample-fill" title={`URL 입력칸에 ${ASIS_SAMPLE_URL} 채우기`} onClick={() => setUrl(ASIS_SAMPLE_URL)}>
            {ASIS_SAMPLE_PATH}
          </button>{' '}
          를 누르면 입력칸에 채워집니다.
        </p>
        {/* 메모는 보조 입력 — 실행에 필요하지 않으므로 한 단계 낮춰 둔다. */}
        <label className="asis-note-field muted small">
          <span>메모 (선택)</span>
          <input type="text" data-testid="asis-note" value={note} placeholder="예: 파트너 견적 포털 현행 화면" onChange={(e) => setNote(e.target.value)} />
        </label>
        {formError && (
          <div className="error-box" role="alert">
            <strong>입력을 확인하세요</strong>
            <div>{formError}</div>
          </div>
        )}
        {runError ? <ErrorBox error={runError} title="분석을 시작하지 못했습니다" /> : null}
      </section>

      <section className="card">
        <div className="card-head">
          <h3 className="section-title">분석 목록</h3>
          <span className="muted small">
            {rows.length}건{hasActive ? ' · 진행 중 분석이 있어 2초마다 갱신' : ''}
          </span>
        </div>
        {list.error ? <ErrorBox error={list.error} title="분석 목록을 읽지 못했습니다" /> : null}
        {list.loading && sorted.length === 0 && !list.error && <Loading text="분석 목록을 불러오는 중…" />}
        {list.data && sorted.length === 0 && <Empty>아직 분석이 없습니다. 위에서 URL 을 입력해 실행하세요.</Empty>}
        {sorted.length > 0 && (
          <ul className="asis-list">
            {sorted.map((a) => (
              <AnalysisRow key={a.id} analysis={a} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

/** 행 카드 — URL 이 주인공이고, 나머지는 그 아래 한 줄 메타. */
function AnalysisRow({ analysis }: { analysis: AsisAnalysisSummary }) {
  const count = painPointCountOf(analysis)
  return (
    <li className="asis-row" data-testid="asis-row" data-analysis-id={analysis.id} data-status={analysis.status}>
      <div className="asis-row-main">
        <a className="asis-row-url" href={hrefToAsisDetail(analysis.id)}>
          {analysis.url}
        </a>
        <div className="asis-row-meta muted small">
          <span className={`badge badge-${asisStatusTone(analysis.status)}`} data-testid="asis-row-status" data-status={analysis.status}>
            {asisStatusLabel(analysis.status)}
          </span>
          <span>
            페인포인트 <strong data-testid="asis-pp-count">{count === null ? '—' : count}</strong>
          </span>
          <span>{formatDateTime(analysis.created_at)}</span>
          {analysis.note && <span className="asis-row-note">{analysis.note}</span>}
        </div>
      </div>
      <a className="btn btn-small" data-testid="asis-detail-link" href={hrefToAsisDetail(analysis.id)}>
        상세
      </a>
    </li>
  )
}
