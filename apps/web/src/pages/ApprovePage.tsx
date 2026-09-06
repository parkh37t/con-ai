/**
 * 완료·내보내기 — 승인 판정 사전 표시(검증 요약, 열린 차단 코멘트), 승인자 입력, "완료(v1.0)" →
 * 성공: 버전·내보내기 경로·파일 링크·index.html 열기·manifest design_handoff. 실패: 서버 reasons 목록.
 */
import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { BrowserExportPanel, browserRecordOf } from '../components/BrowserExportPanel.js'
import { ArtifactStatusBadge, Badge, Empty, ErrorBox, Loading, ValidationSummaryBadges, formatDateTime, shortHash } from '../components/common.js'
import { exportDirUrl, exportFileUrl, fileBasename } from '../export-paths.js'
import { useAsync, useStoredValue } from '../hooks.js'
import { ScreenContextHeader } from '../components/ScreenContextHeader.js'
import { hrefToScreen, type Route } from '../router.js'
import { approvalPrecheck } from '../summary.js'
import type { ApprovalResponse, ExportManifest, RevisionDetail, ScreenDetail } from '../types.js'

export function ApprovePage({ screenId, route }: { screenId: string; route: Route }) {
  const screen = useAsync(() => api.screen(screenId), [screenId])
  const revisions = screen.data?.revisions ?? []
  const requestedRev = route.query['rev']
  const selectedRevId = (requestedRev && revisions.some((r) => r.id === requestedRev) ? requestedRev : undefined) ?? screen.data?.screen.current_revision_id ?? revisions[revisions.length - 1]?.id ?? null
  const revision = useAsync(() => (selectedRevId ? api.revision(selectedRevId) : null), [selectedRevId])

  if (screen.error) return <ErrorBox error={screen.error} title="화면을 읽지 못했습니다" />
  if (!screen.data) return <Loading text="화면을 불러오는 중…" />
  const s = screen.data.screen

  return (
    <div className="page">
      <ScreenContextHeader
        screen={s}
        current="approve"
        revisionCount={revisions.length}
        {...(selectedRevId ? { revisionQuery: selectedRevId } : {})}
        actions={
          selectedRevId ? (
            <a className="btn btn-small" href={hrefToScreen('review', screenId, { rev: selectedRevId })}>
              검토 화면
            </a>
          ) : null
        }
      />
      {/* 알릴 것이 있을 때만 상자를 만든다 (빈 카드를 남기지 않는다) */}
      {s.status === 'approved' && s.version && (
        <div className="notice">
          이 화면은 이미 완료(v{s.version}) 상태입니다. 승인본은 제자리에서 고치지 않으며, 변경은 새 revision 으로 만듭니다.
        </div>
      )}
      {revisions.length === 0 && (
        <Empty>
          revision 이 없습니다. <a href={hrefToScreen('generate', screenId)}>생성 작업대</a>에서 먼저 생성하세요.
        </Empty>
      )}
      {revision.error ? <ErrorBox error={revision.error} title="revision 을 읽지 못했습니다" /> : null}
      {selectedRevId && !revision.data && !revision.error && <Loading text="revision 을 불러오는 중…" />}
      {revision.data && <ApprovalWorkbench key={revision.data.revision.id} screen={screen.data} detail={revision.data} onApproved={() => screen.reload()} />}
      {revision.data && <BrowserExportSection screen={screen.data} detail={revision.data} />}
    </div>
  )
}

/** 브라우저에서 만든 revision 일 때만 파일 다운로드 패널을 붙인다 (서버 내보내기 폴더 대체). */
function BrowserExportSection({ screen, detail }: { screen: ScreenDetail; detail: RevisionDetail }) {
  const isBrowser = browserRecordOf(detail.revision.id) !== null
  const project = useAsync(() => (isBrowser ? api.project(screen.screen.project_id) : null), [isBrowser, screen.screen.project_id])
  if (!isBrowser) return null
  return <BrowserExportPanel revisionId={detail.revision.id} project={project.data?.project ?? null} requirements={project.data?.requirements ?? []} comments={detail.comments} />
}

