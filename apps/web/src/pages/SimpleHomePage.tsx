/**
 * 만들기 (`#/new`) — 문장 하나 + 버튼 하나로 화면설계서 HTML 을 만든다. 메인(`#/`)의 «설계서 만들기» 가 여기로 온다.
 *
 * 여기서는 기술 용어를 쓰지 않는다(revision → 버전, 작업 ID·단계 이름·CASE·검증은 숨긴다).
 * 자동으로 채운 값은 simple-flow.ts 가 정하고, 근거는 "무엇을 자동으로 채웠나" 로 펼쳐 볼 수 있게 남긴다.
 */
import { useState } from 'react'
import { api } from '../api.js'
import { credentialStore } from '../browser-run/credential.js'
import { ErrorBox } from '../components/common.js'
import { IS_DEMO } from '../demo-mode.js'
import { CREDENTIAL_EVENT, navigate, useAsync, useCredentialTick, useJobPolling } from '../hooks.js'
import { isTerminalJob } from '../job-progress.js'
import { hrefToDesign, withQuery, type Route } from '../router.js'
import { autoReferenceIds, buildSimpleCreateRequest, deriveShell, deriveTitle, failureLine, progressLine, recentDesigns } from '../simple-flow.js'
import type { Device, Meta, Project, ScreenCreateInput } from '../types.js'

const PLACEHOLDER = `파트너가 견적 요청 목록을 조회하고 상태별로 검색하는 화면.
목록에서 상세로 이동하고 엑셀 다운로드 버튼이 있다.`

/** 값 모양으로 자격 증명 종류를 짐작한다 (sk-ant-… 는 API 키, 나머지는 토큰). */
export function guessCredentialKind(value: string): 'api_key' | 'token' {
  return value.trim().startsWith('sk-ant-') ? 'api_key' : 'token'
}

