/**
 * 설계서 결과 (`#/d/:revisionId`) — 만든 HTML 을 크게 보여주고, 한 줄로 고치고, 파일로 내려받는다.
 *
 * 기술 용어는 쓰지 않는다: revision → "버전", artifact·명세·CASE·검증은 «자세히»(기존 검토 화면)에만 둔다.
 */
import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { ErrorBox, Loading } from '../components/common.js'
import { navigate, useAsync, useJobPolling } from '../hooks.js'
import { isTerminalJob } from '../job-progress.js'
import { hrefTo, hrefToDesign, hrefToScreen, withQuery, type Route } from '../router.js'
import { buildSimpleEditRequest, failureLine, progressLine } from '../simple-flow.js'
import type { Device } from '../types.js'

export function DesignPage({ revisionId, route }: { revisionId: string; route: Route }) {
  const revision = useAsync(() => api.revision(revisionId), [revisionId])
  const screenId = revision.data?.revision.screen_id ?? null
  const screen = useAsync(() => (screenId ? api.screen(screenId) : null), [screenId])

  const [instruction, setInstruction] = useState('')
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<unknown>(null)
  // 미리보기 폭 — 화면의 기본 기기를 따라가되 여기서 바꿔 볼 수 있다.
  const [previewOverride, setPreviewOverride] = useState<Device | null>(null)
  // 「방금 만들어졌다」는 만들기 화면이 붙여 주는 표시다. 없으면 적지 않는다.
  const created = route.query['created'] === '1'

  const jobId = route.query['job'] ?? null
  const poll = useJobPolling(jobId, (job) => {
    if (job.status === 'succeeded' && job.result) navigate(hrefToDesign(job.result.revision_id))
  })
  const running = starting || (jobId !== null && (poll.job === null || !isTerminalJob(poll.job.status)))
  const failed = poll.job?.status === 'failed' || poll.job?.status === 'cancelled'

  if (revision.error) return <ErrorBox error={revision.error} title="설계서를 읽지 못했습니다" />
  if (!revision.data) return <Loading text="설계서를 불러오는 중…" />

  const detail = revision.data
  const versions = screen.data?.revisions ?? []
  const current = versions.find((r) => r.id === revisionId)
  const versionNo = current?.revision_no ?? detail.revision.revision_no
  const externalId = screen.data?.screen.external_id ?? detail.spec.screen_id ?? ''
  const device: Device = screen.data?.screen.device ?? (detail.spec.device === 'mobile' ? 'mobile' : 'desktop')
  const preview: Device = previewOverride ?? device
  const setPreview = (d: Device) => setPreviewOverride(d)

  const runEdit = async () => {
    const text = instruction.trim()
    if (text.length === 0) {
      setError(new Error('무엇을 바꿀지 한 줄로 적어주세요.'))
      return
    }
    if (!screenId) {
      setError(new Error('이 설계서의 화면 정보를 찾지 못했습니다.'))
      return
    }
    setStarting(true)
    setError(null)
    try {
      const req = buildSimpleEditRequest({ screen_id: screenId, base_revision_id: revisionId, instruction: text, device, spec: detail.spec })
      const { job_id } = await api.createJob(screenId, req)
      navigate(withQuery(route, { job: job_id }), { replace: true })
      setInstruction('')
    } catch (e) {
      setError(e)
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="design-page">
      <header className="design-top">
        <a className="design-back" data-testid="design-back" href={hrefTo('create')}>
          ← 새로 만들기
        </a>
        <TitleField screenId={screenId} title={screen.data?.screen.title ?? ''} onSaved={() => screen.reload()} />
        {externalId && <code className="design-extid">{externalId}</code>}
        <span className="design-versions" role="group" aria-label="버전">
          {versions.length <= 1 ? (
            <span className="chip" data-testid="design-version" data-version={versionNo} data-current="true">
              v{versionNo}
            </span>
          ) : (
            [...versions]
              .sort((a, b) => a.revision_no - b.revision_no)
              .map((r) => (
                <a
                  key={r.id}
                  className={`chip chip-link${r.id === revisionId ? ' chip-current' : ''}`}
                  data-testid="design-version"
                  data-version={r.revision_no}
                  data-current={r.id === revisionId}
                  href={hrefToDesign(r.id)}
                >
                  v{r.revision_no}
                </a>
              ))
          )}
        </span>
        <span className="design-top-right">
          {/* 미리보기 폭만 바꾼다 — 설계서 자체는 그대로다(다시 만들지 않는다). */}
          <span className="device-toggle" role="group" aria-label="미리보기 폭">
            <button type="button" className={`btn btn-small${preview === 'desktop' ? ' active' : ''}`} data-testid="design-preview-desktop" onClick={() => setPreview('desktop')}>
              PC
            </button>
            <button type="button" className={`btn btn-small${preview === 'mobile' ? ' active' : ''}`} data-testid="design-preview-mobile" onClick={() => setPreview('mobile')}>
              모바일
            </button>
          </span>
          <a className="btn btn-small" data-testid="design-download" href={api.artifactHtmlUrl(detail.artifact.id)} download={`${externalId || 'screen'}-v${versionNo}.html`}>
            HTML 다운로드
          </a>
          {screenId && (
            <a className="btn btn-small btn-primary" data-testid="design-detail" href={hrefToScreen('review', screenId, { rev: revisionId })}>
              자세히 →
            </a>
          )}
        </span>
      </header>

      {created && (
        <div className="design-created" role="status" data-testid="design-created">
          <span className="design-created-mark" aria-hidden="true">
            ✓
          </span>
          새 설계서가 만들어졌습니다 — v{versionNo}. 아래에서 한 줄로 고치면 새 버전이 쌓이고, 「자세히」에서 팀이 코멘트를 남길 수 있습니다.
        </div>
      )}

      <div className={`design-frame design-frame-${preview}`}>
        <iframe
          key={detail.artifact.id}
          data-testid="design-iframe"
          title={`화면설계서 ${externalId} v${versionNo}`}
          sandbox="allow-scripts"
          src={api.artifactHtmlUrl(detail.artifact.id)}
        />
      </div>

      <section className="design-edit">
        <label htmlFor="design-edit-input">이렇게 바꿔주세요</label>
        <input
          id="design-edit-input"
          type="text"
          data-testid="design-edit-input"
          value={instruction}
          disabled={running}
          placeholder="예: 검색 영역에 기간 선택을 넣고, 상태 열을 배지로 보여주세요"
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !running) void runEdit()
          }}
        />
        <button type="button" className="btn btn-primary" data-testid="design-edit-run" onClick={() => void runEdit()} disabled={running}>
          {running ? '고치는 중…' : '수정'}
        </button>
      </section>

      {running && (
        <div className="simple-progress" role="status" aria-live="polite" data-testid="design-progress">
          <span className="spinner" aria-hidden="true" />
          {progressLine({ status: poll.job?.status ?? 'queued', stage: poll.job?.current_stage ?? poll.job?.stage, verb: '설계서를 고치는 중입니다' })}
        </div>
      )}
      {failed && (
        <div className="simple-failure" role="alert" data-testid="design-error">
          <span>
            {poll.job?.status === 'cancelled' ? '수정이 취소되었습니다. 위 설계서는 이전 버전 그대로입니다.' : failureLine(poll.job?.failure)}
            {poll.job?.status === 'failed' ? ' (새 버전은 만들어지지 않았습니다 — 위 화면은 이전 버전입니다)' : ''}
          </span>
          <button
            type="button"
            className="btn btn-small"
            data-testid="design-retry"
            onClick={() => {
              navigate(withQuery(route, { job: '' }), { replace: true })
              setError(null)
            }}
          >
            다시 시도
          </button>
        </div>
      )}
      {error ? <ErrorBox error={error} title="수정하지 못했습니다" testId="design-error-box" /> : null}
      {screen.error ? <ErrorBox error={screen.error} title="화면 정보를 읽지 못했습니다" /> : null}
    </div>
  )
}

/** 제목만 고친다 (외부 ID 는 그대로 — 개명은 사유·별칭이 필요한 별도 작업이다). */
function TitleField({ screenId, title, onSaved }: { screenId: string | null; title: string; onSaved: () => void }) {
  const [value, setValue] = useState(title)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<unknown>(null)
  useEffect(() => setValue(title), [title])

  const save = async () => {
    const next = value.trim()
    if (!screenId || next.length === 0 || next === title) return
    setSaving(true)
    setError(null)
    try {
      await api.renameScreen(screenId, next)
      onSaved()
    } catch (e) {
      setError(e)
      setValue(title)
    } finally {
      setSaving(false)
    }
  }

  return (
    <span className="design-title">
      <input
        type="text"
        data-testid="design-title"
        aria-label="설계서 이름"
        value={value}
        disabled={saving || screenId === null}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => void save()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
      />
      {error ? <span className="warn small">이름을 저장하지 못했습니다</span> : null}
    </span>
  )
}
