/**
 * ID 매핑 (`#/trace`) — 추적 체인 REQ → IA → FN → SCR. (산출물 pipeline-v2 P1-05)
 *
 * 구성: KPI 5칸 → 추적 체인(RTM) 표 → 커버리지 갭 제안 → 100% 배너 / G1 판정 → 각주.
 *
 * 이 화면이 지키는 것:
 * - **ID 발번은 사람이 누른다.** 사유·행위자를 넣고 버튼을 눌러야 값이 저장된다.
 * - **갭 제안은 모델이 아니라 규칙 계산이다** (`packages/domain/src/rtm.ts` — 모델 호출이 없다).
 *   자격 증명을 넣어 두면 레일 배지가 «내 토큰으로 실제 호출» 이라 이 제안도 AI 가 쓴 것으로 읽힌다 —
 *   그래서 화면 문구에 «규칙» 이라고 못 박는다 (CLAUDE.md: 더미와 실제를 구분해 보여준다).
 * - **없는 것을 빈칸으로 두지 않는다.** 미발번은 «(IA 코드 미발번)» 이라고 적고, 세지 못한 것은 각주에 자백한다.
 * - **서버가 번호를 다시 계산한다.** 화면이 제안한 번호와 다르면 그 사실을 알린다.
 */
import { useState } from 'react'
import { api } from '../api.js'
import { Badge, Empty, ErrorBox, Loading } from '../components/common.js'
import { IS_DEMO } from '../demo-mode.js'
import { notifyDataChanged, useAsync, useStoredValue } from '../hooks.js'
import { PROPOSAL_INPUT_PLACEHOLDERS, PROPOSAL_KIND_LABELS, PROPOSAL_SUBMIT_LABELS, ROW_STATUS_LABELS, ROW_STATUS_TONES, canSubmit, footnotes, idCellText, issuanceFunctionId, isIssuanceProposal, kpiCells, ratioText, showsFullCoverageBanner, withStorageWarning } from '../rtm-view.js'
import { hrefTo, hrefToScreen } from '../router.js'
import type { IdIssueResponse, Project, RtmGapProposal, RtmReport } from '../types.js'

