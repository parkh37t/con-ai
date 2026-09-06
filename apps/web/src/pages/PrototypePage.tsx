/**
 * 프로토타입 둘러보기 (`#/prototype`) — 4단계를 순서대로 한 번 돌려보는 화면.
 *
 * 이 화면이 지키는 것
 * - **뒷문을 만들지 않는다.** 각 단계는 다른 화면이 쓰는 것과 같은 API 를 그대로 부른다.
 *   여기서 통과한 것은 실제 화면에서도 통과한다.
 * - **무엇이 실제로 도는지 적는다.** 단계마다 「지금 도는 것」과 「미리 기록해 둔 것」을 나눠 보여 준다.
 * - **결과를 링크로 넘긴다.** 각 단계가 끝나면 그 결과를 볼 수 있는 실제 화면으로 보낸다.
 * - 진행 기록은 이 브라우저에만 남는다. 「처음부터 다시」로 지운다.
 */
import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { loadAsisSamples, type AsisSampleTarget } from '../asis-samples.js'
import { Badge, ErrorBox } from '../components/common.js'
import { IS_DEMO } from '../demo-mode.js'
import { notifyDataChanged, useAsync, useStoredValue } from '../hooks.js'
import {
  PROTOTYPE_APPROVER,
  PROTOTYPE_COMMENTS,
  PROTOTYPE_SENTENCE,
  PROTOTYPE_STEPS,
  clearRun,
  doneCount,
  isComplete,
  loadRun,
  progressText,
  saveRun,
  stepStatus,
  type PrototypeRun,
  type PrototypeStepId,
  type PrototypeStepSpec,
} from '../prototype.js'
import { autoReferenceIds, buildSimpleCreateRequest, buildSimpleEditRequest } from '../simple-flow.js'
import { hrefTo, hrefToAsisDetail, hrefToDesign, hrefToScreen } from '../router.js'
import type { Job, Project, ScreenCreateInput } from '../types.js'

/** 작업·분석이 끝날 때까지 기다린다 (실제 화면의 폴링과 같은 간격). */
const POLL_MS = 700
const POLL_LIMIT = 400

