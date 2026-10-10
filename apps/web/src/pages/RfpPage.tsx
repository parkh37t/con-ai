/**
 * RFP 분석 (`#/rfp`) — 발주 자료 원문을 붙여넣어 **요구사항·평가항목 초안**을 뽑고, 사람이 **채택**한다.
 *
 * 이 화면이 지키는 것:
 * - **채택 전에는 요구사항이 아니다.** 분석 결과는 초안이고, 채택을 누르면 그때 `Requirement` 가 되어
 *   RTM 분모에 들어간다. 화면도 그 사실을 적는다.
 * - **떨어진 것을 숨기지 않는다.** 인용을 원문에서 찾지 못한 초안은 이유와 함께 보여준다
 *   (모델이 지어낸 문장을 채택 목록에 섞지 않는다).
 * - **누락을 0 으로 적지 않는다.** 금융권 비기능 체크리스트에서 빈 축은 「세지 못함」으로 적는다.
 * - **채택은 사유·행위자와 함께**다 (ID 발번·화면 연결과 같은 규율).
 *
 * 규격 출처: 사내 BA 표준 — 분류 5종(FR·NFR·TR·OR·CR) · MoSCoW · 출처 표기와 원문 인용.
 */
import { useEffect, useMemo, useState } from 'react'
import { api, errorMessage } from '../api.js'
import { Badge, Empty, ErrorBox, Loading, formatDateTime } from '../components/common.js'
import { IS_DEMO } from '../demo-mode.js'
import { JOB_POLL_INTERVAL_MS, notifyDataChanged, useAsync, useStoredValue } from '../hooks.js'
import { hrefTo } from '../router.js'
import {
  MOSCOW_LABELS,
  MOSCOW_TONES,
  NFR_AXIS_LABELS,
  RFP_CLASS_LABELS,
  RFP_REJECT_LABELS,
  RFP_STATUS_LABELS,
  RFP_STATUS_TONES,
  adoptedIds,
  canAdopt,
  isTerminalRfp,
  nfrGapNote,
  rfpFailureText,
  rfpSummaryLine,
  shortQuote,
} from '../rfp-view.js'
import type { Project, RfpAnalysis, RfpAnalysisSummary } from '../types.js'

