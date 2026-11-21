/**
 * 「메뉴에서 화면 만들기」 (`#/plan`) — 메뉴구조도 → 화면 ID → 근거(SSOT) → 프롬프트 → 생성.
 *
 * 이 화면이 있는 이유: 한 줄 문장만 받으면 「무엇을 근거로 무엇을 만들었는가」가 사라진다.
 * 여기서는 만들기 **전에** 네 가지를 먼저 보여 주고, 그 상태 그대로 생성한다.
 *
 * 이 화면이 지키는 것
 * - 화면에 보여 준 것과 실제로 보내는 요청이 **같은 함수**에서 나온다 (plan.ts buildPlanRequest).
 * - 프롬프트는 예시가 아니라 **그 자리에서 조립한 실제 프롬프트**다 (POST prompt-preview).
 * - 없는 것은 «없음» 이라고 적는다. 발번 전 IA 는 «미발번» 이다 — 빈칸으로 두지 않는다.
 */
import { useState } from 'react'
import { api } from '../api.js'
import { Badge, ErrorBox, Loading } from '../components/common.js'
import { useAsync } from '../hooks.js'
// 프로파일 규칙 수는 **렌더러 프로파일에서 읽는다.** 예전에는 화면에 상수 11 이 박혀 있었고,
// 그걸 감싼 meta 조건은 절대 걸리지 않는 죽은 분기였다 — 서버가 준 값이 아닌데 그렇게 보였다.
import { S2B_LEARNED_PROFILE } from '../browser-run/deps.js'
import { autoReferenceIds } from '../simple-flow.js'
import { buildPlanRequest, buildableNodes, flattenMenu, pickRequirements, planPurpose, ssotFor, type PlanNode, type PlanScreenState } from '../plan.js'
import { hrefTo, hrefToDesign } from '../router.js'
import type { Project, PromptPreviewResponse, Reference, SliceGenerationRequest } from '../types.js'

const STATE_LABEL: Record<PlanScreenState, string> = {
  no_screen: '화면 미연결',
  missing: '화면 문서 없음',
  draft: '아직 안 만듦',
  built: '설계서 있음',
}
const STATE_TONE: Record<PlanScreenState, 'gray' | 'red' | 'blue' | 'green'> = {
  no_screen: 'gray',
  missing: 'red',
  draft: 'blue',
  built: 'green',
}

const JOB_TIMEOUT_MS = 120_000

