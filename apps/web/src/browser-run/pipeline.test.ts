/**
 * 브라우저 생성 파이프라인 — 단계 진행, 실제 렌더·V1·V2 실행, V3 not_run 기록,
 * 모델 오류(401·429·거부)·스키마 실패의 정직한 실패, 토큰 유출 없음.
 * 네트워크는 쓰지 않는다 (fetch 주입).
 */
import { describe, expect, it } from 'vitest'
import { BrowserPipelineError, V3_NOT_RUN_MESSAGE, checkSpec, collectDummy, runBrowserPipeline, v3RequiredFor, type PipelineInput } from './pipeline.js'
import type { StoredCredential } from './credential.js'
import type { JobStage, SliceGenerationRequest } from '../types.js'
import { fakeFetch, modelOutput, modelResponse, snapshotSpec } from './test-helpers.js'

const CREDENTIAL: StoredCredential = { kind: 'token', value: '비밀-oauth-토큰-값-9999', persist: false }

const REQUEST: SliceGenerationRequest = {
  screen_id: 'screen-1',
  task_type: 'create',
  purpose: '견적 목록을 조회한다',
  requirement_ids: [],
  criterion_ids: [],
  reference_ids: [],
  cases: ['normal', 'empty', 'error'],
  keep_conditions: [],
  roles: ['partner'],
  device: 'desktop',
}

function input(overrides: Partial<PipelineInput> = {}): PipelineInput {
  return {
    request: REQUEST,
    credential: CREDENTIAL,
    project: { id: 'p1', name: '샘플 프로젝트', org: '와일리', profile_id: 's2b-learned-v1', slug: 'wyliy-partner-quote-sample', baseline_id: 'baseline-wyliy-partner-quote-sample-1' },
    screen: { id: 'screen-1', external_id: 'SAMPLE-quote-list', title: '견적 목록', shell: 'partner-page', device: 'desktop' },
    requirements: [],
    references: [],
    comments: [],
    dummy: {},
    revision_no: 1,
    ...overrides,
  }
}