export function PrototypePage({ project }: { project: Project }) {
  const [run, setRun] = useState<PrototypeRun>(() => loadRun())
  const [busy, setBusy] = useState<PrototypeStepId | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [note, setNote] = useState<string | null>(null)
  const [storageWarning, setStorageWarning] = useState(false)
  const [approver, setApprover] = useStoredValue('con-ai.approver', PROTOTYPE_APPROVER)
  const samples = useAsync(async () => (IS_DEMO ? await loadAsisSamples() : []), [])
  const meta = useAsync(() => api.meta(), [])

  useEffect(() => {
    if (!saveRun(run)) setStorageWarning(true)
  }, [run])

  const advance = (patch: Partial<PrototypeRun>) => setRun((r) => ({ ...r, ...patch }))

  const step = async (id: PrototypeStepId, label: string, fn: () => Promise<string>) => {
    setBusy(id)
    setError(null)
    setNote(null)
    try {
      setNote(await fn())
      notifyDataChanged()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(null)
    }
    void label
  }

  // ---------------------------------------------------------------- 단계 실행

  const runAsis = () =>
    step('asis', 'AS-IS', async () => {
      const target: AsisSampleTarget | undefined = (samples.data ?? [])[0]
      if (!target) throw new Error('샘플 대상이 없습니다. 정적 배포(스냅샷)에서만 이 단계를 돌릴 수 있습니다.')
      const { analysis_id } = await api.createAsisAnalysis(project.id, { url: target.url, note: `프로토타입 · ${target.label}` })
      const doc = await pollAsis(analysis_id)
      advance({ analysis_id, pain_point_count: doc.pain_points.length })
      return `${target.label} 분석 완료 — 페인포인트 ${doc.pain_points.length}건을 규칙으로 만들었습니다.`
    })

  const runGenerate = () =>
    step('generate', '생성', async () => {
      const references = await api.references(project.id)
      // 「만들기」 화면과 같은 절차 — 참고 화면을 자동으로 고르고, 그 열 구성으로 예시 더미데이터를 붙인다.
      // (더미데이터가 없으면 표가 0행이 되어 V3 검색 검사가 정직하게 실패한다.)
      const sampleFrom = autoReferenceIds(PROTOTYPE_SENTENCE, references)[0]
      const body: ScreenCreateInput = { title: '견적 요청 목록 (프로토타입)', device: 'desktop', shell: 'partner-page' }
      if (sampleFrom !== undefined) body.sample_from = sampleFrom
      const { screen } = await api.createScreen(project.id, body)
      const { request } = buildSimpleCreateRequest({ screen_id: screen.id, sentence: PROTOTYPE_SENTENCE, device: 'desktop', references })
      const { job_id } = await api.createJob(screen.id, request)
      const job = await pollJob(job_id)
      const revisionId = job.result?.revision_id
      if (!revisionId) throw new Error('생성 작업에 결과 revision 이 없습니다')
      advance({ screen_id: screen.id, screen_external_id: screen.external_id, revision1_id: revisionId })
      return `${screen.external_id} revision 1 을 만들었습니다 (어댑터 ${job.adapter}/${job.model}).`
    })

  const runReview = () =>
    step('review', '검토', async () => {
      const screenId = run.screen_id
      const baseId = run.revision1_id
      if (!screenId || !baseId) throw new Error('앞 단계의 결과가 없습니다')
      const commentIds: string[] = []
      for (const c of PROTOTYPE_COMMENTS) {
        const saved = await api.createComment(baseId, { target: 'screen', author: c.author, role: c.role, text: c.text, blocking: c.blocking })
        commentIds.push(saved.id)
      }
      const draft = await api.revisionPrompt(baseId, commentIds)
      const base = await api.revision(baseId)
      const request = buildSimpleEditRequest({ screen_id: screenId, base_revision_id: baseId, instruction: draft.prompt, device: 'desktop', spec: base.spec })
      request.comment_ids = commentIds
      const { job_id } = await api.createJob(screenId, request)
      const job = await pollJob(job_id)
      const revisionId = job.result?.revision_id
      if (!revisionId) throw new Error('수정 작업에 결과 revision 이 없습니다')
      advance({ comment_ids: commentIds, revision2_id: revisionId })
      return `코멘트 ${commentIds.length}건을 반영해 revision 2 를 만들었습니다 (초안 어댑터 ${draft.adapter}).`
    })

  const runApprove = () =>
    step('approve', '완료', async () => {
      const screenId = run.screen_id
      const revisionId = run.revision2_id
      if (!screenId || !revisionId) throw new Error('앞 단계의 결과가 없습니다')
      const res = await api.approve(screenId, { revision_id: revisionId, approver: approver.trim() || PROTOTYPE_APPROVER })
      advance({ approved_version: res.version, export_file_count: res.files.length })
      return `완료 v${res.version} — 산출물 ${res.files.length}개 파일을 만들었습니다.`
    })

  const RUNNERS: Readonly<Record<PrototypeStepId, () => Promise<void>>> = {
    asis: runAsis,
    generate: runGenerate,
    review: runReview,
    approve: runApprove,
  }

  const reset = () => {
    clearRun()
    setRun({})
    setError(null)
    setNote('진행 기록을 지웠습니다. 만들어진 화면·설계서는 그대로 남아 있습니다 (「이 브라우저 저장 데이터 지우기」로 함께 지울 수 있습니다).')
  }

  const adapterLine =
    meta.data === null
      ? '어댑터 확인 중…'
      : meta.data.adapter === 'anthropic'
        ? `실제 모델 호출 — ${meta.data.model} (이 브라우저가 api.anthropic.com 을 직접 호출합니다)`
        : '더미 어댑터(fixture) — 모델을 호출하지 않고 규칙으로 명세를 만듭니다. 나머지 단계는 모두 실제로 실행됩니다.'

  return (
    <div className="page page-reading">
      <header className="projhead">
        <div className="projhead-copy">
          <span className="projhead-kicker">
            <span className="kicker-no" aria-hidden="true">
              ▶
            </span>
            프로토타입 둘러보기 · <span data-testid="project-name">{project.name}</span>
          </span>
          <h1>4단계를 처음부터 끝까지 한 번 돌려봅니다</h1>
          <p>
            아래 버튼은 <strong>다른 화면과 같은 API</strong> 를 그대로 부릅니다 — 여기서 통과한 것은 실제 화면에서도 통과합니다. 단계마다 «지금 도는 것»과 «미리 기록해 둔 것»을
            나눠 적었습니다.
          </p>
        </div>
      </header>

      <div className="proto-status" data-testid="proto-status">
        <span className="proto-progress" data-testid="proto-progress">
          {progressText(run)}
        </span>
        <span className="proto-bar" aria-hidden="true">
          {PROTOTYPE_STEPS.map((s) => (
            <span key={s.id} className={`proto-bar-seg${stepStatus(run, s.id) === 'done' ? ' is-done' : ''}`} />
          ))}
        </span>
        <span className="muted small" data-testid="proto-adapter">
          {adapterLine}
        </span>
      </div>

      {storageWarning && (
        <div className="notice notice-amber" data-testid="proto-storage-warning">
          이 브라우저에 진행 기록을 저장하지 못했습니다 — 새로고침하면 처음부터 다시 해야 합니다 (사생활 보호 모드일 수 있습니다).
        </div>
      )}
      {note && (
        <div className="notice notice-green" role="status" data-testid="proto-note">
          {note}
        </div>
      )}
      {error ? <ErrorBox error={error} title="이 단계를 끝내지 못했습니다" testId="proto-error" /> : null}

      <ol className="proto-steps">
        {PROTOTYPE_STEPS.map((spec) => (
          <StepCard
            key={spec.id}
            spec={spec}
            status={stepStatus(run, spec.id)}
            busy={busy === spec.id}
            disabled={busy !== null}
            run={run}
            samples={samples.data ?? []}
            approver={approver}
            setApprover={setApprover}
            onRun={() => void RUNNERS[spec.id]()}
          />
        ))}
      </ol>

      {isComplete(run) && (
        <div className="notice notice-green" data-testid="proto-complete">
          <strong>4단계를 모두 돌렸습니다.</strong> 만들어진 설계서·검증 결과·승인 기록은 이 브라우저에 남아 있습니다. 요구사항과 화면의 연결은{' '}
          <a href={hrefTo('trace')}>ID 매핑</a> 에서 이어서 볼 수 있습니다.
        </div>
      )}

      <section className="card proto-foot">
        <div className="card-head">
          <h3 className="section-title">다시 하기</h3>
          <span className="muted small">진행 기록만 지웁니다 — 만들어진 화면·설계서는 남습니다</span>
        </div>
        <button type="button" className="btn" data-testid="proto-reset" onClick={reset} disabled={busy !== null || doneCount(run) === 0}>
          처음부터 다시
        </button>
      </section>
    </div>
  )
}

