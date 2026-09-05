/**
 * 작업 상태 패널 — queued/running/succeeded/failed 와 단계 진행, 실패 원인. 성공 시 검토 링크.
 * 실패한 작업은 이전 결과를 새 결과처럼 보이지 않게 명시 문구를 붙인다 (CLAUDE.md).
 */
import { failureCodeLabel, STAGE_LABELS, stageProgress } from '../job-progress.js'
import { hrefToScreen } from '../router.js'
import type { Job } from '../types.js'
import { ErrorBox, JobStatusBadge, formatDateTime } from './common.js'

export function JobStatusPanel({ jobId, job, error, polling, screenId, successLabel = '검토로 이동' }: { jobId: string; job: Job | null; error: unknown; polling: boolean; screenId: string; successLabel?: string }) {
  return (
    <section className="card job-panel" aria-live="polite">
      <div className="card-head">
        <h3>작업 상태</h3>
        <span className="muted small">
          작업 ID <code>{jobId}</code>
          {polling && ' · 2초마다 갱신'}
        </span>
      </div>
      {error ? <ErrorBox error={error} title="작업 상태를 읽지 못했습니다" /> : null}
      {!job && !error && <div className="loading">작업 상태를 읽는 중…</div>}
      {job && (
        <>
          <div className="job-status-line">
            <JobStatusBadge status={job.status} />
            {job.adapter && (
              <span className="muted small">
                어댑터 {job.adapter}
                {job.model ? ` (${job.model})` : ''}
              </span>
            )}
            {job.attempt !== undefined && job.max_attempts !== undefined && (
              <span className="muted small">
                시도 {job.attempt}/{job.max_attempts}
              </span>
            )}
            <span className="muted small">시작 {formatDateTime(job.started_at)} · 종료 {formatDateTime(job.finished_at)}</span>
          </div>
          <ol className="stages">
            {stageProgress(job).map((s) => (
              <li key={s.stage} className={`stage stage-${s.state}`} title={s.stage}>
                <span className="stage-dot" aria-hidden="true" />
                <span>{s.label}</span>
              </li>
            ))}
          </ol>
          {job.status === 'failed' && (
            <div className="error-box" role="alert">
              <strong>
                작업 실패 — {failureCodeLabel(job.failure?.code ?? 'internal')}
                {job.failure?.stage ? ` (${STAGE_LABELS[job.failure.stage]} 단계)` : ''}
              </strong>
              <div>{job.failure?.message ?? '실패 원인이 기록되지 않았습니다.'}</div>
              {job.failure?.details && job.failure.details.length > 0 && (
                <ul>
                  {job.failure.details.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              )}
              <p className="small">이 작업은 새 revision 을 만들지 않았습니다. 아래 검토 화면에 보이는 이전 revision 은 이 작업의 결과가 아닙니다.</p>
            </div>
          )}
          {job.status === 'cancelled' && <div className="notice">작업이 취소되었습니다. 새 결과는 없습니다.</div>}
          {job.status === 'succeeded' && job.result && (
            <div className="success-box">
              <div>
                새 revision 이 저장되었습니다. revision <code>{job.result.revision_id}</code> · artifact <code>{job.result.artifact_id}</code>
              </div>
              <a className="btn btn-primary" href={hrefToScreen('review', screenId, { rev: job.result.revision_id })}>
                {successLabel}
              </a>
            </div>
          )}
          {job.status === 'succeeded' && !job.result && <div className="notice">작업은 성공으로 기록됐지만 결과(revision) 정보가 없습니다. 화면 검토 목록에서 확인하세요.</div>}
          {job.context_summary && job.context_summary.length > 0 && (
            <details className="collapsible">
              <summary>이 작업에 쓴 문맥 ({job.context_summary.length})</summary>
              <ul className="context-list">
                {job.context_summary.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  )
}