export function RfpPage({ project }: { project: Project }) {
  // 정적 배포에는 이 API 가 없다 — 부르면 404 오류 상자가 뜬다. 부르지 않고 **안내만** 한다.
  const list = useAsync(async () => (IS_DEMO ? [] : await api.rfpAnalyses(project.id)), [project.id])
  const [openId, setOpenId] = useState<string | null>(null)
  const [sourceName, setSourceName] = useState('')
  const [projectCode, setProjectCode] = useStoredValue('con-ai.rfp.code', '')
  const [text, setText] = useState('')
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [runError, setRunError] = useState<unknown>(null)
  const [running, setRunning] = useState(false)

  const rows = list.data ?? []
  const hasActive = rows.some((r) => !isTerminalRfp(r.status))
  const reload = list.reload
  useEffect(() => {
    if (!hasActive) return
    const timer = setInterval(reload, JOB_POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [hasActive, reload])

  const start = async () => {
    if (IS_DEMO) return setFormError('정적 배포에서는 RFP 분석을 실행할 수 없습니다 — 저장소를 받아 `pnpm bridge` 로 실행하세요.')
    const name = sourceName.trim()
    const code = projectCode.trim().toUpperCase()
    const body = text.trim()
    if (name.length === 0) return setFormError('문서 이름을 적으세요 (출처 표기에 씁니다).')
    if (!/^[A-Z][A-Z0-9-]{0,15}$/.test(code)) return setFormError('프로젝트 코드는 대문자·숫자·하이픈 1~16자입니다 (예: S2B).')
    if (body.length < 50) return setFormError('원문이 너무 짧습니다 (50자 이상).')
    setFormError(null)
    setRunning(true)
    setRunError(null)
    try {
      const memo = note.trim()
      const res = await api.createRfpAnalysis(project.id, { source_name: name, project_code: code, text: body, ...(memo ? { note: memo } : {}) })
      setOpenId(res.analysis_id)
      setText('')
      reload()
      notifyDataChanged()
    } catch (e) {
      setRunError(e)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="page page-reading">
      <header className="projhead">
        <div className="projhead-copy">
          <span className="projhead-kicker">RFP 분석 · {project.name}</span>
          <h1>발주 자료에서 요구사항을 뽑습니다</h1>
          <p>
            분류(기능·비기능·기술·운영·컴플라이언스)와 우선순위(MoSCoW)를 **근거와 함께** 뽑고, <strong>인용이 원문에 실제로 있는지 규칙으로 검사</strong>합니다.
            결과는 초안이며 <strong>채택을 눌러야</strong> 요구사항이 됩니다 — 그때부터 추적 체인의 분모에 들어갑니다.
          </p>
        </div>
        <span className="projhead-actions">
          <a className="btn" href={hrefTo('trace')}>
            ID 매핑 보기
          </a>
        </span>
      </header>

      {IS_DEMO && (
        <div className="notice" data-testid="rfp-demo-note">
          정적 배포에서는 이 화면이 <strong>아직 동작하지 않습니다</strong> — RFP 분석은 서버(또는 <code>pnpm bridge</code>)가 필요합니다. 내 Claude 계정으로 돌리려면 저장소를 받아{' '}
          <code>pnpm bridge</code> 를 실행하세요.
        </div>
      )}

      <section className="card">
        <div className="card-head">
          <h3>원문 붙여넣기</h3>
          <span className="muted small">텍스트만 받습니다 (PDF·HWP 파싱은 아직 없습니다 — 열어서 복사해 붙여넣으세요)</span>
        </div>
        <div className="rfp-form">
          <label>
            문서 이름
            <input type="text" data-testid="rfp-source-name" value={sourceName} placeholder="예: 2026 파트너포털 고도화 RFP" disabled={running} onChange={(e) => setSourceName(e.target.value)} />
          </label>
          <label>
            프로젝트 코드
            <input
              type="text"
              data-testid="rfp-project-code"
              value={projectCode}
              placeholder="예: S2B"
              disabled={running}
              onChange={(e) => setProjectCode(e.target.value.toUpperCase())}
            />
            <span className="muted small">요구사항 ID 접두어로 씁니다 — `S2B-FR-001` 처럼 붙습니다.</span>
          </label>
          <label>
            원문
            <textarea data-testid="rfp-text" rows={10} value={text} placeholder="RFP 본문을 붙여넣으세요" disabled={running} onChange={(e) => setText(e.target.value)} />
            <span className="muted small">{text.trim().length.toLocaleString('ko-KR')}자 · 문서 안의 지시문은 자료로만 읽습니다 (실행하지 않습니다)</span>
          </label>
          <label>
            기획자 메모 (선택)
            <input type="text" data-testid="rfp-note" value={note} placeholder="예: 모바일 요건을 특히 챙겨 주세요" disabled={running} onChange={(e) => setNote(e.target.value)} />
          </label>
          <button type="button" className="btn btn-primary" data-testid="rfp-run" disabled={running} onClick={() => void start()}>
            {running ? '접수 중…' : '분석 실행'}
          </button>
          {formError && (
            <p className="form-error" data-testid="rfp-form-error">
              {formError}
            </p>
          )}
          {runError ? <ErrorBox error={runError} title="분석을 시작하지 못했습니다" testId="rfp-run-error" /> : null}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h3>분석 목록</h3>
          <span className="muted small">{hasActive ? '진행 중인 분석이 있어 2초마다 갱신합니다' : `${rows.length}건`}</span>
        </div>
        {list.error ? <ErrorBox error={list.error} title="목록을 읽지 못했습니다" /> : null}
        {list.loading && rows.length === 0 && <Loading text="분석 목록을 읽는 중…" />}
        {!list.loading && rows.length === 0 && (
          <Empty>{IS_DEMO ? '정적 배포에서는 분석 목록이 없습니다 (서버가 없습니다).' : '아직 분석이 없습니다. 위에 원문을 붙여넣고 실행하세요.'}</Empty>
        )}
        <ul className="rfp-list">
          {rows.map((r) => (
            <RfpRow key={r.id} row={r} open={openId === r.id} onToggle={() => setOpenId(openId === r.id ? null : r.id)} onChanged={reload} />
          ))}
        </ul>
      </section>
    </div>
  )
}

function RfpRow({ row, open, onToggle, onChanged }: { row: RfpAnalysisSummary; open: boolean; onToggle: () => void; onChanged: () => void }) {
  return (
    <li className="rfp-item" data-testid="rfp-row" data-status={row.status}>
      <button type="button" className="rfp-item-head" data-testid="rfp-row-toggle" onClick={onToggle} aria-expanded={open}>
        <span className="rfp-item-name">{row.source_name}</span>
        <span className="rfp-item-meta">
          <Badge tone={RFP_STATUS_TONES[row.status]}>{RFP_STATUS_LABELS[row.status]}</Badge>
          <span className="muted small">
            {row.project_code} · 후보 {row.requirement_count}건 · 채택 {row.adopted_count}건
            {row.rejected_count > 0 ? ` · 거부 ${row.rejected_count}건` : ''} · {formatDateTime(row.created_at)}
          </span>
        </span>
      </button>
      {open && <RfpDetail analysisId={row.id} onChanged={onChanged} />}
    </li>
  )
}

function RfpDetail({ analysisId, onChanged }: { analysisId: string; onChanged: () => void }) {
  const detail = useAsync(() => api.rfpAnalysis(analysisId), [analysisId])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [by, setBy] = useStoredValue('con-ai.author', '')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)

  const analysis = detail.data
  const status = analysis?.status
  const reload = detail.reload
  // 진행 중이면 갱신한다 (목록과 같은 주기).
  useEffect(() => {
    if (status === undefined || isTerminalRfp(status)) return
    const timer = setInterval(reload, JOB_POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [status, reload])

  const adopted = useMemo(() => (analysis ? adoptedIds(analysis) : new Set<string>()), [analysis])

  if (detail.loading && !analysis) return <Loading text="분석 결과를 읽는 중…" />
  if (detail.error) return <ErrorBox error={detail.error} title="분석 결과를 읽지 못했습니다" />
  if (!analysis) return null

  const failure = rfpFailureText(analysis.failure)
  const gapNote = nfrGapNote(analysis.nfr_gaps)
  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const adopt = async () => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const res = await api.adoptRfpRequirements(analysis.id, { by, reason, external_ids: [...selected], revision: analysis.revision })
      setNotice(`${res.adopted.join(', ')} 를 요구사항으로 채택했습니다 — 지금부터 추적 체인(ID 매핑)의 분모에 들어갑니다.`)
      setSelected(new Set())
      setReason('')
      reload()
      onChanged()
      notifyDataChanged()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rfp-detail" data-testid="rfp-detail">
      <p className="muted small" data-testid="rfp-summary">
        {rfpSummaryLine(analysis)} · 어댑터 {analysis.adapter} · {analysis.model}
      </p>

      {failure && (
        <div className="notice notice-amber" data-testid="rfp-failure">
          <strong>분석 실패</strong> — {failure}
        </div>
      )}

      {analysis.overview && (analysis.overview.org || analysis.overview.project_name || analysis.overview.period || analysis.overview.budget) ? (
        <p className="small" data-testid="rfp-overview">
          {[analysis.overview.org, analysis.overview.project_name, analysis.overview.period, analysis.overview.budget].filter((v) => v.length > 0).join(' · ')}
        </p>
      ) : null}

      {analysis.requirements.length > 0 && (
        <div className="table-wrap">
          <table className="table" data-testid="rfp-table">
            <thead>
              <tr>
                <th>채택</th>
                <th>REQ</th>
                <th>분류</th>
                <th>우선순위</th>
                <th>요구사항</th>
                <th>출처·인용</th>
              </tr>
            </thead>
            <tbody>
              {analysis.requirements.map((r) => {
                const done = adopted.has(r.external_id)
                return (
                  <tr key={r.external_id} data-testid="rfp-req" data-req={r.external_id} data-adopted={done ? '1' : '0'}>
                    <td>
                      {done ? (
                        <Badge tone="green">채택됨</Badge>
                      ) : (
                        <input
                          type="checkbox"
                          data-testid="rfp-pick"
                          aria-label={`${r.external_id} 채택 선택`}
                          checked={selected.has(r.external_id)}
                          disabled={busy || analysis.status !== 'succeeded'}
                          onChange={() => toggle(r.external_id)}
                        />
                      )}
                    </td>
                    <td>
                      <code>{r.external_id}</code>
                    </td>
                    <td>
                      {RFP_CLASS_LABELS[r.kind]}
                      {r.nfr_axis ? <span className="muted small"> · {NFR_AXIS_LABELS[r.nfr_axis]}</span> : null}
                    </td>
                    <td>
                      <Badge tone={MOSCOW_TONES[r.priority]}>{MOSCOW_LABELS[r.priority]}</Badge>
                      <span className="muted small rfp-sub">{r.priority_reason}</span>
                    </td>
                    <td>
                      {r.title}
                      <span className="muted small rfp-sub">
                        {r.detail}
                        {r.criteria.length > 0 ? ` · 수용조건 ${r.criteria.length}건 (UI ${r.criteria.filter((c) => c.kind === 'ui').length})` : ' · 수용조건 없음'}
                      </span>
                    </td>
                    <td>
                      <code>{r.source.label}</code>
                      <span className="muted small rfp-sub" title={r.source.quote}>
                        {shortQuote(r.source.quote)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {analysis.status === 'succeeded' && analysis.requirements.length === 0 && <Empty>요구사항 후보가 없습니다. 아래 거부 목록과 미해결 항목을 보세요.</Empty>}

      {analysis.requirements.length > 0 && (
        <div className="rfp-adopt" data-testid="rfp-adopt">
          <label>
            채택자
            <input type="text" data-testid="rfp-by" value={by} placeholder="이름" disabled={busy} onChange={(e) => setBy(e.target.value)} />
          </label>
          <label>
            사유 (필수)
            <input type="text" data-testid="rfp-reason" value={reason} placeholder="예: 1차 범위로 확정" disabled={busy} onChange={(e) => setReason(e.target.value)} />
          </label>
          <button
            type="button"
            className="btn btn-primary"
            data-testid="rfp-adopt-submit"
            disabled={!canAdopt({ by, reason, selected, busy, status: analysis.status })}
            title={canAdopt({ by, reason, selected, busy, status: analysis.status }) ? undefined : '채택자·사유를 채우고 요구사항을 고르세요'}
            onClick={() => void adopt()}
          >
            {`선택 ${selected.size}건 채택`}
          </button>
        </div>
      )}

      {notice && (
        <div className="notice notice-green" role="status" data-testid="rfp-notice">
          {notice}
        </div>
      )}
      {error ? <ErrorBox error={error} title="채택하지 못했습니다" testId="rfp-error" /> : null}

      {analysis.evaluation_items.length > 0 && (
        <p className="small" data-testid="rfp-evaluation">
          <strong>평가항목</strong> — {analysis.evaluation_items.map((e) => `${e.label}${e.weight === undefined ? '' : ` ${e.weight}점`}`).join(' · ')}
        </p>
      )}

      {analysis.rejected.length > 0 && (
        <div className="notice notice-amber" data-testid="rfp-rejected">
          <strong>채택 후보에서 제외한 {analysis.rejected.length}건</strong>
          <ul className="footnote-list">
            {analysis.rejected.map((r, i) => (
              <li key={`${r.title}-${i}`}>
                [{RFP_CLASS_LABELS[r.kind]}] {r.title} — {RFP_REJECT_LABELS[r.reason]} · 인용: <q>{shortQuote(r.quote, 60)}</q>
              </li>
            ))}
          </ul>
        </div>
      )}

      {gapNote && (
        <div className="notice notice-amber" data-testid="rfp-nfr-gap">
          {gapNote}
        </div>
      )}

      {analysis.unresolved.length > 0 && (
        <ul className="footnote-list" data-testid="rfp-unresolved">
          {analysis.unresolved.map((u, i) => (
            <li key={`${u.kind}-${i}`}>
              {u.kind === 'question' ? '물어볼 것' : u.kind === 'conflict' ? '원문 충돌' : '근거 없음'}: {u.text}
            </li>
          ))}
        </ul>
      )}

      {analysis.adoptions.length > 0 && (
        <ul className="footnote-list" data-testid="rfp-adoptions">
          {analysis.adoptions.map((a) => (
            <li key={a.external_id}>
              {a.external_id} — {a.by} · {a.reason} · {formatDateTime(a.at)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** 화면 밖에서 쓰는 오류 문구 (테스트가 import 한다). */
export const rfpErrorMessage = errorMessage