export function SimpleHomePage({ project, meta, route }: { project: Project; meta: Meta | null; route: Route }) {
  const credentialTick = useCredentialTick()
  const detail = useAsync(() => api.project(project.id), [project.id, credentialTick])
  const references = useAsync(() => api.references(project.id), [project.id])

  const [sentence, setSentence] = useState('')
  const [device, setDevice] = useState<Device>('desktop')
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [askCredential, setAskCredential] = useState(false)

  // 작업 id 는 주소에 남긴다 — 새로고침해도 진행 상태를 다시 읽는다.
  const jobId = route.query['job'] ?? null
  const poll = useJobPolling(jobId, (job) => {
    if (job.status === 'succeeded' && job.result) navigate(hrefToDesign(job.result.revision_id, { created: '1' }))
  })
  const running = starting || (jobId !== null && (poll.job === null || !isTerminalJob(poll.job.status)))
  const failed = poll.job?.status === 'failed' || poll.job?.status === 'cancelled'

  const credential = credentialStore.describe()
  // 자격 증명은 «더 좋은 결과» 를 위한 선택이지 필수가 아니다 — 없으면 더미 어댑터(fixture)로 실제로 만든다.

  const start = async () => {
    const text = sentence.trim()
    if (text.length === 0) {
      setError(new Error('무엇을 만들지 한 줄로 적어주세요.'))
      return
    }
    setStarting(true)
    setError(null)
    try {
      const refs = references.data ?? []
      const screens = detail.data?.screens ?? []
      const sampleFrom = autoReferenceIds(text, refs)[0]
      const body: ScreenCreateInput = { title: deriveTitle(text), device, shell: deriveShell(text, screens) }
      if (sampleFrom !== undefined) body.sample_from = sampleFrom
      const { screen } = await api.createScreen(project.id, body)
      const { request } = buildSimpleCreateRequest({ screen_id: screen.id, sentence: text, device, references: refs })
      const { job_id } = await api.createJob(screen.id, request)
      navigate(withQuery(route, { job: job_id, screen: screen.id }), { replace: true })
    } catch (e) {
      setError(e)
    } finally {
      setStarting(false)
    }
  }

  const retry = () => {
    navigate(withQuery(route, { job: '', screen: '' }), { replace: true })
    setError(null)
  }

  const recent = recentDesigns(detail.data)
  const preview = sentence.trim().length > 0 ? buildSimpleCreateRequest({ screen_id: '', sentence, device, references: references.data ?? [] }) : null

  return (
    <div className="simple-page">
      <section className="simple-hero">
        <span className="simple-kicker">② 생성 · 새 설계서</span>
        <h1>어떤 화면을 만들까요?</h1>
        <p className="simple-sub">기획자의 말로 한 문단만 쓰면 됩니다. 요구사항·IA·참고 화면은 프로젝트에서 자동으로 붙습니다.</p>

        {/* 입력창과 실행 줄은 한 상자다 — 「무엇을 자동으로 채우는지」가 버튼 바로 옆에 보인다. */}
        <div className="simple-box">
          <textarea
            className="simple-input"
            data-testid="simple-input"
            rows={5}
            value={sentence}
            placeholder={PLACEHOLDER}
            aria-label="만들 화면 설명"
            disabled={running}
            onChange={(e) => setSentence(e.target.value)}
          />
          <div className="simple-boxfoot">
            <span className="simple-auto-chips">
              <span className="simple-auto-label">자동</span>
              {preview ? (
                <>
                  <span className="simple-auto-chip">
                    <span>제목</span>
                    {deriveTitle(sentence)}
                  </span>
                  <span className="simple-auto-chip">
                    <span>형태</span>
                    {deriveShell(sentence, detail.data?.screens ?? [])}
                  </span>
                  <span className="simple-auto-chip">
                    <span>참고</span>
                    {autoReferenceIds(sentence, references.data ?? []).length}건
                  </span>
                </>
              ) : (
                <span className="simple-auto-empty">문장을 쓰면 제목·형태·참고 화면을 여기서 정합니다</span>
              )}
            </span>
            <span className="simple-boxfoot-right">
              <span className="device-toggle" role="group" aria-label="기기">
                <button type="button" className={`btn btn-small${device === 'desktop' ? ' active' : ''}`} data-testid="simple-device-desktop" onClick={() => setDevice('desktop')}>
                  PC
                </button>
                <button type="button" className={`btn btn-small${device === 'mobile' ? ' active' : ''}`} data-testid="simple-device-mobile" onClick={() => setDevice('mobile')}>
                  모바일
                </button>
              </span>
              <button type="button" className="btn btn-primary btn-big" data-testid="simple-create" onClick={() => void start()} disabled={running}>
                {running ? '만드는 중…' : '설계서 만들기'}
              </button>
            </span>
          </div>
        </div>

        {IS_DEMO && !askCredential && (
          <button type="button" className="simple-credlink" data-testid="simple-credential-toggle" onClick={() => setAskCredential(true)}>
            {credential ? `내 토큰 ····${credential.last4} — 바꾸기` : 'Claude 토큰 넣기 (선택) — 넣으면 모델이 직접 씁니다'}
          </button>
        )}
        {askCredential && (
          <CredentialInline
            onSaved={() => {
              setAskCredential(false)
              void start()
            }}
            onCancel={() => setAskCredential(false)}
          />
        )}

        {running && (
          <div className="simple-progress" role="status" aria-live="polite" data-testid="simple-progress">
            <span className="spinner" aria-hidden="true" />
            {progressLine({ status: poll.job?.status ?? 'queued', stage: poll.job?.current_stage ?? poll.job?.stage })}
          </div>
        )}
        {failed && (
          <div className="simple-failure" role="alert" data-testid="simple-error">
            <span>{poll.job?.status === 'cancelled' ? '작업이 취소되었습니다. 새 설계서는 만들어지지 않았습니다.' : failureLine(poll.job?.failure)}</span>
            <button type="button" className="btn btn-small" data-testid="simple-retry" onClick={retry}>
              다시 시도
            </button>
          </div>
        )}
        {error ? <ErrorBox error={error} title="설계서를 만들지 못했습니다" testId="simple-error-box" /> : null}
        {preview && !running && (
          <details className="simple-auto">
            <summary>무엇을 자동으로 채웠나</summary>
            <ul>
              {preview.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="simple-recent">
        <h2>최근 만든 설계서</h2>
        {detail.error ? <ErrorBox error={detail.error} title="최근 목록을 읽지 못했습니다" /> : null}
        {recent.length === 0 ? (
          <p className="muted">아직 만든 설계서가 없습니다. 위에 한 줄 쓰고 «설계서 만들기» 를 눌러보세요.</p>
        ) : (
          <div className="simple-cards">
            {recent.map((d) => (
              <a key={d.revision_id} className="simple-card" data-testid="simple-recent-card" data-external-id={d.external_id} href={hrefToDesign(d.revision_id)}>
                <strong>{d.title}</strong>
                <span className="muted small">{d.external_id}</span>
                <span className="simple-card-foot">
                  v{d.versions}
                  {d.status === 'approved' ? ' · 완료' : ''}
                </span>
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

/** 그 자리에서 여는 자격 증명 입력 — 저장하면 바로 생성이 이어진다. 값은 이 브라우저에만 둔다. */
function CredentialInline({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [value, setValue] = useState('')
  const [persist, setPersist] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = () => {
    try {
      credentialStore.save(guessCredentialKind(value), value, persist)
      window.dispatchEvent(new Event(CREDENTIAL_EVENT))
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="simple-cred" data-testid="simple-credential">
      <label htmlFor="simple-cred-value">Claude 토큰을 넣어주세요 — 이 브라우저에만 저장되고 api.anthropic.com 으로만 보냅니다.</label>
      <div className="simple-cred-row">
        <input
          id="simple-cred-value"
          type="password"
          data-testid="simple-credential-value"
          value={value}
          autoComplete="off"
          spellCheck={false}
          placeholder="토큰 또는 sk-ant-…"
          onChange={(e) => setValue(e.target.value)}
        />
        <label className="inline">
          <input type="checkbox" data-testid="simple-credential-persist" checked={persist} onChange={(e) => setPersist(e.target.checked)} /> 이 브라우저에 저장
        </label>
        <button type="button" className="btn btn-primary btn-small" data-testid="simple-credential-save" onClick={save} disabled={value.trim().length === 0}>
          저장하고 만들기
        </button>
        <button type="button" className="btn btn-small" onClick={onCancel}>
          취소
        </button>
      </div>
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
    </div>
  )
}
