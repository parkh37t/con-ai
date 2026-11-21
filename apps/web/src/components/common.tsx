/** 공통 조각 — 오류 상자, 로딩, 빈 상태, 배지, 접이식 블록. */
import type { ReactNode } from 'react'
import { errorMessage, errorReasons } from '../api.js'
import { ARTIFACT_STATUS_LABELS, VALIDATION_STATUS_LABELS } from '../summary.js'
import type { ArtifactStatus, CommentRole, CommentStatus, JobStatus, ScreenStatus, ValidationStatus, ValidationSummary } from '../types.js'
import { JOB_STATUS_LABELS } from '../job-progress.js'

export function ErrorBox({ error, title, testId }: { error: unknown; title?: string; testId?: string }) {
  if (error === null || error === undefined) return null
  const reasons = errorReasons(error)
  return (
    <div className="error-box" role="alert" data-testid={testId}>
      <strong>{title ?? '오류'}</strong>
      <div>{errorMessage(error)}</div>
      {reasons.length > 0 && (
        <ul>
          {reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function Loading({ text = '불러오는 중…' }: { text?: string }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      {text}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}

export function Badge({ tone = 'gray', children, title, testId }: { tone?: 'gray' | 'green' | 'red' | 'amber' | 'blue' | 'purple'; children: ReactNode; title?: string; testId?: string }) {
  return (
    <span className={`badge badge-${tone}`} title={title} data-testid={testId}>
      {children}
    </span>
  )
}

const SCREEN_STATUS: Record<ScreenStatus, { label: string; tone: 'gray' | 'blue' | 'green' }> = {
  draft: { label: '초안', tone: 'gray' },
  review: { label: '검토 중', tone: 'blue' },
  approved: { label: '완료', tone: 'green' },
}
export function ScreenStatusBadge({ status }: { status: ScreenStatus }) {
  const s = SCREEN_STATUS[status] ?? { label: status, tone: 'gray' as const }
  return <Badge tone={s.tone}>{s.label}</Badge>
}

const ARTIFACT_TONE: Record<ArtifactStatus, 'gray' | 'amber' | 'blue' | 'green' | 'red'> = {
  draft: 'gray',
  validation_pending: 'amber',
  review_ready: 'blue',
  approved: 'green',
  stale: 'red',
}
export function ArtifactStatusBadge({ status }: { status: ArtifactStatus }) {
  return <Badge tone={ARTIFACT_TONE[status] ?? 'gray'}>{ARTIFACT_STATUS_LABELS[status] ?? status}</Badge>
}

const VALIDATION_TONE: Record<ValidationStatus, 'green' | 'red' | 'amber' | 'gray'> = { pass: 'green', fail: 'red', error: 'amber', not_run: 'gray' }
export function ValidationStatusBadge({ status }: { status: ValidationStatus }) {
  return <Badge tone={VALIDATION_TONE[status] ?? 'gray'}>{VALIDATION_STATUS_LABELS[status] ?? status}</Badge>
}

/** pass/fail/error/not_run 네 칸을 항상 모두 보여준다 (미실행을 숨기지 않는다). */
export function ValidationSummaryBadges({ summary }: { summary: ValidationSummary }) {
  return (
    <span className="summary-badges">
      <Badge tone="green" title="통과">
        통과 {summary.pass}
      </Badge>
      <Badge tone="red" title="실패">
        실패 {summary.fail}
      </Badge>
      <Badge tone="amber" title="오류">
        오류 {summary.error}
      </Badge>
      <Badge tone="gray" title="미실행">
        미실행 {summary.not_run}
      </Badge>
    </span>
  )
}

const JOB_TONE: Record<JobStatus, 'gray' | 'blue' | 'green' | 'red' | 'amber'> = { queued: 'gray', running: 'blue', succeeded: 'green', failed: 'red', cancelled: 'amber' }
export function JobStatusBadge({ status }: { status: JobStatus }) {
  return <Badge tone={JOB_TONE[status] ?? 'gray'}>{JOB_STATUS_LABELS[status] ?? status}</Badge>
}

export const ROLE_LABELS: Readonly<Record<CommentRole, string>> = {
  planner: '기획자',
  designer: '디자이너',
  publisher: '퍼블리셔',
  developer: '개발자',
  client: '고객',
}
export const COMMENT_STATUS_LABELS: Readonly<Record<CommentStatus, string>> = {
  open: '열림',
  resolved: '해결',
  wont_fix: '반영 안 함',
}
export function CommentStatusBadge({ status }: { status: CommentStatus }) {
  const tone = status === 'open' ? 'amber' : status === 'resolved' ? 'green' : 'gray'
  return <Badge tone={tone}>{COMMENT_STATUS_LABELS[status] ?? status}</Badge>
}

export function Collapsible({ title, children, open = false }: { title: ReactNode; children: ReactNode; open?: boolean }) {
  return (
    <details className="collapsible" open={open}>
      <summary>{title}</summary>
      <div className="collapsible-body">{children}</div>
    </details>
  )
}

export function formatDateTime(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('ko-KR', { hour12: false })
}

export function shortHash(hash: string | undefined, n = 10): string {
  return hash ? hash.slice(0, n) : '—'
}