// ---------------------------------------------------------------- 단계 카드

function StepCard({
  spec,
  status,
  busy,
  disabled,
  run,
  samples,
  approver,
  setApprover,
  onRun,
}: {
  spec: PrototypeStepSpec
  status: ReturnType<typeof stepStatus>
  busy: boolean
  disabled: boolean
  run: PrototypeRun
  samples: readonly AsisSampleTarget[]
  approver: string
  setApprover: (v: string) => void
  onRun: () => void
}) {
  const tone = status === 'done' ? 'green' : status === 'ready' ? 'blue' : 'gray'
  const label = status === 'done' ? '끝남' : status === 'ready' ? '지금 할 차례' : '앞 단계 먼저'
  return (
    <li className={`card proto-step${status === 'ready' ? ' is-ready' : ''}`} data-testid="proto-step" data-step={spec.id} data-status={status}>
      <div className="proto-step-head">
        <span className="proto-step-no" aria-hidden="true">
          {spec.no}
        </span>
        <div className="proto-step-title">
          <h3>{spec.title}</h3>
          <p className="muted small">{spec.goal}</p>
        </div>
        <Badge tone={tone} testId="proto-step-status">
          {label}
        </Badge>
      </div>

      <dl className="proto-facts">
        <div>
          <dt>지금 실제로 도는 것</dt>
          <dd>{spec.runs}</dd>
        </div>
        {spec.sampled && (
          <div>
            <dt>미리 기록해 둔 것 · 샘플</dt>
            <dd>{spec.sampled}</dd>
          </div>
        )}
      </dl>

      <StepDetail spec={spec} run={run} samples={samples} approver={approver} setApprover={setApprover} />

      <div className="proto-step-actions">
        {/* 끝난 단계는 실행 버튼을 두지 않는다 — 다시 누를 수 없는 버튼을 남겨 두면 무엇을 해야 할지 흐려진다. */}
        {status !== 'done' && (
          <button type="button" className="btn btn-primary" data-testid="proto-run" onClick={onRun} disabled={disabled || status !== 'ready'}>
            {busy ? '실행 중…' : spec.action}
          </button>
        )}
        <StepResult spec={spec} run={run} />
      </div>
    </li>
  )
}

