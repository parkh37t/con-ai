/**
 * 생성 작업대 — 폼(작업 유형·목적·범위·요구사항/수용조건·참고 화면·CASE·유지 조건·역할·기기·직접 프롬프트)
 * → 프롬프트 미리보기 → 생성 실행(202 job_id) → 작업 상태 패널(2초 폴링). 작업 id 는 URL `?job=` 에 남겨 새로고침 후에도 읽는다.
 */
import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import { Badge, Collapsible, Empty, ErrorBox, Loading, formatDateTime } from '../components/common.js'
import { JobStatusPanel } from '../components/JobStatusPanel.js'
import { ReferenceCard } from '../components/ReferenceCard.js'
import { ALL_CASES, TASK_TYPE_LABELS, buildRequest, initialFormState, toggleIn, validateForm, type GenerationFormState } from '../generation-form.js'
import { IS_DEMO } from '../demo-mode.js'
import { navigate, useAsync, useCredentialTick, useJobPolling } from '../hooks.js'
import { hrefTo, hrefToScreen, withQuery, type Route } from '../router.js'
import { CASE_LABELS } from '../summary.js'
import type { PromptPreviewResponse, Requirement, SliceTaskType } from '../types.js'

export function GeneratePage({ screenId, route }: { screenId: string; route: Route }) {
  const screen = useAsync(() => api.screen(screenId), [screenId])
  const projectId = screen.data?.screen.project_id ?? null
  const project = useAsync(() => (projectId ? api.project(projectId) : null), [projectId])
  const references = useAsync(() => (projectId ? api.references(projectId) : null), [projectId])

  const [form, setForm] = useState<GenerationFormState>(() => initialFormState(null))
  const formSeeded = useRef(false)
  useEffect(() => {
    if (screen.data && !formSeeded.current) {
      formSeeded.current = true
      setForm(initialFormState(screen.data.screen))
    }
  }, [screen.data])

  const [errors, setErrors] = useState<string[]>([])
  const [preview, setPreview] = useState<PromptPreviewResponse | null>(null)
  const [previewError, setPreviewError] = useState<unknown>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [runError, setRunError] = useState<unknown>(null)
  const [running, setRunning] = useState(false)

  const jobId = route.query['job'] ?? null
  const poll = useJobPolling(jobId, () => screen.reload())
  // 정적 배포에서 자격 증명이 없으면 실제 생성이 아니라 스냅샷 동작임을 알린다 (meta.adapter 로 판단).
  const credentialTick = useCredentialTick()
  const meta = useAsync(() => api.meta(), [credentialTick])
  const hasCredential = meta.data?.adapter === 'anthropic'

  const update = (patch: Partial<GenerationFormState>) => setForm((f) => ({ ...f, ...patch }))

  const onPreview = async () => {
    const errs = validateForm(form)
    setErrors(errs)
    if (errs.length > 0) return
    setPreviewLoading(true)
    setPreviewError(null)
    try {
      setPreview(await api.promptPreview(screenId, buildRequest(screenId, form)))
    } catch (e) {
      setPreview(null)
      setPreviewError(e)
    } finally {
      setPreviewLoading(false)
    }
  }

  const onRun = async () => {
    const errs = validateForm(form)
    setErrors(errs)
    if (errs.length > 0) return
    setRunning(true)
    setRunError(null)
    try {
      const { job_id } = await api.createJob(screenId, buildRequest(screenId, form))
      navigate(withQuery(route, { job: job_id }), { replace: true })
    } catch (e) {
      setRunError(e)
    } finally {
      setRunning(false)
    }
  }

  if (screen.error) return <ErrorBox error={screen.error} title="화면을 읽지 못했습니다" />
  if (!screen.data) return <Loading text="화면을 불러오는 중…" />
  const s = screen.data.screen
  const revisions = screen.data.revisions

  return (
    <div className="page">
      <nav className="breadcrumb" aria-label="경로">
        <a href={hrefTo('home')}>프로젝트 홈</a> › <code>{s.external_id}</code> › 생성 작업대
      </nav>
      <section className="card">
        <div className="card-head">
          <h2>
            생성 작업대 — {s.title} <code>{s.external_id}</code>
          </h2>
          <span className="actions">
            {revisions.length > 0 && (
              <a className="btn btn-small" href={hrefToScreen('review', screenId, s.current_revision_id ? { rev: s.current_revision_id } : undefined)}>
                검토 화면
              </a>
            )}
          </span>
        </div>
        <div className="muted small">
          shell {s.shell} · 기기 {s.device === 'mobile' ? '모바일' : 'PC'} · 상태 {s.status} · revision {revisions.length}개
        </div>
      </section>

      {jobId && <JobStatusPanel jobId={jobId} job={poll.job} error={poll.error} polling={poll.polling} screenId={screenId} />}
      {jobId && (
        <div className="row-right">
          <button type="button" className="btn" onClick={() => navigate(withQuery(route, { job: '' }), { replace: true })}>
            작업 표시 지우기
          </button>
        </div>
      )}

      {IS_DEMO && !hasCredential && (
        <div className="notice notice-amber" data-testid="browser-mode-hint">
          지금은 스냅샷 데모입니다 — 생성 실행은 저장된 결과를 보여줄 뿐입니다. <strong>위 자격 증명 패널에 토큰을 넣으면 실제로 생성됩니다</strong> (이 브라우저가 api.anthropic.com 을 직접 호출).
        </div>
      )}

      <section className="card">
        <h3>1. 작업</h3>
        <div className="form-grid">
          <label>
            작업 유형
            <select value={form.task_type} onChange={(e) => update({ task_type: e.target.value as SliceTaskType })}>
              {(Object.keys(TASK_TYPE_LABELS) as SliceTaskType[]).map((t) => (
                <option key={t} value={t}>
                  {TASK_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          {form.task_type === 'edit' && (
            <label>
              기준 revision
              <select value={form.base_revision_id} onChange={(e) => update({ base_revision_id: e.target.value })}>
                <option value="">선택</option>
                {revisions.map((r) => (
                  <option key={r.id} value={r.id}>
                    #{r.revision_no} · {formatDateTime(r.created_at)} · {r.artifact_status}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            기기
            <span className="radio-row">
              <label className="inline">
                <input type="radio" name="device" checked={form.device === 'desktop'} onChange={() => update({ device: 'desktop' })} /> PC
              </label>
              <label className="inline">
                <input type="radio" name="device" checked={form.device === 'mobile'} onChange={() => update({ device: 'mobile' })} /> 모바일
              </label>
            </span>
          </label>
          <label>
            역할 (쉼표 구분)
            <input type="text" value={form.roles_text} placeholder="예: partner, admin" onChange={(e) => update({ roles_text: e.target.value })} />
          </label>
          <label className="span-2">
            목적 (변경 목적)
            <input type="text" data-testid="purpose" value={form.purpose} placeholder="예: 파트너가 견적 요청 목록을 조회하고 상태별로 필터한다" onChange={(e) => update({ purpose: e.target.value })} />
          </label>
          <label className="span-2">
            변경 범위
            <input type="text" value={form.scope} placeholder="예: 검색 영역과 결과 표만 (선택)" onChange={(e) => update({ scope: e.target.value })} />
          </label>
        </div>
      </section>

      <section className="card">
        <h3>2. 기준 — 요구사항·수용조건</h3>
        {project.error ? <ErrorBox error={project.error} title="프로젝트 요구사항을 읽지 못했습니다" /> : null}
        {!project.data && !project.error && <Loading />}
        {project.data && (
          <RequirementPicker
            requirements={project.data.requirements}
            requirementIds={form.requirement_ids}
            criterionIds={form.criterion_ids}
            onChange={(requirement_ids, criterion_ids) => update({ requirement_ids, criterion_ids })}
          />
        )}
      </section>

      <section className="card">
        <h3>3. 참고 화면 (레퍼런스 포트폴리오)</h3>
        {references.error ? <ErrorBox error={references.error} title="레퍼런스를 읽지 못했습니다" /> : null}
        {!references.data && !references.error && <Loading />}
        {references.data && references.data.length === 0 && <Empty>레퍼런스가 없습니다.</Empty>}
        {references.data && references.data.length > 0 && (
          <div className="ref-grid">
            {references.data.map((r) => (
              <ReferenceCard key={r.id} reference={r} checkbox selected={form.reference_ids.includes(r.id)} onSelect={(id, on) => update({ reference_ids: toggleIn(form.reference_ids, id, on) })} />
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h3>4. CASE · 유지 조건</h3>
        <div className="form-grid">
          <div>
            <div className="label">CASE (정상은 기본)</div>
            <div className="check-row">
              {ALL_CASES.map((c) => (
                <label key={c} className="inline">
                  <input type="checkbox" data-testid={`case-${c}`} checked={form.cases.includes(c)} onChange={(e) => update({ cases: toggleIn(form.cases, c, e.target.checked) })} /> {CASE_LABELS[c] ?? c}
                </label>
              ))}
            </div>
          </div>
          <label className="span-2">
            유지 조건 (한 줄에 하나 — 변경 금지 요소, 데이터 계약, 유지할 동작)
            <textarea rows={4} value={form.keep_conditions_text} placeholder={'검색 영역의 필드 구성을 바꾸지 않는다\n표의 기본 정렬은 요청일 내림차순을 유지한다'} onChange={(e) => update({ keep_conditions_text: e.target.value })} />
          </label>
        </div>
      </section>

      <section className="card">
        <h3>5. 프롬프트</h3>
        <label className="inline">
          <input type="checkbox" checked={form.use_prompt_override} onChange={(e) => update({ use_prompt_override: e.target.checked })} /> 직접 프롬프트 (자동 조립 대신 사용; 문맥은 그대로 첨부)
        </label>
        {form.use_prompt_override && <textarea rows={8} value={form.prompt_override} placeholder="기획자가 직접 쓰는 프롬프트" onChange={(e) => update({ prompt_override: e.target.value })} />}

        {errors.length > 0 && (
          <div className="error-box" role="alert">
            <strong>입력을 확인하세요</strong>
            <ul>
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="button-row">
          <button type="button" className="btn" data-testid="preview-button" onClick={() => void onPreview()} disabled={previewLoading}>
            {previewLoading ? '미리보기 생성 중…' : '프롬프트 미리보기'}
          </button>
          <button type="button" className="btn btn-primary" data-testid="run-button" onClick={() => void onRun()} disabled={running}>
            {running ? '요청 중…' : '생성 실행'}
          </button>
        </div>
        {previewError ? <ErrorBox error={previewError} title="프롬프트 미리보기 실패" /> : null}
        {runError ? <ErrorBox error={runError} title="생성 실행 요청 실패" /> : null}
        {preview && <PromptPreviewView preview={preview} />}
      </section>
    </div>
  )
}

function RequirementPicker({ requirements, requirementIds, criterionIds, onChange }: { requirements: Requirement[]; requirementIds: string[]; criterionIds: string[]; onChange: (requirementIds: string[], criterionIds: string[]) => void }) {
  if (requirements.length === 0) return <Empty>요구사항이 없습니다.</Empty>
  const toggleRequirement = (r: Requirement, on: boolean) => {
    const nextReq = toggleIn(requirementIds, r.id, on)
    const ownCriteria = r.criteria.map((c) => c.id)
    const nextCrit = on ? [...criterionIds, ...ownCriteria.filter((id) => !criterionIds.includes(id))] : criterionIds.filter((id) => !ownCriteria.includes(id))
    onChange(nextReq, nextCrit)
  }
  const toggleCriterion = (r: Requirement, criterionId: string, on: boolean) => {
    const nextCrit = toggleIn(criterionIds, criterionId, on)
    const anyLeft = r.criteria.some((c) => nextCrit.includes(c.id))
    const nextReq = on ? toggleIn(requirementIds, r.id, true) : anyLeft ? requirementIds : toggleIn(requirementIds, r.id, false)
    onChange(nextReq, nextCrit)
  }
  return (
    <ul className="req-list">
      {requirements.map((r) => (
        <li key={r.id} className="req-item" data-testid={`requirement-${r.external_id}`}>
          <label className="req-head inline">
            <input type="checkbox" data-testid={`requirement-check-${r.external_id}`} checked={requirementIds.includes(r.id)} onChange={(e) => toggleRequirement(r, e.target.checked)} />
            <code>{r.external_id}</code> <strong>{r.title}</strong>
          </label>
          <Collapsible title={`수용조건 ${r.criteria.length}개 (선택 ${r.criteria.filter((c) => criterionIds.includes(c.id)).length})`}>
            <p className="req-body">{r.body}</p>
            <ul className="criteria">
              {r.criteria.map((c) => (
                <li key={c.id}>
                  <label className="inline">
                    <input type="checkbox" data-testid={`criterion-${c.id}`} checked={criterionIds.includes(c.id)} onChange={(e) => toggleCriterion(r, c.id, e.target.checked)} />
                    <Badge tone={c.kind === 'ui' ? 'blue' : 'gray'}>{c.kind === 'ui' ? 'UI' : '비UI'}</Badge> <code>{c.id}</code> {c.text}
                  </label>
                </li>
              ))}
            </ul>
          </Collapsible>
        </li>
      ))}
    </ul>
  )
}

function PromptPreviewView({ preview }: { preview: PromptPreviewResponse }) {
  const ctx = preview.context_summary.length > 0 ? preview.context_summary : preview.prompt.context_summary
  return (
    <div className="prompt-preview" data-testid="prompt-preview">
      <div className="muted small">템플릿 버전 {preview.prompt.template_version}</div>
      <Collapsible title={`문맥 목록 (${ctx.length})`} open>
        {ctx.length === 0 ? (
          <Empty>첨부된 문맥이 없습니다.</Empty>
        ) : (
          <ul className="context-list" data-testid="context-list">
            {ctx.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        )}
      </Collapsible>
      <Collapsible title="system 프롬프트">
        <pre className="prompt-text" data-testid="prompt-system">
          {preview.prompt.system}
        </pre>
      </Collapsible>
      <Collapsible title="user 프롬프트" open>
        <pre className="prompt-text" data-testid="prompt-user">
          {preview.prompt.user}
        </pre>
      </Collapsible>
    </div>
  )
}
