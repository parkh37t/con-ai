/**
 * 브라우저 모드 내보내기 — 서버 폴더(`exports/…`)가 없으므로 산출물 6개 파일을 브라우저에서 만들어 내려받는다.
 * 승인 전인지 승인 뒤인지를 화면과 manifest 에 **같은 사실**로 적는다 — 승인된 산출물을 「아직 승인이 아니다」로,
 * 또는 그 반대로 적지 않는다.
 */
import { useState } from 'react'
import { BROWSER_EXPORT_APPROVED_NOTE, BROWSER_EXPORT_NOTE, buildExportBundle, downloadBundleFile, type BundleApproval, type BundleFile } from '../browser-run/export-bundle.js'
import { browserStore } from '../browser-run/store.js'
import type { Comment, Project, Requirement } from '../types.js'
import { Empty, ErrorBox, shortHash } from './common.js'

/** 이 revision 이 브라우저에서 생성된 것이면 기록을 돌려준다. */
export function browserRecordOf(revisionId: string) {
  return browserStore.load().revisions.find((r) => r.revision.id === revisionId) ?? null
}

/** 이 revision 이 이 브라우저에서 승인(v1.0)됐으면 그 기록. 없으면 null — 승인을 지어내지 않는다. */
export function browserApprovalOf(revisionId: string): BundleApproval | null {
  const found = Object.values(browserStore.load().approvals).find((a) => a.revision_id === revisionId)
  return found ? { version: found.version, approved_by: found.approved_by, approved_at: found.approved_at } : null
}

export function BrowserExportPanel({ revisionId, project, requirements, comments }: { revisionId: string; project: Project | null; requirements: Requirement[]; comments: Comment[] }) {
  const record = browserRecordOf(revisionId)
  const approval = browserApprovalOf(revisionId)
  const [files, setFiles] = useState<BundleFile[] | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  if (!record) return null

  const build = async () => {
    setBusy(true)
    setError(null)
    try {
      const projectRecord = (project ?? {}) as unknown as Record<string, unknown>
      setFiles(
        await buildExportBundle({
          record,
          project: {
            id: project?.id ?? record.project_id,
            name: project?.name ?? '(프로젝트 미상)',
            slug: typeof projectRecord['slug'] === 'string' ? (projectRecord['slug'] as string) : undefined,
          },
          requirements,
          comments,
          generated_at: new Date().toISOString(),
          ...(approval ? { approval } : {}),
        }),
      )
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  const prefix = `${record.screen_external_id}-r${record.revision.revision_no}-`
  return (
    <section className="card" data-testid="browser-export">
      <div className="card-head">
        <h3>{approval ? `산출물 파일 내려받기 (v${approval.version})` : '산출물 파일 내려받기 (브라우저 모드)'}</h3>
        <span className="muted small">
          revision #{record.revision.revision_no} · artifact <code>{shortHash(record.artifact.content_hash, 12)}</code>
        </span>
      </div>
      <p className="notice" data-testid="browser-export-note">{approval ? BROWSER_EXPORT_APPROVED_NOTE : BROWSER_EXPORT_NOTE}</p>
      <div className="button-row">
        <button type="button" className="btn btn-primary" data-testid="browser-export-build" onClick={() => void build()} disabled={busy}>
          {busy ? '만드는 중…' : files ? '다시 만들기' : '파일 만들기 (6개)'}
        </button>
        {files && (
          <button type="button" className="btn" data-testid="browser-export-all" onClick={() => files.forEach((f) => downloadBundleFile(f, prefix))}>
            모두 내려받기
          </button>
        )}
      </div>
      {error ? <ErrorBox error={error} title="산출물 파일을 만들지 못했습니다" /> : null}
      {files === null ? (
        <Empty>index.html · spec.json · trace.json · validation.json · comments.json · manifest.json 을 이 브라우저에서 만듭니다.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="table compact">
            <thead>
              <tr>
                <th>파일</th>
                <th>크기</th>
                <th>sha256</th>
                <th>내려받기</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.path} data-testid="browser-export-file" data-path={f.path}>
                  <td>
                    <code>{f.path}</code>
                  </td>
                  <td className="num">{Math.max(1, Math.round(f.text.length / 1024))}KB</td>
                  <td>
                    <code title={f.sha256}>{shortHash(f.sha256, 16)}</code>
                  </td>
                  <td>
                    <button type="button" className="btn btn-small" onClick={() => downloadBundleFile(f, prefix)}>
                      내려받기
                    </button>
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