/** 그 단계가 무엇을 쓰는지 — 샘플 문장·코멘트를 숨기지 않고 그대로 보여 준다. */
function StepDetail({
  spec,
  run,
  samples,
  approver,
  setApprover,
}: {
  spec: PrototypeStepSpec
  run: PrototypeRun
  samples: readonly AsisSampleTarget[]
  approver: string
  setApprover: (v: string) => void
}) {
  if (spec.id === 'asis') {
    const target = samples[0]
    if (!target) return <p className="muted small">샘플 대상이 없습니다 — 서버 실행에서는 AS-IS 화면에서 URL 을 직접 넣습니다.</p>
    return (
      <p className="proto-sample" data-testid="proto-sample">
        대상 <strong>{target.label}</strong> · <code>{target.url}</code> — {target.description}
      </p>
    )
  }
  if (spec.id === 'generate') {
    return (
      <p className="proto-sample" data-testid="proto-sample">
        요청 문장: <q>{PROTOTYPE_SENTENCE}</q>
      </p>
    )
  }
  if (spec.id === 'review') {
    return (
      <ul className="proto-sample-list" data-testid="proto-sample">
        {PROTOTYPE_COMMENTS.map((c) => (
          <li key={c.text}>
            <Badge tone={c.blocking ? 'red' : 'gray'}>{c.blocking ? '차단' : '비차단'}</Badge> <strong>{c.author}</strong> — {c.text}
          </li>
        ))}
      </ul>
    )
  }
  return (
    <label className="proto-approver">
      승인자
      <input type="text" data-testid="proto-approver" value={approver} onChange={(e) => setApprover(e.target.value)} placeholder={PROTOTYPE_APPROVER} disabled={run.approved_version !== undefined} />
    </label>
  )
}

/** 끝난 단계의 결과 — 실제 화면으로 보낸다. */
function StepResult({ spec, run }: { spec: PrototypeStepSpec; run: PrototypeRun }) {
  if (spec.id === 'asis' && run.analysis_id) {
    return (
      <a className="btn btn-small" data-testid="proto-result" href={hrefToAsisDetail(run.analysis_id)}>
        페인포인트 {run.pain_point_count}건 보기 →
      </a>
    )
  }
  if (spec.id === 'generate' && run.revision1_id) {
    return (
      <a className="btn btn-small" data-testid="proto-result" href={hrefToDesign(run.revision1_id)}>
        {run.screen_external_id} 설계서 열기 →
      </a>
    )
  }
  if (spec.id === 'review' && run.revision2_id && run.screen_id) {
    return (
      <a className="btn btn-small" data-testid="proto-result" href={hrefToScreen('review', run.screen_id, { revision: run.revision2_id })}>
        검토 화면에서 보기 →
      </a>
    )
  }
  if (spec.id === 'approve' && run.approved_version && run.screen_id) {
    return (
      <a className="btn btn-small" data-testid="proto-result" href={hrefToScreen('approve', run.screen_id)}>
        v{run.approved_version} · 산출물 {run.export_file_count}개 →
      </a>
    )
  }
  return null
}

// ---------------------------------------------------------------- 폴링

async function pollJob(jobId: string): Promise<Job> {
  for (let i = 0; i < POLL_LIMIT; i += 1) {
    const job = await api.job(jobId)
    if (job.status === 'succeeded') return job
    if (job.status === 'failed' || job.status === 'cancelled') {
      throw new Error(`작업이 ${job.status} 로 끝났습니다: ${job.failure?.message ?? '이유 없음'}`)
    }
    await sleep(POLL_MS)
  }
  throw new Error('작업이 제한 시간 안에 끝나지 않았습니다')
}

async function pollAsis(analysisId: string) {
  for (let i = 0; i < POLL_LIMIT; i += 1) {
    const doc = await api.asisAnalysis(analysisId)
    if (doc.status === 'succeeded') return doc
    if (doc.status === 'failed') throw new Error(`분석이 실패했습니다: ${doc.failure?.message ?? '이유 없음'}`)
    await sleep(POLL_MS)
  }
  throw new Error('분석이 제한 시간 안에 끝나지 않았습니다')
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
