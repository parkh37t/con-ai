/**
 * AS-IS 분석 목록·실행 (계약 §12, 4단계 프로세스 ①) — URL·메모 입력 → 202 분석 시작 →
 * 목록을 2초 폴링해 queued → running → succeeded/failed 갱신. 데모 대상(/asis-sample) 채우기 버튼 포함.
 */
import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { ASIS_SAMPLE_PATH, ASIS_SAMPLE_URL, asisStatusLabel, asisStatusTone, isTerminalAsis, painPointCountOf, validateAsisUrl } from '../asis.js'
import { Empty, ErrorBox, Loading, formatDateTime } from '../components/common.js'
import { JOB_POLL_INTERVAL_MS, useAsync } from '../hooks.js'
import { hrefToAsisDetail } from '../router.js'
import type { AsisAnalysisSummary, Project } from '../types.js'

export function AsisListPage({ project }: { project: Project }) {
  const list = useAsync(() => api.asisAnalyses(project.id), [project.id])
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [runError, setRunError] = useState<unknown>(null)
  const [running, setRunning] = useState(false)

  // 폴링 중 일시 오류로 useAsync 의 data 가 비어도 마지막 목록을 유지한다 (표가 사라지거나 폴링이 멈추지 않게).
  const [lastRows, setLastRows] = useState<AsisAnalysisSummary[] | null>(null)
  useEffect(() => {
    if (list.data) setLastRows(list.data)
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
    <div className="page">
      <section className="card">
        <div className="card-head">
          <h2>AS-IS 분석 — {project.name}</h2>
          <span className="muted small">4단계 프로세스 ① — 대상 서비스를 방문해 스크린샷·구조를 수집하고 페인포인트 초안을 만듭니다</span>
        </div>
        <p>
          기획자가 대상 서비스 URL 을 입력하면 서버가 Playwright 로 방문해 스크린샷·구조를 수집하고, 모델 어댑터가 페인포인트 초안을 만듭니다. 초안은 상세 화면에서
          채택/거부로 확정합니다.
        </p>
      </section>

      <section className="card">
        <h3>분석 실행</h3>
        <div className="form-grid">
          <label className="span-2">
            대상 URL (http/https 만)
            <input
              type="text"
              data-testid="asis-url"
              value={url}
              placeholder="예: https://example.com 또는 데모 대상"
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          <label className="span-2">
            메모 (선택)
            <input type="text" data-testid="asis-note" value={note} placeholder="예: 파트너 견적 포털 현행 화면" onChange={(e) => setNote(e.target.value)} />
          </label>
        </div>
        <div className="notice">
          이 개발 환경에서는 외부 URL 이 네트워크 정책에 막힐 수 있습니다. 이 서버가 제공하는 데모 대상:{' '}
          <button type="button" className="link" data-testid="asis-sample-fill" title={`URL 입력칸에 ${ASIS_SAMPLE_URL} 채우기`} onClick={() => setUrl(ASIS_SAMPLE_URL)}>
            {ASIS_SAMPLE_PATH}
          </button>{' '}
          (클릭하면 URL 입력칸에 채워집니다)
        </div>
        {formError && (
          <div className="error-box" role="alert">
            <strong>입력을 확인하세요</strong>
            <div>{formError}</div>
          </div>
        )}
        {runError ? <ErrorBox error={runError} title="분석을 시작하지 못했습니다" /> : null}
        <div className="button-row">
          <button type="button" className="btn btn-primary" data-testid="asis-run" onClick={() => void run()} disabled={running}>
            {running ? '시작 중…' : '분석 실행'}
          </button>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h3>분석 목록</h3>
          <span className="muted small">
            {rows.length}건{hasActive ? ' · 진행 중 분석이 있어 2초마다 갱신' : ''}
          </span>
        </div>
        {list.error ? <ErrorBox error={list.error} title="분석 목록을 읽지 못했습니다" /> : null}
        {list.loading && sorted.length === 0 && !list.error && <Loading text="분석 목록을 불러오는 중…" />}
        {list.data && sorted.length === 0 && <Empty>아직 분석이 없습니다. 위에서 URL 을 입력해 실행하세요.</Empty>}
        {sorted.length > 0 && <AnalysesTable rows={sorted} />}
      </section>
    </div>
  )
}

function AnalysesTable({ rows }: { rows: AsisAnalysisSummary[] }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>URL</th>
            <th>상태</th>
            <th className="num">페인포인트</th>
            <th>생성 시각</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => {
            const count = painPointCountOf(a)
            return (
              <tr key={a.id} data-testid="asis-row" data-analysis-id={a.id} data-status={a.status}>
                <td className="asis-url">
                  <code>{a.url}</code>
                  {a.note && <div className="muted small">{a.note}</div>}
                </td>
                <td>
                  <span className={`badge badge-${asisStatusTone(a.status)}`} data-testid="asis-row-status" data-status={a.status}>
                    {asisStatusLabel(a.status)}
                  </span>
                </td>
                <td className="num" data-testid="asis-pp-count">
                  {count === null ? '—' : count}
                </td>
                <td>{formatDateTime(a.created_at)}</td>
                <td className="actions">
                  <a className="btn btn-small" data-testid="asis-detail-link" href={hrefToAsisDetail(a.id)}>
                    상세
                  </a>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
