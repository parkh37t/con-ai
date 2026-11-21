import { describe, expect, it } from 'vitest'
import { JOB_STAGES, currentStageOf, failureCodeLabel, isTerminalJob, stageProgress } from './job-progress.js'

const states = (job: Parameters<typeof stageProgress>[0]) => stageProgress(job).map((s) => s.state)

describe('stageProgress — 작업 단계 표시', () => {
  it('단계 순서는 계약 §6 과 같다', () => {
    expect(JOB_STAGES).toEqual(['context_build', 'spec_generate', 'schema_check', 'render', 'validate', 'persist'])
  })

  it('queued 는 전부 pending', () => {
    expect(states({ status: 'queued' })).toEqual(['pending', 'pending', 'pending', 'pending', 'pending', 'pending'])
  })

  it('running 은 현재 단계 active, 이전 done, 이후 pending', () => {
    expect(states({ status: 'running', current_stage: 'render' })).toEqual(['done', 'done', 'done', 'active', 'pending', 'pending'])
    // 단계를 모르면 첫 단계 active
    expect(states({ status: 'running' })).toEqual(['active', 'pending', 'pending', 'pending', 'pending', 'pending'])
    // `stage` 이름으로 와도 읽는다
    expect(states({ status: 'running', stage: 'spec_generate' })).toEqual(['done', 'active', 'pending', 'pending', 'pending', 'pending'])
  })

  it('succeeded 는 전부 done', () => {
    expect(states({ status: 'succeeded', current_stage: 'persist' })).toEqual(['done', 'done', 'done', 'done', 'done', 'done'])
  })

  it('failed 는 실패 단계를 failed 로, 이후는 pending 으로 표시한다 (failure.stage 우선)', () => {
    expect(states({ status: 'failed', current_stage: 'validate', failure: { code: 'schema_invalid', message: 'x', stage: 'schema_check' } })).toEqual([
      'done',
      'done',
      'failed',
      'pending',
      'pending',
      'pending',
    ])
    expect(states({ status: 'failed', current_stage: 'render', failure: { code: 'renderer_error', message: 'x' } })).toEqual(['done', 'done', 'done', 'failed', 'pending', 'pending'])
    // 실패 단계를 모르면 어떤 단계도 done 으로 표시하지 않는다
    expect(states({ status: 'failed', failure: { code: 'internal', message: 'x' } })).toEqual(['pending', 'pending', 'pending', 'pending', 'pending', 'pending'])
  })

  it('cancelled 는 이전 단계만 done', () => {
    expect(states({ status: 'cancelled', current_stage: 'spec_generate' })).toEqual(['done', 'pending', 'pending', 'pending', 'pending', 'pending'])
    expect(states({ status: 'cancelled' })).toEqual(['pending', 'pending', 'pending', 'pending', 'pending', 'pending'])
  })

  it('라벨은 한국어다', () => {
    expect(stageProgress({ status: 'queued' }).map((s) => s.label)).toEqual(['문맥 구성', '명세 생성', '스키마 검사', '렌더', '검증', '저장'])
  })
})

describe('isTerminalJob / currentStageOf / failureCodeLabel', () => {
  it('종료 상태 판정', () => {
    expect(isTerminalJob('queued')).toBe(false)
    expect(isTerminalJob('running')).toBe(false)
    expect(isTerminalJob('succeeded')).toBe(true)
    expect(isTerminalJob('failed')).toBe(true)
    expect(isTerminalJob('cancelled')).toBe(true)
  })

  it('currentStageOf 는 실패 단계 > current_stage > stage 순으로 읽는다', () => {
    expect(currentStageOf({ status: 'failed', current_stage: 'render', failure: { code: 'x', message: 'm', stage: 'validate' } })).toBe('validate')
    expect(currentStageOf({ status: 'running', current_stage: 'render', stage: 'persist' })).toBe('render')
    expect(currentStageOf({ status: 'running', stage: 'persist' })).toBe('persist')
    expect(currentStageOf({ status: 'queued' })).toBeUndefined()
  })

  it('실패 코드 라벨 — 모르는 코드는 그대로', () => {
    expect(failureCodeLabel('model_error')).toBe('모델 오류')
    expect(failureCodeLabel('weird_code')).toBe('weird_code')
  })
})
