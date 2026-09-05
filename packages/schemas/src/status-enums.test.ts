/** 세 상태 enum(작업/산출물/검증)은 별도 정의하며 합치지 않는다 (설계 §10, §11; 보고서 §4 의 원칙을 제품 상태에도 적용). */
import { describe, expect, it } from 'vitest'
import { ArtifactStatus, JobStatus } from './job.js'
import { TraceLinkStatus } from './trace-link.js'
import { ValidationStatus } from './validation.js'

describe('상태 enum 구분', () => {
  it('작업/산출물/검증 상태 값은 서로 겹치지 않는다', () => {
    const job = new Set<string>(JobStatus.options)
    const artifact = new Set<string>(ArtifactStatus.options)
    const validation = new Set<string>(ValidationStatus.options)
    for (const v of job) expect(artifact.has(v) || validation.has(v)).toBe(false)
    for (const v of artifact) expect(validation.has(v)).toBe(false)
  })

  it('한 enum 의 값을 다른 enum 이 받아들이지 않는다 (작업 성공 ≠ 산출물 승인 ≠ 검사 통과)', () => {
    expect(JobStatus.safeParse('approved').success).toBe(false)
    expect(JobStatus.safeParse('pass').success).toBe(false)
    expect(ArtifactStatus.safeParse('succeeded').success).toBe(false)
    expect(ArtifactStatus.safeParse('pass').success).toBe(false)
    expect(ValidationStatus.safeParse('succeeded').success).toBe(false)
    expect(ValidationStatus.safeParse('approved').success).toBe(false)
  })

  it('매핑 상태(TraceLinkStatus)도 별도 enum 이다 — approved 라는 단어가 같아도 산출물 승인과 다른 값이다', () => {
    expect(TraceLinkStatus).not.toBe(ArtifactStatus)
    expect(TraceLinkStatus.safeParse('review_ready').success).toBe(false)
    expect(ArtifactStatus.safeParse('candidate').success).toBe(false)
  })
})