export function TraceMatrixPage({ project }: { project: Project }) {
  const rtm = useAsync(() => api.rtm(project.id), [project.id])
  // 화면 연결은 사람에게 **외부 ID** 를 받아 **내부 UUID** 로 옮겨 보낸다 (ID 안팎 분리).
  // 이름을 또렷하게 둔다 — run() 안에 같은 이름의 지역 변수가 있다.
  const projectDetail = useAsync(() => api.project(project.id), [project.id])
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
                // 제안이 들고 온 대상 기능을 그대로 보낸다 — 보고서에서 짐작하지 않는다 (rtm-view.ts 주석).
                const fnId = issuanceFunctionId(p)
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
                if (existing.includes(requirementId)) throw new Error(`${requirementId} 는 이미 이 노드에 연결돼 있습니다 — 바뀌는 것이 없습니다`)
                // 중복을 넣지 않는다 (requirement_ids 는 통째로 교체되므로 쌓이면 그대로 남는다).
                const res = await api.patchIaNode(p.ia_node_id, { revision, by, reason, requirement_ids: [...new Set([...existing, requirementId])] })
                return withStorageWarning(`${requirementId} 를 연결했습니다`, res)
              })
            }
            onLinkScreen={(p, screenExternalId, reason) =>
              run('화면을 연결했습니다', async () => {
                if (p.ia_node_id === undefined) throw new Error('대상 IA 노드를 알 수 없습니다')
                const wanted = screenExternalId.trim()
                if (projectDetail.error !== null) throw new Error('화면 목록을 읽지 못했습니다 — 새로고침 후 다시 누르세요')
                if (projectDetail.data === null || projectDetail.data === undefined) throw new Error('화면 목록을 아직 읽지 못했습니다 — 잠시 뒤 다시 누르세요')
                const screens = projectDetail.data.screens
                const screen = screens.find((s) => s.external_id === wanted)
                if (screen === undefined) {
                  const known = screens.map((s) => s.external_id).join(', ')
                  throw new Error(`${wanted} 라는 화면이 이 프로젝트에 없습니다. 화면 외부 ID 를 넣으세요${known.length === 0 ? '' : ` (있는 화면: ${known})`}`)
                }
                const revision = await currentRevision(p.ia_node_id)
                // 사람에게는 외부 ID, API 에는 내부 id — 섞으면 연결이 조용히 어긋난다.
                const res = await api.patchIaNode(p.ia_node_id, { revision, by, reason, screen_plan_id: screen.id })
                return withStorageWarning(`「${wanted}」 를 연결했습니다 (화면 ID 는 사람이 보는 값, 저장은 내부 id 로 했습니다)`, res)
              })
            }
            onDefineFunction={(p, name, reason) =>
              run('기능을 추가했습니다 (번호는 따로 발번합니다)', async () => {
                if (p.ia_node_id === undefined) throw new Error('대상 IA 노드를 알 수 없습니다')
                const revision = await currentRevision(p.ia_node_id)
                const res = await api.patchIaNode(p.ia_node_id, { revision, by, reason, add_function: { name } })
                return withStorageWarning(`기능 「${name}」 을 추가했습니다 (번호는 따로 발번합니다)`, res)
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
          REQ → IA → FN → SCR. 새 단계는 새 ID 를 만들지 않고 참조만 더합니다. 갭 제안은 <strong>모델이 아니라 규칙 계산</strong>이고(이 화면은 모델을 부르지 않습니다),{' '}
          <strong>ID 발번은 사람이 사유와 함께 누릅니다</strong>.
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
  onLinkScreen,
  onDefineFunction,
}: {
  report: RtmReport
  by: string
  setBy: (v: string) => void
  busy: boolean
  onIssue: (p: RtmGapProposal, externalId: string, reason: string) => void
  onLink: (p: RtmGapProposal, requirementId: string, reason: string) => void
  onLinkScreen: (p: RtmGapProposal, screenExternalId: string, reason: string) => void
  onDefineFunction: (p: RtmGapProposal, name: string, reason: string) => void
}) {
  if (report.proposals.length === 0) return null
  return (
    <section className="card">
      <div className="card-head">
        <h3>커버리지 갭 제안</h3>
        <span className="muted small">규칙 계산으로 만든 초안입니다 (모델 호출 없음) — 사람이 승인해야 ID 가 발번됩니다</span>
      </div>
      <label className="gap-actor">
        승인자
        <input type="text" data-testid="trace-actor" value={by} placeholder="이름" onChange={(e) => setBy(e.target.value)} />
      </label>
      <ul className="gap-list">
        {report.proposals.map((p) => (
          <GapItem key={p.proposal_hash} proposal={p} by={by} busy={busy} onIssue={onIssue} onLink={onLink}
          onLinkScreen={onLinkScreen} onDefineFunction={onDefineFunction} />
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
  onLinkScreen,
  onDefineFunction,
}: {
  proposal: RtmGapProposal
  by: string
  busy: boolean
  onIssue: (p: RtmGapProposal, externalId: string, reason: string) => void
  onLink: (p: RtmGapProposal, requirementId: string, reason: string) => void
  onLinkScreen: (p: RtmGapProposal, screenExternalId: string, reason: string) => void
  onDefineFunction: (p: RtmGapProposal, name: string, reason: string) => void
}) {
  const [value, setValue] = useState(proposal.suggested_value ?? '')
  const [reason, setReason] = useState('')
  const ready = canSubmit(by, reason) && value.trim().length > 0 && !busy

  const label = PROPOSAL_SUBMIT_LABELS[proposal.kind]
  const placeholder =
    proposal.kind === 'link_requirement' ? proposal.requirement_external_id ?? PROPOSAL_INPUT_PLACEHOLDERS[proposal.kind] : PROPOSAL_INPUT_PLACEHOLDERS[proposal.kind]

  /**
   * 종류마다 하는 일이 다르다 — **빠짐없이 적는다.**
   * 예전에는 `else` 폴백이 있어 `link_screen`(화면 연결)이 `onDefineFunction`(기능 추가)으로 샜고,
   * 승인하면 화면은 안 붙고 사유·행위자가 붙은 거짓 기능이 IA 노드에 남았다.
   */
  const submit = () => {
    const v = value.trim()
    const r = reason.trim()
    switch (proposal.kind) {
      case 'issue_ia_id':
      case 'issue_fn_id':
        onIssue(proposal, v, r)
        return
      case 'link_requirement':
        onLink(proposal, v, r)
        return
      case 'link_screen':
        onLinkScreen(proposal, v, r)
        return
      case 'define_function':
        onDefineFunction(proposal, v, r)
        return
      default: {
        // 새 제안 종류가 생기면 **여기서 컴파일이 막는다.** 고친 버그가 「다른 쓰기로 샌다」였으니,
        // 그게 「조용히 아무 쓰기도 안 한다」로 바뀌지 않게 한다.
        const never: never = proposal.kind
        throw new Error(`처리할 수 없는 제안 종류입니다: ${String(never)}`)
      }
    }
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

