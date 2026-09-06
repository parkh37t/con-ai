/**
 * ID 매핑 (`#/trace`) — 추적 체인 REQ → IA → FN → SCR. (산출물 pipeline-v2 P1-05)
 *
 * 구성: KPI 5칸 → 추적 체인(RTM) 표 → 커버리지 갭 제안 → 100% 배너 / G1 판정 → 각주.
 *
 * 이 화면이 지키는 것:
 * - **ID 발번은 사람이 누른다.** 제안은 에이전트가 만들지만 사유·행위자를 넣고 버튼을 눌러야 값이 저장된다.
 * - **없는 것을 빈칸으로 두지 않는다.** 미발번은 «(IA 코드 미발번)» 이라고 적고, 세지 못한 것은 각주에 자백한다.
 * - **서버가 번호를 다시 계산한다.** 화면이 제안한 번호와 다르면 그 사실을 알린다.
 */
import { useState } from 'react'
import { api } from '../api.js'
import { Badge, Empty, ErrorBox, Loading } from '../components/common.js'
import { IS_DEMO } from '../demo-mode.js'
import { notifyDataChanged, useAsync, useStoredValue } from '../hooks.js'
import { PROPOSAL_KIND_LABELS, ROW_STATUS_LABELS, ROW_STATUS_TONES, canSubmit, footnotes, idCellText, isIssuanceProposal, kpiCells, ratioText, showsFullCoverageBanner } from '../rtm-view.js'
import { hrefTo, hrefToScreen } from '../router.js'
import type { IdIssueResponse, Project, RtmGapProposal, RtmReport } from '../types.js'

export function TraceMatrixPage({ project }: { project: Project }) {
  const rtm = useAsync(() => api.rtm(project.id), [project.id])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // 행위자 이름은 브라우저에 남긴다 (코멘트 작성자와 같은 방식). 사유는 매번 새로 쓴다.
  const [by, setBy] = useStoredValue('con-ai.author', '')

  /**
   * 쓰기 동작 하나를 실행한다.
   * `fn` 이 문자열을 돌려주면 그것을 알림으로 쓴다 — 기본 문구가 구체적인 알림(예: 서버가 다시 계산한
   * 번호가 다르다는 경고)을 덮어쓰지 않게 하기 위해서다.
   */
  const run = async (label: string, fn: () => Promise<string | void>) => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const detail = await fn()
      setNotice(typeof detail === 'string' ? detail : label)
      rtm.reload()
      notifyDataChanged()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page page-reading">
      <TraceHeader project={project} />
      {IS_DEMO && (
        <div className="notice" data-testid="trace-demo-note">
          정적 배포에서는 이 화면이 <strong>이 브라우저 안에서</strong> 동작합니다. 커버리지 계산·발번 판정은 서버와 <strong>같은 규칙</strong>(<code>@con-ai/domain</code>)을 쓰지만,
          발번·연결 결과는 이 브라우저에만 저장되고 다른 사람에게는 보이지 않습니다. 팀이 함께 쓰는 값으로 남기려면 서버 실행(<code>pnpm serve</code>)에서 하세요.
        </div>
      )}
      {rtm.error ? <ErrorBox error={rtm.error} title="추적 체인을 읽지 못했습니다" /> : null}
      {rtm.loading && !rtm.data && <Loading text="추적 체인을 계산하는 중…" />}
      {rtm.data && (
        <>
          <KpiRow report={rtm.data} />
          <ChainTable report={rtm.data} />
          <GapPanel
            report={rtm.data}
            by={by}
            setBy={setBy}
            busy={busy}
            onIssue={(p, externalId, reason) =>
              run('발번했습니다', async () => {
                if (p.ia_node_id === undefined) throw new Error('대상 IA 노드를 알 수 없습니다')
                const node = rtm.data?.rows.flatMap((r) => r.ia).find((ia) => ia.id === p.ia_node_id)
                const fnId = p.kind === 'issue_fn_id' ? findUnissuedFunctionId(rtm.data) : undefined
                const revision = await currentRevision(p.ia_node_id)
                const res = await api.issueId(p.ia_node_id, {
                  external_id: externalId,
                  by,
                  reason,
                  revision,
                  ...(fnId === undefined ? {} : { function_id: fnId }),
                  expected_proposal_hash: p.proposal_hash,
                })
                return issuanceNotice(res, node?.name)
              })
            }
            onLink={(p, requirementId, reason) =>
              run('연결했습니다', async () => {
                if (p.ia_node_id === undefined) throw new Error('대상 IA 노드를 알 수 없습니다')
                const revision = await currentRevision(p.ia_node_id)
                const existing = await currentRequirementIds(p.ia_node_id)
                await api.patchIaNode(p.ia_node_id, { revision, by, reason, requirement_ids: [...existing, requirementId] })
              })
            }
            onDefineFunction={(p, name, reason) =>
              run('기능을 추가했습니다 (번호는 따로 발번합니다)', async () => {
                if (p.ia_node_id === undefined) throw new Error('대상 IA 노드를 알 수 없습니다')
                const revision = await currentRevision(p.ia_node_id)
                await api.patchIaNode(p.ia_node_id, { revision, by, reason, add_function: { name } })
              })
            }
          />
          {notice && (
            <div className="notice notice-green" role="status" data-testid="trace-notice">
              {notice}
            </div>
          )}
          {error ? <ErrorBox error={error} title="처리하지 못했습니다" testId="trace-error" /> : null}
          <Verdict report={rtm.data} />
          <Footnotes report={rtm.data} />
        </>
      )}
    </div>
  )
}