function ApprovalWorkbench({ screen, detail, onApproved }: { screen: ScreenDetail; detail: RevisionDetail; onApproved: () => void }) {
  const { revision, artifact, validation_results, comments } = detail
  const pre = approvalPrecheck({ artifact_status: artifact.status, artifact_hash: artifact.content_hash, validation_results, comments })
  const [approver, setApprover] = useStoredValue('con-ai.approver', '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [result, setResult] = useState<ApprovalResponse | null>(null)
  // 이미 완료된 화면이면 사전 판정을 «승인 불가» 로 읽히게 두지 않는다 — 완료됐다는 사실이 답이다.
  const approvedVersion = screen.screen.status === 'approved' ? screen.screen.version : undefined

  const approve = async () => {
    if (!approver.trim()) {
      setError(new Error('승인자를 입력하세요.'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const r = await api.approve(screen.screen.id, { revision_id: revision.id, approver: approver.trim() })
      setResult(r)
      onApproved()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <section className="card">
        <div className="card-head">
          <h3>{approvedVersion ? '완료된 산출물' : '승인 판정 사전 확인'}</h3>
          <span className="muted small">
            {approvedVersion ? '완료본은 제자리에서 고치지 않습니다. 변경은 새 revision 으로 만듭니다.' : '최종 판정은 서버(승인 게이트)가 합니다. 여기 표시는 미리 보는 이유입니다.'}
          </span>
        </div>
        <dl className="kv">
          <dt>대상 revision</dt>
          <dd>
            #{revision.revision_no} · <code>{revision.id}</code> · {formatDateTime(revision.created_at)}
          </dd>
          <dt>artifact</dt>
          <dd>
            <ArtifactStatusBadge status={artifact.status} /> hash <code title={artifact.content_hash}>{shortHash(artifact.content_hash, 16)}</code> · spec hash <code title={revision.spec_hash}>{shortHash(revision.spec_hash, 16)}</code>
          </dd>
          <dt>검증 요약</dt>
          <dd>
            <ValidationSummaryBadges summary={pre.summary} />
          </dd>
          <dt>열린 차단 코멘트</dt>
          <dd data-testid="open-blocking">{pre.open_blocking > 0 ? <Badge tone="red">{pre.open_blocking}건</Badge> : <Badge tone="green">0건</Badge>}</dd>
          <dt>{approvedVersion ? '완료 상태' : '사전 판정'}</dt>
          <dd data-testid="precheck">
            {approvedVersion ? (
              <Badge tone="green">완료됨 · v{approvedVersion}</Badge>
            ) : pre.ok ? (
              <Badge tone="green">승인 가능 (사전)</Badge>
            ) : (
              <Badge tone="red">승인 불가 사유 {pre.reasons.length}건</Badge>
            )}
          </dd>
        </dl>
        {!approvedVersion && pre.reasons.length > 0 && (
          <ul className="reason-list">
            {pre.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        )}
      </section>

      {/* 이미 완료된 화면에는 완료 폼을 두지 않는다 — 누를 수 없는 버튼이 「거부될 것」 이라고 말하면 화면이 스스로와 모순된다. */}
      {!result && !approvedVersion && (
        <section className="card">
          <h3>완료 처리</h3>
          <div className="form-grid">
            <label>
              승인자
              <input type="text" data-testid="approver" value={approver} onChange={(e) => setApprover(e.target.value)} placeholder="이름" />
            </label>
          </div>
          {error ? <ErrorBox error={error} title="완료 처리가 거부되었습니다" testId="approve-error" /> : null}
          <div className="button-row">
            <button type="button" className="btn btn-primary" data-testid="approve-button" onClick={() => void approve()} disabled={busy}>
              {busy ? '처리 중…' : '완료 (v1.0)'}
            </button>
            {!pre.ok && <span className="muted small">사전 판정에 사유가 있어 서버가 거부할 가능성이 큽니다. 거부되면 이유가 표시됩니다.</span>}
          </div>
        </section>
      )}

      {result && <ExportResult result={result} />}
    </>
  )
}

function ExportResult({ result }: { result: ApprovalResponse }) {
  const [manifest, setManifest] = useState<ExportManifest | null>(result.manifest ?? null)
  const [manifestError, setManifestError] = useState<unknown>(null)
  useEffect(() => {
    if (result.manifest) return
    let cancelled = false
    api.exportManifest(result.export_path).then(
      (m) => {
        if (!cancelled) setManifest(m)
      },
      (e: unknown) => {
        if (!cancelled) setManifestError(e)
      },
    )
    return () => {
      cancelled = true
    }
  }, [result])

  const indexUrl = exportFileUrl(result.export_path, 'index.html')
  const handoff = manifest?.design_handoff
  return (
    <section className="card success-card" data-testid="export-result">
      <div className="card-head">
        <h3>
          완료 — 버전 <Badge tone="green" testId="export-version">v{result.version}</Badge>
        </h3>
        <a className="btn btn-primary" data-testid="open-index" href={indexUrl} target="_blank" rel="noreferrer noopener">
          index.html 열기
        </a>
      </div>
      <dl className="kv">
        <dt>승인자 · 시각</dt>
        <dd>
          {result.approval.approved_by} · {formatDateTime(result.approval.approved_at)}
        </dd>
        <dt>승인 artifact hash</dt>
        <dd>
          <code>{result.approval.artifact_hash}</code>
        </dd>
        <dt>내보내기 경로</dt>
        <dd>
          <code data-testid="export-path">{result.export_path}</code> · <a href={exportDirUrl(result.export_path)} target="_blank" rel="noreferrer noopener">
            폴더 URL
          </a>
        </dd>
      </dl>
      <h4>파일 ({result.files.length})</h4>
      {result.files.length === 0 ? (
        <Empty>파일 목록이 비어 있습니다.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="table compact">
            <thead>
              <tr>
                <th>파일</th>
                <th>sha256</th>
              </tr>
            </thead>
            <tbody>
              {result.files.map((f) => (
                <tr key={f.path} data-testid="export-file" data-path={f.path}>
                  <td>
                    <a href={exportFileUrl(result.export_path, f.path)} target="_blank" rel="noreferrer noopener">
                      {fileBasename(f.path)}
                    </a>
                    <span className="muted small"> {f.path}</span>
                  </td>
                  <td>
                    <code title={f.sha256}>{shortHash(f.sha256, 16)}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h4>디자인 이관 (manifest.design_handoff)</h4>
      {manifestError ? <ErrorBox error={manifestError} title="manifest.json 을 읽지 못했습니다" /> : null}
      {!manifest && !manifestError && <Loading text="manifest.json 읽는 중…" />}
      {manifest && !handoff && <Empty>manifest 에 design_handoff 가 없습니다.</Empty>}
      {handoff && (
        <dl className="kv" data-testid="design-handoff">
          <dt>screen_revision_id</dt>
          <dd>
            <code data-testid="handoff-revision-id">{handoff.screen_revision_id}</code>
          </dd>
          <dt>design_input_spec_hash</dt>
          <dd>
            <code>{handoff.design_input_spec_hash}</code>
          </dd>
          <dt>잠긴 요소</dt>
          <dd>{handoff.locked_elements.length === 0 ? '없음' : handoff.locked_elements.map((e) => <code key={e}>{e} </code>)}</dd>
          <dt>잠긴 동작</dt>
          <dd>{handoff.locked_actions.length === 0 ? '없음' : handoff.locked_actions.map((a) => <code key={a}>{a} </code>)}</dd>
          <dt>디자인에서 바꿀 수 있는 토큰</dt>
          <dd>{handoff.allowed_tokens.join(', ')}</dd>
          {manifest?.validation_summary && (
            <>
              <dt>manifest 검증 요약</dt>
              <dd>
                <ValidationSummaryBadges summary={manifest.validation_summary} />
              </dd>
            </>
          )}
          {manifest?.adapter && (
            <>
              <dt>생성 어댑터</dt>
              <dd>
                {manifest.adapter}
                {manifest.model ? ` (${manifest.model})` : ''}
              </dd>
            </>
          )}
        </dl>
      )}
    </section>
  )
}