export function PlanPage({ project }: { project: Project }) {
  const detail = useAsync(() => api.project(project.id), [project.id])
  const references = useAsync(() => api.references(project.id), [project.id])
  const meta = useAsync(() => api.meta(), [])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ node_id: string; data: PromptPreviewResponse } | null>(null)

  if (detail.error) return <ErrorBox error={detail.error} title="메뉴구조도를 읽지 못했습니다" />
  if (!detail.data) return <Loading text="메뉴구조도를 읽는 중…" />

  const nodes = flattenMenu(detail.data.ia_nodes, detail.data.screens)
  const selected = nodes.find((n) => n.node.id === selectedId) ?? nodes.find((n) => n.state === 'draft') ?? nodes.find((n) => n.node.kind === 'screen')
  const buildable = buildableNodes(nodes)
  const refs: Reference[] = references.data ?? []

  /** 이 메뉴의 생성 요청 — 화면에 보여 주는 것과 실제로 보내는 것이 같은 함수에서 나온다. */
  const requestFor = (plan: PlanNode): SliceGenerationRequest | null => {
    const screen = plan.screen
    if (!screen) return null
    const purpose = planPurpose(plan, pickRequirements(plan, detail.data?.requirements ?? []))
    return buildPlanRequest({
      plan,
      screen_id: screen.id,
      device: screen.device ?? 'desktop',
      requirements: detail.data?.requirements ?? [],
      reference_ids: autoReferenceIds(purpose, refs),
    })
  }

  const run = async (label: string, key: string, fn: () => Promise<string>) => {
    setBusy(key)
    setError(null)
    setNotice(null)
    try {
      setNotice(await fn())
    } catch (e) {
      setError(e)
    } finally {
      setBusy(null)
      // 실패해도 다시 읽는다 — 「모두 만들기」가 중간에 멈췄을 때 그때까지 만든 화면이 사라진 것처럼 보이지 않게.
      detail.reload()
    }
  }

  const pollJob = async (jobId: string): Promise<string> => {
    const until = Date.now() + JOB_TIMEOUT_MS
    for (;;) {
      const job = await api.job(jobId)
      if (job.status === 'succeeded' && job.result?.revision_id) return job.result.revision_id
      if (job.status === 'failed') throw new Error(job.failure?.message ?? '생성에 실패했습니다')
      if (Date.now() > until) throw new Error('생성이 제한 시간 안에 끝나지 않았습니다')
      await new Promise((r) => setTimeout(r, 400))
    }
  }

  const generate = (plan: PlanNode) =>
    run(`${plan.node.name} 설계서를 만들었습니다`, `gen:${plan.node.id}`, async () => {
      const request = requestFor(plan)
      if (!request) throw new Error('이 메뉴에는 화면이 연결되어 있지 않습니다')
      const { job_id } = await api.createJob(request.screen_id, request)
      const revisionId = await pollJob(job_id)
      return `${plan.node.name} (${plan.screen?.external_id}) 설계서를 만들었습니다 — revision ${revisionId.slice(0, 8)}…`
    })

  /**
   * 미생성 화면을 **한 건씩 순서대로** 만든다 (동시 호출을 하지 않아 모델 요청 한도를 덜 건드린다).
   *
   * 중간에 실패하면 거기서 멈춘다 — 자격 증명이 만료됐거나 한도를 넘었다면 나머지도 같은 이유로 실패할
   * 것이고, 그만큼 요청을 더 태울 이유가 없다. 다만 **그때까지 만든 화면을 보고에서 빼지 않는다.**
   */
  const generateAll = () =>
    run('모두 만들었습니다', 'gen:all', async () => {
      const made: string[] = []
      for (const plan of buildable) {
        const request = requestFor(plan)
        if (!request) continue
        try {
          const { job_id } = await api.createJob(request.screen_id, request)
          await pollJob(job_id)
          made.push(`${plan.node.name}(${plan.screen?.external_id ?? '화면 ID 없음'})`)
        } catch (e) {
          const why = e instanceof Error ? e.message : String(e)
          const done = made.length === 0 ? '아직 아무것도 만들지 못했습니다' : `먼저 ${made.length}건은 만들었습니다 — ${made.join(', ')}`
          throw new Error(`${plan.node.name} 에서 멈췄습니다: ${why}\n${done}. 남은 ${buildable.length - made.length - 1}건은 시도하지 않았습니다.`)
        }
      }
      if (made.length === 0) return '만들 화면이 없습니다 — 메뉴구조도의 화면이 모두 생성되어 있습니다.'
      return `아직 만들지 않았던 화면 ${made.length}건을 만들었습니다 (${made.join(', ')}). 목업의 메뉴를 눌러 서로 오갈 수 있습니다.`
    })

  const showPrompt = (plan: PlanNode) =>
    run('프롬프트를 조립했습니다', `prompt:${plan.node.id}`, async () => {
      const request = requestFor(plan)
      if (!request) throw new Error('이 메뉴에는 화면이 연결되어 있지 않습니다')
      const data = await api.promptPreview(request.screen_id, request)
      setPreview({ node_id: plan.node.id, data })
      return `${plan.node.name} 의 프롬프트를 조립했습니다 (템플릿 ${data.prompt.template_version}) — 모델은 부르지 않았습니다.`
    })

  return (
    <div className="page plan-page">
      <header className="page-head">
        <div>
          <h1>메뉴에서 화면 만들기</h1>
          <p className="muted">
            메뉴구조도의 어느 메뉴인지 → 화면 ID → 무엇을 근거로 하는지 → 그래서 프롬프트가 무엇인지 확인하고 만듭니다. 한 줄 문장만으로 만들고 싶으면{' '}
            <a href={hrefTo('create')}>만들기</a> 를 쓰세요.
          </p>
        </div>
        <button type="button" className="btn btn-primary" data-testid="plan-build-all" disabled={busy !== null || buildable.length === 0} onClick={() => void generateAll()}>
          {busy === 'gen:all' ? '만드는 중…' : `아직 안 만든 화면 ${buildable.length}건 모두 만들기`}
        </button>
      </header>

      {notice && (
        <p className="notice" role="status" data-testid="plan-notice">
          {notice}
        </p>
      )}
      {error ? <ErrorBox error={error} title="이 단계를 끝내지 못했습니다" testId="plan-error" /> : null}

      <div className="plan-split">
        <section className="card plan-tree" aria-label="메뉴구조도">
          <h2 className="card-title">메뉴구조도</h2>
          <p className="muted small">화면은 메뉴에 붙어 있습니다. 메뉴를 고르면 그 화면의 근거와 프롬프트가 오른쪽에 나옵니다.</p>
          <ul className="plan-tree-list">
            {nodes.map((n) => (
              <li key={n.node.id} style={{ paddingLeft: `${n.depth * 16}px` }}>
                <button
                  type="button"
                  className={`plan-node${selected?.node.id === n.node.id ? ' is-selected' : ''}`}
                  data-testid="plan-node"
                  data-node-state={n.state}
                  onClick={() => setSelectedId(n.node.id)}
                >
                  <span className="plan-node-name">{n.node.name}</span>
                  <span className="plan-node-id">{n.node.external_id ?? 'IA 미발번'}</span>
                  {n.node.kind === 'screen' && <Badge tone={STATE_TONE[n.state]}>{STATE_LABEL[n.state]}</Badge>}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="card plan-detail" aria-label="이 메뉴의 화면">
          {selected === undefined ? (
            <p className="muted">메뉴구조도에 화면 노드가 없습니다.</p>
          ) : (
            <PlanDetail
              plan={selected}
              project={project}
              requirements={detail.data.requirements}
              references={refs}
              profileRules={S2B_LEARNED_PROFILE.rules.length}
              request={requestFor(selected)}
              busy={busy}
              preview={preview?.node_id === selected.node.id ? preview.data : null}
              onGenerate={() => void generate(selected)}
              onPrompt={() => void showPrompt(selected)}
            />
          )}
        </section>
      </div>
    </div>
  )
}

function PlanDetail({
  plan,
  project,
  requirements,
  references,
  profileRules,
  request,
  busy,
  preview,
  onGenerate,
  onPrompt,
}: {
  plan: PlanNode
  project: Project
  requirements: import('../types.js').Requirement[]
  references: Reference[]
  profileRules: number | null
  request: SliceGenerationRequest | null
  busy: string | null
  preview: PromptPreviewResponse | null
  onGenerate: () => void
  onPrompt: () => void
}) {
  const ssot = ssotFor({
    plan,
    project,
    requirements,
    references,
    reference_ids: request?.reference_ids ?? [],
    profile_rule_count: profileRules ?? 0,
  })
  return (
    <>
      <ol className="plan-steps">
        <li>
          <span className="plan-step-label">① 어느 메뉴인가</span>
          <div className="plan-step-body" data-testid="plan-menu">
            <strong>{[...plan.path, plan.node.name].join(' › ')}</strong>
            <span className="tagline">{plan.node.external_id ?? 'IA 미발번 — ID 매핑에서 발번합니다'}</span>
          </div>
        </li>
        <li>
          <span className="plan-step-label">② 화면 ID</span>
          <div className="plan-step-body" data-testid="plan-screen-id">
            {plan.screen ? (
              <>
                <strong className="mono">{plan.screen.external_id}</strong>
                <Badge tone={STATE_TONE[plan.state]}>{STATE_LABEL[plan.state]}</Badge>
                {plan.screen.current_revision_id && (
                  <a className="btn btn-small" href={hrefToDesign(plan.screen.current_revision_id)}>
                    설계서 보기
                  </a>
                )}
              </>
            ) : (
              <span className="muted">이 메뉴에는 화면이 연결되어 있지 않습니다 ({STATE_LABEL[plan.state]}).</span>
            )}
          </div>
        </li>
        <li>
          <span className="plan-step-label">③ 무엇을 근거로 하나 (SSOT)</span>
          <table className="plan-ssot" data-testid="plan-ssot">
            <tbody>
              {ssot.map((item, i) => (
                <tr key={`${item.kind}-${i}`}>
                  <th scope="row">{item.kind}</th>
                  <td>{item.label}</td>
                  <td className="muted small">{item.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </li>
        <li>
          <span className="plan-step-label">④ 그래서 프롬프트는</span>
          <div className="plan-step-body">
            <button type="button" className="btn btn-small" data-testid="plan-prompt" disabled={busy !== null || request === null} onClick={onPrompt}>
              {busy === `prompt:${plan.node.id}` ? '조립하는 중…' : '실제 보낼 프롬프트 보기'}
            </button>
            <span className="muted small">모델을 부르지 않고 이번 요청의 문맥으로 그 자리에서 조립합니다.</span>
          </div>
          {preview && (
            <div className="plan-prompt" data-testid="plan-prompt-view">
              <p className="muted small">템플릿 {preview.prompt.template_version} · 문맥 {preview.context_summary.length}건</p>
              <ul className="plan-context">
                {preview.context_summary.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <details>
                <summary>system 프롬프트</summary>
                <pre>{preview.prompt.system}</pre>
              </details>
              <details open>
                <summary>user 프롬프트 (7구역 표 + 근거 자료)</summary>
                <pre>{preview.prompt.user}</pre>
              </details>
            </div>
          )}
        </li>
      </ol>

      <div className="plan-actions">
        <button type="button" className="btn btn-primary" data-testid="plan-build" disabled={busy !== null || request === null} onClick={onGenerate}>
          {busy === `gen:${plan.node.id}` ? '만드는 중…' : plan.state === 'built' ? '다시 만들기' : '이 메뉴의 화면 만들기'}
        </button>
      </div>
    </>
  )
}
