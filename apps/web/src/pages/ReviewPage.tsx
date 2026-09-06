/**
 * 화면 검토 — revision 선택, 격리 iframe(sandbox="allow-scripts") 미리보기 + CASE·PC/모바일 전환,
 * 요소 클릭(postMessage) → 코멘트, 코멘트 목록·상태 변경, 검증 결과 표, 수정 요청(AI 프롬프트 초안 또는 직접 입력 → 단건 수정 실행).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api.js'
import { ArtifactStatusBadge, Badge, COMMENT_STATUS_LABELS, Collapsible, CommentStatusBadge, Empty, ErrorBox, Loading, ROLE_LABELS, ValidationStatusBadge, ValidationSummaryBadges, formatDateTime, shortHash } from '../components/common.js'
import { JobStatusPanel } from '../components/JobStatusPanel.js'
import { buildEditRequest } from '../generation-form.js'
import { navigate, useAsync, useJobPolling, useStoredValue } from '../hooks.js'
import { DEVICE_LABELS, DEVICE_WIDTHS, describeTarget, highlightMessage, parseElementClick, setCaseMessage, type ElementClick } from '../preview-messages.js'
import { ScreenContextHeader } from '../components/ScreenContextHeader.js'
import { hrefToScreen, withQuery, type Route } from '../router.js'
import { caseButtons, countOpenComments, summarizeValidation } from '../summary.js'
import type { Comment, CommentInput, CommentRole, CommentStatus, CommentTarget, Device, RevisionDetail, RevisionListItem, ScreenDetail, SliceCase, ValidationResult } from '../types.js'

const ROLES: CommentRole[] = ['planner', 'designer', 'publisher', 'developer', 'client']
const STATUSES: CommentStatus[] = ['open', 'resolved', 'wont_fix']

export function ReviewPage({ screenId, route }: { screenId: string; route: Route }) {
  const screen = useAsync(() => api.screen(screenId), [screenId])
  const revisions = screen.data?.revisions ?? []
  const requestedRev = route.query['rev']
  const selectedRevId = (requestedRev && revisions.some((r) => r.id === requestedRev) ? requestedRev : undefined) ?? screen.data?.screen.current_revision_id ?? revisions[revisions.length - 1]?.id ?? null
  const revision = useAsync(() => (selectedRevId ? api.revision(selectedRevId) : null), [selectedRevId])

  const jobId = route.query['job'] ?? null
  const poll = useJobPolling(jobId, () => screen.reload())

  if (screen.error) return <ErrorBox error={screen.error} title="화면을 읽지 못했습니다" />
  if (!screen.data) return <Loading text="화면을 불러오는 중…" />
  const s = screen.data.screen

  return (
    <div className="page page-wide">
      <ScreenContextHeader
        screen={s}
        current="review"
        revisionCount={revisions.length}
        {...(selectedRevId ? { revisionQuery: selectedRevId } : {})}
        actions={
          selectedRevId ? (
            <a className="btn btn-small btn-primary" data-testid="link-approve" href={hrefToScreen('approve', screenId, { rev: selectedRevId })}>
              완료·내보내기
            </a>
          ) : null
        }
      />
      <section className="card">
        <RevisionList revisions={revisions} selectedId={selectedRevId} route={route} />
      </section>

      {jobId && <JobStatusPanel jobId={jobId} job={poll.job} error={poll.error} polling={poll.polling} screenId={screenId} successLabel="새 revision 으로 이동" />}

      {revisions.length === 0 && (
        <Empty>
          아직 revision 이 없습니다. <a href={hrefToScreen('generate', screenId)}>생성 작업대</a>에서 먼저 생성하세요.
        </Empty>
      )}
      {revision.error ? <ErrorBox error={revision.error} title="revision 을 읽지 못했습니다" /> : null}
      {selectedRevId && !revision.data && !revision.error && <Loading text="revision 을 불러오는 중…" />}
      {revision.data && <RevisionWorkbench key={revision.data.revision.id} screen={screen.data} detail={revision.data} route={route} onChanged={() => { revision.reload(); screen.reload() }} />}
    </div>
  )
}

function RevisionList({ revisions, selectedId, route }: { revisions: RevisionListItem[]; selectedId: string | null; route: Route }) {
  if (revisions.length === 0) return null
  return (
    <div className="table-wrap">
      <table className="table compact">
        <thead>
          <tr>
            <th>선택</th>
            <th className="num">번호</th>
            <th>생성 시각</th>
            <th>artifact 상태</th>
            <th>검증 요약</th>
            <th className="num">열린 코멘트</th>
            <th>artifact hash</th>
          </tr>
        </thead>
        <tbody>
          {[...revisions].sort((a, b) => b.revision_no - a.revision_no).map((r) => (
            <tr key={r.id} className={r.id === selectedId ? 'selected-row' : ''} data-testid="revision-row" data-revision-no={r.revision_no} data-revision-id={r.id} data-selected={r.id === selectedId}>
              <td>
                <input type="radio" name="revision" data-testid="revision-select" aria-label={`revision ${r.revision_no} 선택`} checked={r.id === selectedId} onChange={() => navigate(withQuery(route, { rev: r.id }))} />
              </td>
              <td className="num">#{r.revision_no}</td>
              <td>{formatDateTime(r.created_at)}</td>
              <td>
                <ArtifactStatusBadge status={r.artifact_status} />
              </td>
              <td>
                <ValidationSummaryBadges summary={r.validation_summary} />
              </td>
              <td className="num">{r.open_comments}</td>
              <td>
                <code title={r.artifact_hash}>{shortHash(r.artifact_hash)}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RevisionWorkbench({ screen, detail, route, onChanged }: { screen: ScreenDetail; detail: RevisionDetail; route: Route; onChanged: () => void }) {
  const { revision, spec, artifact, validation_results, comments } = detail
  const screenId = screen.screen.id
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [device, setDevice] = useState<Device>(screen.screen.device)
  const [caseId, setCaseId] = useState<string>(() => spec.states?.[0]?.id ?? '')
  const [click, setClick] = useState<ElementClick | null>(null)
  const [selectedCommentIds, setSelectedCommentIds] = useState<string[]>([])
  const cases = useMemo(() => caseButtons(spec), [spec])

  const post = useCallback((msg: unknown) => {
    iframeRef.current?.contentWindow?.postMessage(msg, '*')
  }, [])

  const selectCase = (id: string) => {
    setCaseId(id)
    post(setCaseMessage(id))
  }

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return
      const parsed = parseElementClick(event.data)
      if (!parsed) return
      setClick(parsed)
      if (parsed.case_id) setCaseId(parsed.case_id)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const summary = summarizeValidation(validation_results.filter((r) => r.artifact_hash === artifact.content_hash))
  const foreign = validation_results.length - validation_results.filter((r) => r.artifact_hash === artifact.content_hash).length

  return (
    <>
      <div className="muted small revision-meta">
        revision #{revision.revision_no} · <code>{revision.id}</code> · artifact <code>{artifact.id}</code> <ArtifactStatusBadge status={artifact.status} /> · hash <code title={artifact.content_hash}>{shortHash(artifact.content_hash)}</code> · 작업 <code>{revision.job_id}</code>
        {revision.based_on_revision_id && (
          <>
            {' '}
            · 기준 revision <code>{revision.based_on_revision_id}</code>
          </>
        )}
        {artifact.status === 'stale' && artifact.stale_reason && <span className="warn"> · stale 사유: {artifact.stale_reason}</span>}
      </div>
      {revision.change_summary && (
        <Collapsible title="변경 요약">
          <pre className="prompt-text">{typeof revision.change_summary === 'string' ? revision.change_summary : JSON.stringify(revision.change_summary, null, 2)}</pre>
        </Collapsible>
      )}
      {spec.unresolved && spec.unresolved.length > 0 && (
        <Collapsible title={`미확정 항목 ${spec.unresolved.length} (질문·가정·충돌)`}>
          <ul>
            {spec.unresolved.map((u, i) => (
              <li key={i}>
                <Badge tone="amber">{u.kind}</Badge> {u.text}
              </li>
            ))}
          </ul>
        </Collapsible>
      )}

      <div className="review-layout">
        <section className="card preview-card">
          <div className="preview-toolbar">
            <div className="case-buttons" role="group" aria-label="CASE 전환">
              {cases.length === 0 && <span className="muted small">CASE 정보 없음</span>}
              {cases.map((c) => (
                <button key={c.id} type="button" data-testid={`case-button-${c.id}`} className={`btn btn-small${c.id === caseId ? ' active' : ''}`} onClick={() => selectCase(c.id)}>
                  {c.label}
                </button>
              ))}
            </div>
            <div className="device-toggle" role="group" aria-label="기기 폭">
              {(['desktop', 'mobile'] as Device[]).map((d) => (
                <button key={d} type="button" data-testid={`device-${d}`} className={`btn btn-small${d === device ? ' active' : ''}`} onClick={() => setDevice(d)}>
                  {DEVICE_LABELS[d]} {DEVICE_WIDTHS[d]}px
                </button>
              ))}
              <a className="btn btn-small" href={api.artifactHtmlUrl(artifact.id)} target="_blank" rel="noreferrer noopener">
                새 창에서 열기
              </a>
            </div>
          </div>
          <div className="iframe-wrap">
            <iframe
              key={artifact.id}
              ref={iframeRef}
              data-testid="preview-iframe"
              title={`화면 미리보기 ${screen.screen.external_id} revision ${revision.revision_no}`}
              sandbox="allow-scripts"
              src={api.artifactHtmlUrl(artifact.id)}
              style={{ width: DEVICE_WIDTHS[device] }}
              onLoad={() => {
                if (caseId) post(setCaseMessage(caseId))
              }}
            />
          </div>
          <div className="muted small">격리 iframe(sandbox="allow-scripts", 같은 출처 아님). 화면이나 우측 설명의 요소를 클릭하면 오른쪽 코멘트 폼에 대상이 채워집니다.</div>
        </section>

        <aside className="review-side">
          <CommentForm revisionId={revision.id} click={click} caseId={caseId} onClear={() => setClick(null)} onCreated={onChanged} />
          <CommentList
            comments={comments}
            selectedIds={selectedCommentIds}
            onToggle={(id, on) => setSelectedCommentIds((ids) => (on ? [...ids, id] : ids.filter((x) => x !== id)))}
            onHighlight={(c) => {
              if (c.element_id) post(highlightMessage(c.element_id))
              if (c.case_id) selectCase(c.case_id)
            }}
            onChanged={onChanged}
          />
        </aside>
      </div>

      <section className="card">
        <div className="card-head">
          <h3>검증 결과</h3>
          <span className="actions">
            <ValidationSummaryBadges summary={summary} />
            <RevalidateButton artifactId={artifact.id} onDone={onChanged} />
          </span>
        </div>
        {foreign > 0 && <div className="notice notice-amber">검증 결과 {foreign}건은 다른 artifact hash 의 것이라 요약에서 제외했습니다.</div>}
        {validation_results.some((r) => r.stage === 'V3' && r.status === 'not_run') && (
          <div className="notice" data-testid="v3-not-run-note">
            V3(실행 검사)가 <strong>미실행(not_run)</strong> 인 것은 정상입니다 — 브라우저에서는 Playwright 로 화면을 실제로 띄워 볼 수 없습니다. 미실행은 통과가 아니므로 완료(v1.0) 승인은 막히며, 실행 검사는 서버 실행(<code>pnpm serve</code>)에서 동작합니다.
          </div>
        )}
        <ValidationTable results={validation_results} artifactHash={artifact.content_hash} />
      </section>

      <EditRequestPanel screen={screen} detail={detail} route={route} selectedCommentIds={selectedCommentIds} />
    </>
  )
}

function CommentForm({ revisionId, click, caseId, onClear, onCreated }: { revisionId: string; click: ElementClick | null; caseId: string; onClear: () => void; onCreated: () => void }) {
  const [author, setAuthor] = useStoredValue('con-ai.author', '')
  const [role, setRole] = useStoredValue('con-ai.role', 'planner')
  const [target, setTarget] = useState<CommentTarget>('screen')
  const [elementId, setElementId] = useState('')
  const [sectionId, setSectionId] = useState('')
  const [displayNo, setDisplayNo] = useState('')
  const [caseField, setCaseField] = useState(caseId)
  const [text, setText] = useState('')
  const [blocking, setBlocking] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!click) return
    setTarget(click.target)
    setElementId(click.element_id)
    setSectionId(click.section_id)
    setDisplayNo(click.display_no)
    setCaseField(click.case_id || caseId)
  }, [click, caseId])
  useEffect(() => {
    if (!click) setCaseField(caseId)
  }, [caseId, click])

  const submit = async () => {
    if (!author.trim() || !text.trim()) {
      setError(new Error('작성자와 내용을 입력하세요.'))
      return
    }
    const input: CommentInput = { target, author: author.trim(), role: (ROLES.includes(role as CommentRole) ? role : 'planner') as CommentRole, text: text.trim(), blocking }
    if (elementId.trim()) input.element_id = elementId.trim()
    if (sectionId.trim()) input.section_id = sectionId.trim()
    if (caseField.trim()) input.case_id = caseField.trim()
    if (displayNo.trim()) input.display_no = displayNo.trim()
    setSaving(true)
    setError(null)
    try {
      await api.createComment(revisionId, input)
      setText('')
      setBlocking(false)
      onClear()
      onCreated()
    } catch (e) {
      setError(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="card">
      <div className="card-head">
        <h3>코멘트 작성</h3>
        <span className="muted small">{describeTarget(click ?? { target, element_id: elementId, section_id: sectionId, display_no: displayNo, case_id: caseField })}</span>
      </div>
      <div className="form-grid compact">
        <label>
          대상
          <select data-testid="comment-target" value={target} onChange={(e) => setTarget(e.target.value as CommentTarget)}>
            <option value="screen">화면</option>
            <option value="description">설명</option>
          </select>
        </label>
        <label>
          CASE
          <input type="text" data-testid="comment-case-id" value={caseField} onChange={(e) => setCaseField(e.target.value)} />
        </label>
        <label>
          영역 id
          <input type="text" data-testid="comment-section-id" value={sectionId} onChange={(e) => setSectionId(e.target.value)} />
        </label>
        <label>
          요소 id
          <input type="text" data-testid="comment-element-id" value={elementId} onChange={(e) => setElementId(e.target.value)} />
        </label>
        <label>
          번호
          <input type="text" data-testid="comment-display-no" value={displayNo} onChange={(e) => setDisplayNo(e.target.value)} />
        </label>
        <label>
          역할
          <select data-testid="comment-role" value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        <label>
          작성자
          <input type="text" data-testid="comment-author" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="이름" />
        </label>
        <label className="inline self-end">
          <input type="checkbox" data-testid="comment-blocking" checked={blocking} onChange={(e) => setBlocking(e.target.checked)} /> 차단 (해결 전 완료 불가)
        </label>
        <label className="span-2">
          내용
          <textarea rows={3} data-testid="comment-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="무엇을 어떻게 바꿔야 하는지" />
        </label>
      </div>
      {error ? <ErrorBox error={error} title="코멘트를 저장하지 못했습니다" /> : null}
      <div className="button-row">
        <button type="button" className="btn" onClick={onClear} disabled={!click}>
          대상 지우기
        </button>
        <button type="button" className="btn btn-primary" data-testid="comment-save" onClick={() => void submit()} disabled={saving}>
          {saving ? '저장 중…' : '코멘트 저장'}
        </button>
      </div>
    </section>
  )
}

function CommentList({ comments, selectedIds, onToggle, onHighlight, onChanged }: { comments: Comment[]; selectedIds: string[]; onToggle: (id: string, on: boolean) => void; onHighlight: (c: Comment) => void; onChanged: () => void }) {
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const changeStatus = async (c: Comment, status: CommentStatus) => {
    if (status === c.status) return
    setBusy(c.id)
    setError(null)
    try {
      await api.patchComment(c.id, { status, revision: c.revision ?? 1 })
      onChanged()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(null)
    }
  }
  const sorted = [...comments].sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || b.created_at.localeCompare(a.created_at))
  return (
    <section className="card">
      <div className="card-head">
        <h3>코멘트</h3>
        <span className="muted small">
          열림 {countOpenComments(comments)} / 전체 {comments.length} · 체크한 코멘트는 아래 "수정 요청" 에 쓰입니다
        </span>
      </div>
      {error ? <ErrorBox error={error} title="코멘트 상태를 바꾸지 못했습니다" /> : null}
      {comments.length === 0 && <Empty>코멘트가 없습니다. 미리보기의 요소를 클릭해 첫 코멘트를 남기세요.</Empty>}
      <ul className="comment-list">
        {sorted.map((c) => (
          <li key={c.id} className={`comment ${c.status}`} data-testid="comment-item" data-comment-id={c.id} data-status={c.status}>
            <div className="comment-head">
              <label className="inline">
                <input type="checkbox" data-testid="comment-select" checked={selectedIds.includes(c.id)} onChange={(e) => onToggle(c.id, e.target.checked)} aria-label="수정 요청에 포함" />
              </label>
              <Badge tone="blue">{ROLE_LABELS[c.role] ?? c.role}</Badge>
              <strong>{c.author}</strong>
              <CommentStatusBadge status={c.status} />
              {c.blocking && <Badge tone="red">차단</Badge>}
              <span className="muted small">{formatDateTime(c.created_at)}</span>
            </div>
            <div className="comment-target">
              <button type="button" className="link" onClick={() => onHighlight(c)} title="미리보기에서 강조">
                {describeTarget({ target: c.target, element_id: c.element_id ?? '', section_id: c.section_id ?? '', display_no: c.display_no ?? '', case_id: c.case_id ?? '' })}
              </button>
            </div>
            <div className="comment-text">{c.text}</div>
            <div className="comment-foot">
              {c.resolved_by_revision_id && (
                <span className="muted small">
                  해결 revision <code>{c.resolved_by_revision_id}</code>
                </span>
              )}
              <label className="inline">
                상태
                <select data-testid="comment-status" value={c.status} disabled={busy === c.id} onChange={(e) => void changeStatus(c, e.target.value as CommentStatus)}>
                  {STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {COMMENT_STATUS_LABELS[st]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function RevalidateButton({ artifactId, onDone }: { artifactId: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.revalidate(artifactId)
      onDone()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <button type="button" className="btn btn-small" onClick={() => void run()} disabled={busy}>
        {busy ? '재검증 중…' : '재검증 실행'}
      </button>
      {error ? <ErrorBox error={error} title="재검증 실패" /> : null}
    </>
  )
}

function ValidationTable({ results, artifactHash }: { results: ValidationResult[]; artifactHash: string }) {
  if (results.length === 0) return <Empty>검증 결과가 없습니다 — 실행하지 않은 검사는 통과가 아닙니다.</Empty>
  return (
    <div className="table-wrap">
      <table className="table compact">
        <thead>
          <tr>
            <th>check_id</th>
            <th>단계</th>
            <th>결과</th>
            <th>필수</th>
            <th>메시지</th>
            <th>근거</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.id} className={r.artifact_hash !== artifactHash ? 'muted' : ''} data-testid="validation-row" data-check-id={r.check_id} data-status={r.status} data-required={r.required}>
              <td>
                <code>{r.check_id}</code>
                {r.artifact_hash !== artifactHash && <span className="small warn"> (다른 hash)</span>}
              </td>
              <td>{r.stage}</td>
              <td>
                <ValidationStatusBadge status={r.status} />
              </td>
              <td>{r.required ? '필수' : '선택'}</td>
              <td>{r.message ?? ''}</td>
              <td>
                {r.evidence.length === 0 ? (
                  <span className="muted">—</span>
                ) : (
                  <details>
                    <summary>{r.evidence.length}건</summary>
                    <ul className="evidence">
                      {r.evidence.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EditRequestPanel({ screen, detail, route, selectedCommentIds }: { screen: ScreenDetail; detail: RevisionDetail; route: Route; selectedCommentIds: string[] }) {
  const [prompt, setPrompt] = useState('')
  const [rationale, setRationale] = useState<string | null>(null)
  const [draftAdapter, setDraftAdapter] = useState<string | null>(null)
  const [draftError, setDraftError] = useState<unknown>(null)
  const [drafting, setDrafting] = useState(false)
  const [runError, setRunError] = useState<unknown>(null)
  const [running, setRunning] = useState(false)

  const draft = async () => {
    setDrafting(true)
    setDraftError(null)
    try {
      const d = await api.revisionPrompt(detail.revision.id, selectedCommentIds)
      setPrompt(d.prompt)
      setRationale(d.rationale)
      setDraftAdapter(d.adapter)
    } catch (e) {
      setDraftError(e)
    } finally {
      setDrafting(false)
    }
  }

  const run = async () => {
    if (!prompt.trim()) {
      setRunError(new Error('수정 프롬프트가 비어 있습니다. AI 초안을 만들거나 직접 입력하세요.'))
      return
    }
    setRunning(true)
    setRunError(null)
    try {
      const spec = detail.spec
      const cases = (spec.states ?? []).map((st) => st.case_kind).filter((k): k is SliceCase => k !== undefined)
      const req = buildEditRequest({
        screen_id: screen.screen.id,
        base_revision_id: detail.revision.id,
        comment_ids: selectedCommentIds,
        prompt,
        device: screen.screen.device,
        cases,
        roles: spec.roles ?? [],
        criterion_ids: (spec.requirements ?? []).flatMap((r) => r.criterion_ids),
      })
      const { job_id } = await api.createJob(screen.screen.id, req)
      navigate(withQuery(route, { job: job_id }), { replace: true })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setRunError(e)
    } finally {
      setRunning(false)
    }
  }

  return (
    <section className="card">
      <div className="card-head">
        <h3>수정 요청 (단건 수정)</h3>
        <span className="muted small">
          기준 revision #{detail.revision.revision_no} · 선택한 코멘트 {selectedCommentIds.length}건
        </span>
      </div>
      <div className="button-row">
        <button type="button" className="btn" data-testid="draft-button" onClick={() => void draft()} disabled={drafting || selectedCommentIds.length === 0} title={selectedCommentIds.length === 0 ? '코멘트를 먼저 체크하세요' : ''}>
          {drafting ? 'AI 초안 생성 중…' : 'AI 수정 프롬프트 생성'}
        </button>
        <span className="muted small">또는 아래에 직접 입력</span>
      </div>
      {draftError ? <ErrorBox error={draftError} title="AI 수정 프롬프트 생성 실패" /> : null}
      {rationale !== null && (
        <div className="notice" data-testid="draft-rationale">
          <strong>AI 초안 근거{draftAdapter ? ` (${draftAdapter === 'fixture' ? '더미 어댑터' : draftAdapter})` : ''}</strong>
          <div>{rationale}</div>
        </div>
      )}
      <textarea rows={8} data-testid="edit-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="수정 프롬프트 — 편집한 뒤 실행하면 prompt_override 로 보냅니다" />
      {runError ? <ErrorBox error={runError} title="단건 수정 실행 요청 실패" /> : null}
      <div className="button-row">
        <button type="button" className="btn btn-primary" data-testid="run-edit-button" onClick={() => void run()} disabled={running}>
          {running ? '요청 중…' : '단건 수정 실행'}
        </button>
      </div>
    </section>
  )
}