function TraceHeader({ project }: { project: Project }) {
  return (
    <header className="projhead">
      <div className="projhead-copy">
        <span className="projhead-kicker">추적 체인 · {project.name}</span>
        <h1>요구사항이 화면까지 이어지는지 봅니다</h1>
        <p>
          REQ → IA → FN → SCR. 새 단계는 새 ID 를 만들지 않고 참조만 더합니다. 갭 제안은 에이전트가 만들고, <strong>ID 발번은 사람이 사유와 함께 누릅니다</strong>.
        </p>
      </div>
      <span className="projhead-actions">
        <a className="btn" href={hrefTo('advanced')}>
          프로젝트 홈
        </a>
      </span>
    </header>
  )
}

function KpiRow({ report }: { report: RtmReport }) {
  return (
    <div className="kpis" data-testid="trace-kpis">
      {kpiCells(report.summary).map((k) => (
        <div key={k.key} className="kpi" data-testid={`trace-kpi-${k.key}`}>
          <span className="kpi-label">{k.label}</span>
          <span className="kpi-value">
            <span className={k.alert ? 'kpi-alert' : undefined}>{k.value}</span>
            <span className="kpi-note">{k.note}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

function ChainTable({ report }: { report: RtmReport }) {
  return (
    <section className="card">
      <div className="card-head">
        <h3>추적 체인 (RTM)</h3>
        <span className="muted small">REQ → IA → FN → SCR · 새 단계는 새 ID 를 만들지 않고 참조만 추가한다</span>
      </div>
      {report.rows.length === 0 ? (
        <Empty>요구사항이 없습니다.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>REQ</th>
                <th>요구사항</th>
                <th>IA</th>
                <th>FN</th>
                <th>SCR</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.requirement_external_id} data-testid="rtm-row" data-req={row.requirement_external_id} data-status={row.status}>
                  <td>
                    <code>{row.requirement_external_id}</code>
                  </td>
                  <td>
                    {row.title}
                    <span className="muted small rtm-sub">
                      UI 수용조건 {row.ui_criteria} · 비UI {row.non_ui_criteria} · 출처 미기록
                    </span>
                  </td>
                  <td>
                    {row.ia.length === 0 ? (
                      <span className="muted">—</span>
                    ) : (
                      row.ia.map((ia) => (
                        <span key={ia.id} className="rtm-chip" title={ia.name}>
                          {idCellText(ia.external_id, 'IA')}
                        </span>
                      ))
                    )}
                  </td>
                  <td>
                    {row.fn.length === 0 ? (
                      <span className="muted">—</span>
                    ) : (
                      row.fn.map((fn) => (
                        <span key={fn.id} className="rtm-chip" title={fn.name}>
                          {idCellText(fn.external_id, 'FN')}
                        </span>
                      ))
                    )}
                  </td>
                  <td>
                    {row.scr.length === 0 ? (
                      <span className="muted">—</span>
                    ) : (
                      row.scr.map((s) => (
                        <a key={s.id} className="rtm-chip" href={hrefToScreen('generate', s.id)} title={s.title}>
                          {s.external_id}
                        </a>
                      ))
                    )}
                  </td>
                  <td>
                    <Badge tone={ROW_STATUS_TONES[row.status]}>{ROW_STATUS_LABELS[row.status]}</Badge>
                    {row.gap_reason && <span className="muted small rtm-sub">{row.gap_reason}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function GapPanel({
  report,
  by,
  setBy,
  busy,
  onIssue,
  onLink,
  onDefineFunction,
}: {
  report: RtmReport
  by: string
  setBy: (v: string) => void
  busy: boolean
  onIssue: (p: RtmGapProposal, externalId: string, reason: string) => void
  onLink: (p: RtmGapProposal, requirementId: string, reason: string) => void
  onDefineFunction: (p: RtmGapProposal, name: string, reason: string) => void
}) {
  if (report.proposals.length === 0) return null
  return (
    <section className="card">
      <div className="card-head">
        <h3>커버리지 갭 제안</h3>
        <span className="muted small">에이전트가 만든 초안입니다 — 사람이 승인해야 ID 가 발번됩니다</span>
      </div>
      <label className="gap-actor">
        승인자
        <input type="text" data-testid="trace-actor" value={by} placeholder="이름" onChange={(e) => setBy(e.target.value)} />
      </label>
      <ul className="gap-list">
        {report.proposals.map((p) => (
          <GapItem key={p.proposal_hash} proposal={p} by={by} busy={busy} onIssue={onIssue} onLink={onLink} onDefineFunction={onDefineFunction} />
        ))}
      </ul>
    </section>
  )
}

function GapItem({
  proposal,
  by,
  busy,
  onIssue,
  onLink,
  onDefineFunction,
}: {
  proposal: RtmGapProposal
  by: string
  busy: boolean
  onIssue: (p: RtmGapProposal, externalId: string, reason: string) => void
  onLink: (p: RtmGapProposal, requirementId: string, reason: string) => void
  onDefineFunction: (p: RtmGapProposal, name: string, reason: string) => void
}) {
  const [value, setValue] = useState(proposal.suggested_value ?? '')
  const [reason, setReason] = useState('')
  const ready = canSubmit(by, reason) && value.trim().length > 0 && !busy

  const label = isIssuanceProposal(proposal) ? '승인 · ID 발번' : proposal.kind === 'link_requirement' ? '연결' : '기능 추가'
  const placeholder =
    proposal.kind === 'issue_ia_id'
      ? '예: IA-1.1.1'
      : proposal.kind === 'issue_fn_id'
        ? '예: FN-1.1.1-01'
        : proposal.kind === 'link_requirement'
          ? proposal.requirement_external_id ?? '요구사항 외부 ID'
          : '기능 이름'

  const submit = () => {
    if (isIssuanceProposal(proposal)) onIssue(proposal, value.trim(), reason.trim())
    else if (proposal.kind === 'link_requirement') onLink(proposal, value.trim(), reason.trim())
    else onDefineFunction(proposal, value.trim(), reason.trim())
  }

  return (
    <li className="gap-item" data-testid="trace-proposal" data-kind={proposal.kind}>
      <div className="gap-head">
        <Badge tone="blue">{PROPOSAL_KIND_LABELS[proposal.kind]}</Badge>
        {proposal.requirement_external_id && <code>{proposal.requirement_external_id}</code>}
      </div>
      <p className="gap-rationale">{proposal.rationale}</p>
      <div className="gap-form">
        <input type="text" data-testid="trace-value" value={value} placeholder={placeholder} disabled={busy} onChange={(e) => setValue(e.target.value)} />
        <input type="text" data-testid="trace-reason" value={reason} placeholder="사유 (필수)" disabled={busy} onChange={(e) => setReason(e.target.value)} />
        <button type="button" className="btn btn-primary" data-testid="trace-approve" disabled={!ready} onClick={submit} title={ready ? undefined : '승인자와 사유를 채워야 합니다'}>
          {label}
        </button>
      </div>
    </li>
  )
}

function Verdict({ report }: { report: RtmReport }) {
  const full = showsFullCoverageBanner(report.summary, report.rows)
  if (full && report.g1_traceability.passed) {
    return (
      <div className="notice notice-green" data-testid="trace-full">
        <strong>커버리지 100%</strong> — G1 게이트의 추적성 조건을 충족했습니다. (G1 의 나머지 조건 — 검증 통과·보류 사유·사인오프 — 은 이 화면에서 판정하지 않습니다)
      </div>
    )
  }
  return (
    <div className="notice notice-amber" data-testid="trace-verdict">
      <strong>G1 추적성 미충족</strong> — {report.g1_traceability.reason}. 현재 커버리지 {ratioText(report.summary.req_to_scr_ratio)}.
    </div>
  )
}

function Footnotes({ report }: { report: RtmReport }) {
  return (
    <section className="card">
      <div className="card-head">
        <h3>이 화면이 세지 않는 것</h3>
        <span className="muted small">세지 않은 값을 0 이나 통과로 읽히게 두지 않습니다</span>
      </div>
      <ul className="footnote-list" data-testid="trace-footnotes">
        {footnotes(report.summary).map((n, i) => (
          <li key={i}>{n}</li>
        ))}
      </ul>
    </section>
  )
}

// ─────────────────────────────────────────────── 보조

/** 저장 직전의 문서 revision 을 읽는다 — 낙관적 잠금은 서버가 다시 검사한다. */
async function currentRevision(iaNodeId: string): Promise<number> {
  const node = await api.iaNode(iaNodeId)
  return node.revision
}

async function currentRequirementIds(iaNodeId: string): Promise<string[]> {
  const node = await api.iaNode(iaNodeId)
  return node.ia_node.requirement_ids ?? []
}

/** 아직 번호가 없는 기능 하나 — FN 발번 제안의 대상이다. 여러 건이면 첫 건부터 발번한다. */
function findUnissuedFunctionId(report: RtmReport | null): string | undefined {
  return report?.rows.flatMap((r) => r.fn).find((f) => f.external_id === undefined)?.id
}

/**
 * 발번 알림 문구. 다시 계산한 번호가 요청값과 다르면 그 사실을 반드시 적고,
 * 정적 데모에서 이 브라우저에 저장하지 못했으면 그것도 함께 적는다 (조용히 성공으로 보이게 두지 않는다).
 */
export function issuanceNotice(res: IdIssueResponse, name?: string): string {
  const head = res.differs
    ? `${name ?? '대상'}에 ${res.issued_external_id} 를 발번했습니다 — 트리 위치로 다시 계산한 번호는 ${res.recomputed_external_id ?? '(계산 불가)'} 입니다. 확인해 주세요.`
    : `${res.issued_external_id} 를 발번했습니다.`
  return res.storage_warning === undefined ? head : `${head} ${res.storage_warning}`
}