describe('성공 경로 — 실제 렌더·검증을 브라우저에서 돌린다', () => {
  it('단계를 순서대로 알리고 revision·artifact 를 만든다', async () => {
    const { fetch, calls } = fakeFetch([modelResponse(modelOutput(snapshotSpec()))])
    const stages: JobStage[] = []
    const result = await runBrowserPipeline(input(), { fetch, onStage: (s) => stages.push(s), now: () => '2026-09-05T00:00:00.000Z', newId: () => 'id-1' })

    expect(stages).toEqual(['context_build', 'spec_generate', 'schema_check', 'render', 'validate', 'persist'])
    expect(calls).toHaveLength(1)
    expect(result.record.html).toContain('root-shell')
    expect(result.record.artifact.content_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(result.record.element_index.length).toBeGreaterThan(0)
    expect(result.record.generated_by).toBe('anthropic:claude-opus-5')
    expect(result.usage).toEqual({ input_tokens: 100, output_tokens: 200 })
  })

  it('V1·V2 는 실제로 통과하고 V3 는 not_run 으로만 기록된다 (통과로 위장하지 않는다)', async () => {
    const { fetch } = fakeFetch([modelResponse(modelOutput(snapshotSpec()))])
    const result = await runBrowserPipeline(input(), { fetch })
    const byId = new Map(result.record.validation_results.map((r) => [r.check_id, r]))

    expect(byId.get('V1.schema')?.status).toBe('pass')
    expect(byId.get('V1.references')?.status).toBe('pass')
    expect(byId.get('V2.shell')?.status).toBe('pass')
    expect(byId.get('V2.element_ids')?.status).toBe('pass')

    for (const id of ['V3.console_errors', 'V3.case_switch']) {
      const v3 = byId.get(id)
      expect(v3?.status).toBe('not_run')
      expect(v3?.required).toBe(true)
      expect(v3?.message).toBe(V3_NOT_RUN_MESSAGE)
      expect(v3?.evidence.join(' ')).toContain('Playwright')
    }
    // 필수 검사가 미실행이므로 검토 가능(review_ready)으로 올리지 않는다.
    expect(result.record.artifact.status).toBe('validation_pending')
  })

  it('더미데이터가 없으면 빈 배열로 렌더하고 unresolved 에 남긴다', async () => {
    const { fetch } = fakeFetch([modelResponse(modelOutput(snapshotSpec()))])
    const result = await runBrowserPipeline(input(), { fetch })
    const unresolved = (result.record.spec.unresolved ?? []) as Array<{ kind: string; text: string }>
    expect(unresolved.some((u) => u.kind === 'missing_evidence' && u.text.includes('더미데이터'))).toBe(true)
  })

  it('프롬프트·문맥에 토큰 값이 들어가지 않는다', async () => {
    const { fetch, calls } = fakeFetch([modelResponse(modelOutput(snapshotSpec()))])
    const result = await runBrowserPipeline(input(), { fetch })
    const serialized = JSON.stringify({ record: result.record, prompt: result.prompt, summary: result.context_summary })
    expect(serialized).not.toContain(CREDENTIAL.value)
    // 값은 헤더에만 있고 본문에는 없다.
    expect(JSON.stringify(calls[0]?.body)).not.toContain(CREDENTIAL.value)
    expect(calls[0]?.headers['authorization']).toContain(CREDENTIAL.value)
  })
})

describe('실패 경로 — 원인을 구분해 기록한다', () => {
  const failing = async (responses: Parameters<typeof fakeFetch>[0], over: Partial<PipelineInput> = {}) => {
    const { fetch } = fakeFetch(responses)
    return (await runBrowserPipeline(input(over), { fetch }).catch((e: unknown) => e)) as BrowserPipelineError
  }

  it('401 은 model_error 이며 메시지에 토큰 값이 없다', async () => {
    const err = await failing([{ status: 401, body: { error: { message: `bad ${CREDENTIAL.value}` } } }])
    expect(err).toBeInstanceOf(BrowserPipelineError)
    expect(err.code).toBe('model_error')
    expect(err.stage).toBe('spec_generate')
    expect(`${err.message} ${err.details.join(' ')}`).not.toContain(CREDENTIAL.value)
    expect(err.message).toContain('인증')
  })

  it('429 도 model_error 로 끝내고 이유를 남긴다', async () => {
    const err = await failing([{ status: 429, body: { error: { message: 'rate limited' } } }])
    expect(err.code).toBe('model_error')
    expect(err.message).toContain('한도')
  })

  it('모델 거부는 성공으로 바꾸지 않는다', async () => {
    const err = await failing([{ status: 200, body: { content: [], stop_reason: 'refusal', stop_details: { category: 'cyber' }, usage: {} } }])
    expect(err.code).toBe('model_error')
    expect(err.message).toContain('거부')
  })

  it('스키마에 맞지 않는 명세는 schema_invalid 로 끝낸다', async () => {
    const err = await failing([modelResponse(modelOutput({ schema_version: '1.0', screen_id: 'SAMPLE-quote-list' }))])
    expect(err.code).toBe('schema_invalid')
    expect(err.stage).toBe('schema_check')
    expect(err.details.length).toBeGreaterThan(0)
  })

  it('screen_id 가 다르면 reference_invalid', async () => {
    const spec = snapshotSpec()
    spec['screen_id'] = 'OTHER-screen'
    const err = await failing([modelResponse(modelOutput(spec))])
    expect(err.code).toBe('reference_invalid')
    expect(err.details.join(' ')).toContain('screen_id')
  })

  it('없는 요구사항을 고르면 모델을 호출하기 전에 멈춘다', async () => {
    const { fetch, calls } = fakeFetch([modelResponse(modelOutput(snapshotSpec()))])
    const err = (await runBrowserPipeline(input({ request: { ...REQUEST, requirement_ids: ['없는-요구사항'] } }), { fetch }).catch((e: unknown) => e)) as BrowserPipelineError
    expect(err.code).toBe('reference_invalid')
    expect(err.stage).toBe('context_build')
    expect(calls).toHaveLength(0)
  })

  it('수정 작업인데 기준 revision 이 없으면 거절한다', async () => {
    const { fetch } = fakeFetch([modelResponse(modelOutput(snapshotSpec()))])
    const err = (await runBrowserPipeline(input({ request: { ...REQUEST, task_type: 'edit' } }), { fetch }).catch((e: unknown) => e)) as BrowserPipelineError
    expect(err.code).toBe('reference_invalid')
    expect(err.message).toContain('기준 revision')
  })
})

describe('부분 규칙', () => {
  it('V3 필수 여부는 명세의 동작에 따라 정해진다 (서버 requiredChecksFor 와 같음)', () => {
    const spec = { actions: [{ type: 'filter-fixture' }] } as never
    expect(v3RequiredFor(spec)).toEqual({ 'V3.console_errors': true, 'V3.case_switch': true, 'V3.search_filter': true, 'V3.download': false })
  })

  it('checkSpec 은 참조가 깨진 명세를 걸러낸다', () => {
    const spec = snapshotSpec() as Record<string, unknown>
    const actions = spec['actions'] as Array<Record<string, unknown>>
    if (actions.length > 0 && actions[0]) actions[0]['target'] = 'no-such-element'
    expect(() => checkSpec({ screen_spec: spec }, { screen_id: 'SAMPLE-quote-list', baseline_id: 'baseline-wyliy-partner-quote-sample-1' })).toThrow(/참조/)
  })

  it('collectDummy 는 있는 fixture 를 그대로 쓰고 없는 것만 비운다', () => {
    const spec = { states: [{ id: 'normal', fixture_id: 'F1' }, { id: 'empty', fixture_id: 'F2' }], unresolved: [] } as never as Parameters<typeof collectDummy>[0]
    const dummy = collectDummy(spec, { F1: [{ a: 1 }] })
    expect(dummy).toEqual({ F1: [{ a: 1 }], F2: [] })
    expect(spec.unresolved).toHaveLength(1)
  })
})
