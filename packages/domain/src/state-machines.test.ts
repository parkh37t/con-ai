import { describe, expect, it } from 'vitest'
import type { ArtifactStatus, JobStatus } from '@con-ai/schemas'
import { DomainRuleError } from './result.js'
import { ARTIFACT_TRANSITIONS, JOB_TRANSITIONS, canTransitionArtifact, canTransitionJob, isTerminalArtifactStatus, isTerminalJobStatus, transitionArtifact, transitionJob } from './state-machines.js'

describe('작업 상태 전이 (설계 §11)', () => {
  it('queued → running → succeeded/failed/cancelled 만 허용한다', () => {
    expect(transitionJob('queued', 'running')).toBe('running')
    for (const end of ['succeeded', 'failed', 'cancelled'] as const) expect(transitionJob('running', end)).toBe(end)
    expect(transitionJob('queued', 'cancelled')).toBe('cancelled')
    expect(Object.keys(JOB_TRANSITIONS).sort()).toEqual(['cancelled', 'failed', 'queued', 'running', 'succeeded'])
  })

  it('실행하지 않은 작업을 성공으로 표시할 수 없다 (queued → succeeded 거부)', () => {
    const d = canTransitionJob('queued', 'succeeded')
    expect(d.allowed).toBe(false)
    expect(d.reasons[0]?.code).toBe('job.transition_not_allowed')
    expect(d.reasons[0]?.message).toContain('running')
    expect(() => transitionJob('queued', 'succeeded')).toThrow(DomainRuleError)
    expect(canTransitionJob('queued', 'failed').allowed).toBe(false)
  })

  it('종료 상태에서는 어디로도 갈 수 없고 같은 상태로의 전이도 거부한다', () => {
    for (const end of ['succeeded', 'failed', 'cancelled'] as const) {
      expect(isTerminalJobStatus(end)).toBe(true)
      expect(canTransitionJob(end, 'running').reasons[0]?.code).toBe('job.terminal')
    }
    expect(canTransitionJob('running', 'running').reasons[0]?.code).toBe('job.same_status')
  })
})

describe('산출물 상태 전이 (설계 §11)', () => {
  it('draft → validation_pending → review_ready → approved 순서를 따른다', () => {
    let s: ArtifactStatus = 'draft'
    for (const next of ['validation_pending', 'review_ready', 'approved', 'stale'] as const) s = transitionArtifact(s, next)
    expect(s).toBe('stale')
    expect(isTerminalArtifactStatus('stale')).toBe(true)
  })

  it('approved → draft 직접 전이는 거부한다 — 변경은 새 draft 산출물, 기존 승인본은 stale', () => {
    const d = canTransitionArtifact('approved', 'draft')
    expect(d.allowed).toBe(false)
    expect(d.reasons[0]?.message).toContain('새 draft')
    expect(() => transitionArtifact('approved', 'draft')).toThrow(DomainRuleError)
    expect(ARTIFACT_TRANSITIONS.approved).toEqual(['stale'])
  })

  it('검증·검토 단계를 건너뛰는 전이는 이유와 함께 거부한다', () => {
    expect(canTransitionArtifact('draft', 'approved').reasons[0]?.message).toContain('검증')
    expect(canTransitionArtifact('draft', 'review_ready').reasons[0]?.message).toContain('필수 검사')
    expect(canTransitionArtifact('validation_pending', 'approved').reasons[0]?.message).toContain('V6')
    expect(canTransitionArtifact('stale', 'approved').reasons[0]?.code).toBe('artifact.terminal')
    // 필수 검사 실패는 초안으로 돌아간다; 재검증 요청은 허용
    expect(canTransitionArtifact('validation_pending', 'draft').allowed).toBe(true)
    expect(canTransitionArtifact('review_ready', 'validation_pending').allowed).toBe(true)
  })
})

describe('세 상태 체계는 합치지 않는다 (설계 §10, §11; 보고서 §4)', () => {
  it('작업 전이에 산출물·검증 값을, 산출물 전이에 작업·검증 값을 넣으면 거부한다', () => {
    expect(canTransitionJob('queued', 'approved' as JobStatus).reasons[0]?.code).toBe('job.status_foreign')
    expect(canTransitionJob('pass' as JobStatus, 'running').reasons[0]?.code).toBe('job.status_foreign')
    expect(canTransitionArtifact('draft', 'succeeded' as ArtifactStatus).reasons[0]?.code).toBe('artifact.status_foreign')
    expect(canTransitionArtifact('draft', 'pass' as ArtifactStatus).reasons[0]?.code).toBe('artifact.status_foreign')
    expect(() => transitionArtifact('review_ready', 'succeeded' as ArtifactStatus)).toThrow(/산출물 상태가 아니다/)
  })
})
