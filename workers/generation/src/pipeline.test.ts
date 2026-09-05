/**
 * 생성 파이프라인 테스트 — 가짜 store(메모리)·adapter·render·validate·assembler 를 주입한다.
 * 성공 / schema_invalid / reference_invalid / model_error / cancelled / renderer_error 경로와 revision_no 증가, 코멘트 해결 표시를 검사한다.
 */
import { describe, expect, it } from 'vitest'
import type { AdapterResult, ModelAdapter } from '@con-ai/model-adapter'
import type { AssembledPrompt, GenerationContext, SliceGenerationRequest } from '@con-ai/prompt-templates'
import type { RenderInput, RenderOutput } from '@con-ai/renderer'
import { Artifact, GenerationJob, ScreenSpec, type ScreenSpecInput, type ValidationResult } from '@con-ai/schemas'
import type { ArtifactDocument, CommentDocument, DummyDataDocument, JobDocument, ProjectDocument, ReferenceDocument, RequirementDocument, ScreenDocument, ScreenRevisionDocument } from './documents.js'
import { sha256 } from './hash.js'
import { MemoryStore } from './memory-store.js'
import { runGenerationJob } from './pipeline.js'
import type { PipelineDeps, PromptAssembler, Store } from './types.js'

// ---------- 합성 데이터 ----------

const PROJECT_ID = 'a0000000-0000-4000-8000-000000000001'
const SCREEN_ID = 'a4000000-0000-4000-8000-000000000001'
const REQ_ID = 'a3000000-0000-4000-8000-000000000001'
const REF_ID = 'a5000000-0000-4000-8000-000000000001'
const ANCHOR = '11111111-1111-4111-8111-111111111111'
const BASELINE = 'baseline-test-1'

let idSeq = 0
function newId(): string {
  idSeq += 1
  return `b0000000-0000-4000-8000-${String(idSeq).padStart(12, '0')}`
}
let clock = 0
function now(): string {
  clock += 1
  return new Date(Date.UTC(2026, 8, 5, 9, 0, clock)).toISOString()
}

function sampleSpec(overrides: Partial<ScreenSpecInput> = {}): ScreenSpecInput {
  return {
    schema_version: '1.0',
    screen_id: 'TEST-list',
    baseline_id: BASELINE,
    purpose: '테스트 목록 화면',
    shell: 'partner-page',
    device: 'desktop',
    roles: ['partner'],
    requirements: [{ id: 'REQ-T-001', criterion_ids: ['AC-T-001-01', 'AC-T-001-02'] }],
    sections: [
      { id: 'search', title: '검색', display_no: '1', elements: [{ id: 'query', type: 'text-input', label: '검색어', display_no: 'a', trace: ['AC-T-001-01'] }, { id: 'search-button', type: 'button', label: '검색', display_no: 'b' }] },
      {
        id: 'results',
        title: '목록',
        display_no: '2',
        elements: [{ id: 'grid', type: 'table', label: '목록 표', display_no: 'a', columns: [{ id: 'no', label: '번호', sortable: true }, { id: 'name', label: '이름' }], default_sort: { column_id: 'no', direction: 'desc' }, trace: ['AC-T-001-02'] }],
      },
    ],
    actions: [
      { id: 'search-submit', type: 'filter-fixture', trigger: 'search-button', target: 'results', trace: ['AC-T-001-01'] },
      { id: 'show-empty', type: 'set-state', target_state_id: 'empty' },
    ],
    states: [
      { id: 'normal', fixture_id: 'TEST-list-normal', expected: '3행 표시', case_kind: 'normal' },
      { id: 'empty', fixture_id: 'TEST-list-empty', expected: '결과 없음', case_kind: 'empty', message_ids: ['msg-empty'] },
    ],
    messages: [{ id: 'msg-empty', kind: 'info', text: '조회 결과가 없습니다.' }],
    data_mapping: [{ element_id: 'grid', column_id: 'no', source: 'items.no', evidence: [{ anchor_id: ANCHOR }] }],
    unresolved: [],
    ...overrides,
  }
}

function seedStore(store: Store): void {
  const project: ProjectDocument = { id: PROJECT_ID, name: '테스트 프로젝트', slug: 'test', org: '테스트 조직', description: '', profile_id: 's2b-learned-v1', baseline_id: BASELINE, created_at: now() }
  store.put('project', PROJECT_ID, project, 0)
  const req: RequirementDocument = {
    id: REQ_ID,
    project_id: PROJECT_ID,
    external_id: 'REQ-T-001',
    title: '목록 조회',
    body: '사용자는 목록을 검색한다',
    criteria: [
      { id: 'AC-T-001-01', text: '검색어로 목록을 검색한다', kind: 'ui' },
      { id: 'AC-T-001-02', text: '결과를 표로 표시한다', kind: 'ui' },
      { id: 'AC-T-001-03', text: '야간 배치로 집계한다', kind: 'non_ui' },
    ],
  }
  store.put('requirement', REQ_ID, req, 0)
  const screen: ScreenDocument = { id: SCREEN_ID, project_id: PROJECT_ID, external_id: 'TEST-list', title: '테스트 목록', shell: 'partner-page', device: 'desktop', status: 'draft', aliases: [] }
  store.put('screen', SCREEN_ID, screen, 0)
  const reference: ReferenceDocument = { id: REF_ID, title: '골든 목록', category: 'list', description: '', spec: ScreenSpec.parse(sampleSpec({ screen_id: 'REF-list', baseline_id: 'baseline-golden-1' })), tags: [], source: 'S2B 학습 규격 적용 합성 예시' }
  store.put('reference', REF_ID, reference, 0)
  const dummyNormal: DummyDataDocument = { id: 'TEST-list-normal', project_id: PROJECT_ID, screen_external_id: 'TEST-list', case_kind: 'normal', rows: [{ no: 1, name: '가' }, { no: 2, name: '나' }, { no: 3, name: '다' }] }
  store.put('dummy_data', dummyNormal.id, dummyNormal, 0)
  const dummyEmpty: DummyDataDocument = { id: 'TEST-list-empty', project_id: PROJECT_ID, screen_external_id: 'TEST-list', case_kind: 'empty', rows: [] }
  store.put('dummy_data', dummyEmpty.id, dummyEmpty, 0)
}

function makeRequest(overrides: Partial<SliceGenerationRequest> = {}): SliceGenerationRequest {
  return {
    screen_id: SCREEN_ID,
    task_type: 'create',
    purpose: '목록 화면 신규 생성',
    requirement_ids: [REQ_ID],
    criterion_ids: ['AC-T-001-01', 'AC-T-001-02'],
    reference_ids: [REF_ID],
    cases: ['normal', 'empty'],
    keep_conditions: [],
    roles: ['partner'],
    device: 'desktop',
    ...overrides,
  }
}

function makeJob(store: Store, request: SliceGenerationRequest, overrides: Partial<JobDocument> = {}): string {
  const id = newId()
  const job: JobDocument = {
    id,
    project_id: PROJECT_ID,
    screen_plan_id: SCREEN_ID,
    job_type: request.task_type,
    status: 'queued',
    idempotency_key: id,
    input_snapshot_hash: sha256(JSON.stringify(request)),
    baseline_id: BASELINE,
    prompt_template_version: 'v1',
    model_id: 'fixture',
    attempt: 0,
    max_attempts: 1,
    timeout_ms: 60_000,
    cancel_requested: false,
    created_at: now(),
    request,
    adapter: 'fixture',
    model: 'fixture',
    prompt_text: '',
    context_summary: [],
    ...overrides,
  }
  store.put('job', id, job, 0)
  return id
}

// ---------- 가짜 의존성 ----------

const fakeAssembler: PromptAssembler = {
  assemblePrompt: (req, ctx) => ({ system: `system ${ctx.screen.external_id}`, user: `user ${req.purpose}`, template_version: 'test-v1', context_summary: ['fake'] }),
  assembleRevisionPrompt: (ctx, instruction) => ({ system: `revise ${ctx.screen.external_id}`, user: `instruction ${instruction}`, template_version: 'test-v1-rev', context_summary: ['fake-rev'] }),
}

function okResult(spec: ScreenSpecInput, summary = '신규 생성'): AdapterResult {
  return { output: { screen_spec: spec, trace_proposals: [], unresolved: [], change_summary: { summary } }, usage: { input_tokens: 10, output_tokens: 20 } }
}

function fakeAdapter(handlers: { generate?: (input: { prompt: AssembledPrompt; ctx: GenerationContext; req: SliceGenerationRequest }) => Promise<AdapterResult>; revise?: ModelAdapter['reviseSpec'] } = {}): ModelAdapter {
  return {
    kind: 'fixture',
    model: 'fixture',
    auth: 'none',
    generateSpec: handlers.generate ?? (async () => okResult(sampleSpec())),
    reviseSpec: handlers.revise ?? (async ({ current }) => okResult({ ...(current as ScreenSpecInput), purpose: '수정된 목적' }, '코멘트 반영: 제목 수정')),
    draftRevisionPrompt: async () => ({ prompt: '수정 프롬프트', rationale: '테스트' }),
    // 계약 §12 (AS-IS) — 생성 파이프라인은 쓰지 않지만 ModelAdapter 인터페이스가 요구한다.
    draftPainPoints: async () => ({ summary: '테스트 요약', pain_points: [] }),
  }
}

function fakeRender(input: RenderInput): RenderOutput {
  const rows = Object.entries(input.dummy).map(([k, v]) => `${k}:${v.length}`).join(',')
  return {
    html: `<div class="root-shell" data-screen="${input.spec.screen_id}" data-rev="${input.meta.revision_label}">${rows}</div>`,
    description: { screen_id: input.spec.screen_id, title: input.meta.screen_title, sections: [] },
    element_index: [{ element_id: 'query', section_id: 'search', display_no: '1-a' }],
  }
}

function result(hash: string, check_id: string, status: ValidationResult['status'], required = true): ValidationResult {
  return { id: newId(), validation_run_id: 'c0000000-0000-4000-8000-000000000001', artifact_hash: hash, check_id, stage: 'V1', status, required, ...(status === 'pass' ? {} : { message: `${check_id} 실패` }), evidence: [], checker_version: 'fake-1' }
}

function passingValidate(input: { artifact_hash: string }): Promise<ValidationResult[]> {
  return Promise.resolve([result(input.artifact_hash, 'V1.schema', 'pass'), result(input.artifact_hash, 'V2.shell', 'pass')])
}

function makeDeps(overrides: Partial<Omit<PipelineDeps, 'store'>> = {}): PipelineDeps & { store: MemoryStore } {
  const store = new MemoryStore(now)
  seedStore(store)
  return { store, adapter: fakeAdapter(), render: fakeRender, validate: passingValidate, now, newId, assembler: fakeAssembler, required_check_ids: ['V1.schema', 'V2.shell'], ...overrides }
}

/** store.put 을 감싸 job.stage 변경 순서를 기록한다. */
function trackStages(store: Store): string[] {
  const stages: string[] = []
  const original = store.put.bind(store)
  store.put = <T>(kind: Parameters<Store['put']>[0], id: string, data: T, expected: number) => {
    if (kind === 'job') {
      const stage = (data as JobDocument).stage
      if (stage && stages[stages.length - 1] !== stage) stages.push(stage)
    }
    return original(kind, id, data, expected)
  }
  return stages
}

function job(store: Store, id: string): JobDocument {
  const doc = store.get<JobDocument>('job', id)
  if (!doc) throw new Error('job 없음')
  return doc.data
}

// ---------- 테스트 ----------

describe('runGenerationJob — 성공 경로', () => {
  it('여섯 단계를 순서대로 기록하고 revision·artifact·검증 결과·HTML 을 저장한 뒤 succeeded 로 끝난다', async () => {
    const deps = makeDeps()
    const stages = trackStages(deps.store)
    const jobId = makeJob(deps.store, makeRequest())

    await runGenerationJob(jobId, deps)

    const j = job(deps.store, jobId)
    expect(stages).toEqual(['context_build', 'spec_generate', 'schema_check', 'render', 'validate', 'persist'])
    expect(j.status).toBe('succeeded')
    expect(j.result).toBeDefined()
    expect(j.prompt_text).toContain('system TEST-list')
    expect(j.prompt_template_version).toBe('test-v1')
    expect(j.context_summary.some((s) => s.includes('REQ-T-001'))).toBe(true)
    expect(j.context_summary.some((s) => s.includes('골든 목록'))).toBe(true)
    expect(j.cost).toEqual({ input_tokens: 10, output_tokens: 20 })
    expect(j.started_at).toBeDefined()
    expect(j.finished_at).toBeDefined()
    expect(GenerationJob.safeParse(j).success).toBe(true)

    const revision = deps.store.get<ScreenRevisionDocument>('screen_revision', j.result!.revision_id)!.data
    expect(revision.revision_no).toBe(1)
    expect(revision.spec.screen_id).toBe('TEST-list')
    expect(revision.spec_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(revision.change_summary?.summary).toBe('신규 생성')
    expect(revision.element_index).toEqual([{ element_id: 'query', section_id: 'search', display_no: '1-a' }])
    expect(revision.based_on_revision_id).toBeUndefined()

    const artifact = deps.store.get<ArtifactDocument>('artifact', j.result!.artifact_id)!.data
    expect(Artifact.safeParse(artifact).success).toBe(true)
    expect(artifact.status).toBe('review_ready')
    expect(artifact.screen_revision_id).toBe(revision.id)
    const html = deps.store.getHtml(artifact.id)
    expect(html).toContain('TEST-list-normal:3')
    expect(html).toContain('TEST-list-empty:0')
    expect(html).toContain('data-rev="r1"')
    expect(artifact.content_hash).toBe(sha256(html!))

    const results = deps.store.list<ValidationResult>('validation_result', (d) => d.data.artifact_hash === artifact.content_hash)
    expect(results.map((r) => r.data.check_id).sort()).toEqual(['V1.schema', 'V2.shell'])

    const screen = deps.store.get<ScreenDocument>('screen', SCREEN_ID)!.data
    expect(screen.current_revision_id).toBe(revision.id)
    expect(screen.status).toBe('review')
  })

  it('두 번째 작업은 revision_no 2 가 되고 화면의 현재 revision 을 바꾼다', async () => {
    const deps = makeDeps()
    const first = makeJob(deps.store, makeRequest())
    await runGenerationJob(first, deps)
    const second = makeJob(deps.store, makeRequest({ purpose: '다시 생성' }))
    await runGenerationJob(second, deps)

    const r1 = deps.store.get<ScreenRevisionDocument>('screen_revision', job(deps.store, first).result!.revision_id)!.data
    const r2 = deps.store.get<ScreenRevisionDocument>('screen_revision', job(deps.store, second).result!.revision_id)!.data
    expect(r1.revision_no).toBe(1)
    expect(r2.revision_no).toBe(2)
    expect(deps.store.get<ScreenDocument>('screen', SCREEN_ID)!.data.current_revision_id).toBe(r2.id)
  })

  it('필수 검사가 fail 이면 작업은 succeeded 지만 artifact 는 validation_pending 이다 (작업 상태와 산출물 상태 분리)', async () => {
    const deps = makeDeps({
      validate: async ({ artifact_hash }) => [result(artifact_hash, 'V1.schema', 'pass'), result(artifact_hash, 'V2.shell', 'fail')],
    })
    const jobId = makeJob(deps.store, makeRequest())
    await runGenerationJob(jobId, deps)
    const j = job(deps.store, jobId)
    expect(j.status).toBe('succeeded')
    expect(deps.store.get<ArtifactDocument>('artifact', j.result!.artifact_id)!.data.status).toBe('validation_pending')
  })

  it('필수 검사 결과가 빠져 있으면(not_run) review_ready 로 올리지 않는다', async () => {
    const deps = makeDeps({ validate: async ({ artifact_hash }) => [result(artifact_hash, 'V1.schema', 'pass')] })
    const jobId = makeJob(deps.store, makeRequest())
    await runGenerationJob(jobId, deps)
    const j = job(deps.store, jobId)
    expect(deps.store.get<ArtifactDocument>('artifact', j.result!.artifact_id)!.data.status).toBe('validation_pending')
  })

  it('없는 fixture_id 는 빈 배열로 렌더링하고 spec.unresolved 에 missing_evidence 로 기록한다', async () => {
    const deps = makeDeps({
      adapter: fakeAdapter({
        generate: async () =>
          okResult(sampleSpec({ states: [{ id: 'normal', fixture_id: 'TEST-list-missing', expected: '표시', case_kind: 'normal' }, { id: 'empty', fixture_id: 'TEST-list-empty', expected: '결과 없음', case_kind: 'empty', message_ids: ['msg-empty'] }] })),
      }),
    })
    const jobId = makeJob(deps.store, makeRequest())
    await runGenerationJob(jobId, deps)
    const j = job(deps.store, jobId)
    expect(j.status).toBe('succeeded')
    const revision = deps.store.get<ScreenRevisionDocument>('screen_revision', j.result!.revision_id)!.data
    expect(revision.spec.unresolved).toHaveLength(1)
    expect(revision.spec.unresolved[0]?.kind).toBe('missing_evidence')
    expect(revision.spec.unresolved[0]?.text).toContain('TEST-list-missing')
    expect(deps.store.getHtml(j.result!.artifact_id)).toContain('TEST-list-missing:0')
    expect(ScreenSpec.safeParse(revision.spec).success).toBe(true)
  })
})

describe('runGenerationJob — edit 작업', () => {
  it('기준 revision 을 바탕으로 reviseSpec 을 호출하고, 반영한 코멘트를 새 revision 으로 resolved 표시한다', async () => {
    const deps = makeDeps()
    const first = makeJob(deps.store, makeRequest())
    await runGenerationJob(first, deps)
    const baseRevisionId = job(deps.store, first).result!.revision_id
    const baseArtifact = deps.store.get<ArtifactDocument>('artifact', job(deps.store, first).result!.artifact_id)!.data

    const commentId = newId()
    const comment: CommentDocument = {
      id: commentId,
      screen_id: SCREEN_ID,
      revision_id: baseRevisionId,
      artifact_hash: baseArtifact.content_hash,
      target: 'screen',
      element_id: 'query',
      author: '디자이너A',
      role: 'designer',
      text: '검색어 라벨을 "견적번호"로 바꿔주세요',
      blocking: true,
      status: 'open',
      created_at: now(),
    }
    deps.store.put('comment', commentId, comment, 0)
    const otherId = newId()
    deps.store.put('comment', otherId, { ...comment, id: otherId, text: '다른 코멘트' }, 0)

    const reviseCalls: Array<{ instruction: string; base: string }> = []
    deps.adapter = fakeAdapter({
      revise: async ({ prompt, current }) => {
        reviseCalls.push({ instruction: prompt.user, base: (current as ScreenSpecInput).screen_id })
        return okResult({ ...(current as ScreenSpecInput), purpose: '수정된 목적' }, '라벨 변경')
      },
    })
    const editJob = makeJob(deps.store, makeRequest({ task_type: 'edit', purpose: '코멘트 반영', base_revision_id: baseRevisionId, comment_ids: [commentId] }))
    await runGenerationJob(editJob, deps)

    const j = job(deps.store, editJob)
    expect(j.status).toBe('succeeded')
    expect(reviseCalls).toEqual([{ instruction: 'instruction 코멘트 반영', base: 'TEST-list' }])
    expect(j.prompt_template_version).toBe('test-v1-rev')
    expect(j.context_summary.some((s) => s.includes('견적번호'))).toBe(true)

    const revision = deps.store.get<ScreenRevisionDocument>('screen_revision', j.result!.revision_id)!.data
    expect(revision.revision_no).toBe(2)
    expect(revision.based_on_revision_id).toBe(baseRevisionId)
    expect(revision.spec.purpose).toBe('수정된 목적')
    expect(revision.change_summary?.summary).toBe('라벨 변경')

    const resolved = deps.store.get<CommentDocument>('comment', commentId)!.data
    expect(resolved.status).toBe('resolved')
    expect(resolved.resolved_by_revision_id).toBe(revision.id)
    // 요청에 없던 코멘트는 그대로 open 이다.
    expect(deps.store.get<CommentDocument>('comment', otherId)!.data.status).toBe('open')
  })

  it('생성 결과가 없는 화면의 edit 작업은 context_build 에서 reference_invalid 로 실패한다', async () => {
    const deps = makeDeps()
    const jobId = makeJob(deps.store, makeRequest({ task_type: 'edit', purpose: '수정' }))
    await runGenerationJob(jobId, deps)
    const j = job(deps.store, jobId)
    expect(j.status).toBe('failed')
    expect(j.failure?.code).toBe('reference_invalid')
    expect(j.failure?.stage).toBe('context_build')
  })
})

describe('runGenerationJob — 실패 경로 (이전 결과를 연결하지 않는다)', () => {
  async function seedFirstRevision(deps: PipelineDeps): Promise<string> {
    const first = makeJob(deps.store, makeRequest())
    await runGenerationJob(first, deps)
    return job(deps.store, first).result!.revision_id
  }

  it('스키마에 맞지 않는 명세는 schema_invalid 로 실패하고 이슈 경로를 details 에 남긴다', async () => {
    const deps = makeDeps()
    const previous = await seedFirstRevision(deps)
    deps.adapter = fakeAdapter({ generate: async () => okResult(sampleSpec({ sections: [] as unknown as ScreenSpecInput['sections'], states: [] as unknown as ScreenSpecInput['states'] })) })
    const jobId = makeJob(deps.store, makeRequest())
    await runGenerationJob(jobId, deps)

    const j = job(deps.store, jobId)
    expect(j.status).toBe('failed')
    expect(j.failure?.code).toBe('schema_invalid')
    expect(j.failure?.stage).toBe('schema_check')
    expect(j.failure?.details.some((d) => d.startsWith('sections'))).toBe(true)
    expect(j.failure?.details.some((d) => d.startsWith('states'))).toBe(true)
    expect(j.result).toBeUndefined()
    expect(GenerationJob.safeParse(j).success).toBe(true)
    // 이전 revision 이 그대로 현재이고, 새 revision·artifact 는 만들어지지 않았다.
    expect(deps.store.get<ScreenDocument>('screen', SCREEN_ID)!.data.current_revision_id).toBe(previous)
    expect(deps.store.list('screen_revision')).toHaveLength(1)
    expect(deps.store.list('artifact')).toHaveLength(1)
  })

  it('참조가 깨진 명세는 reference_invalid 로 실패한다 (target 이 정의되지 않은 요소)', async () => {
    const deps = makeDeps()
    deps.adapter = fakeAdapter({ generate: async () => okResult(sampleSpec({ actions: [{ id: 'search-submit', type: 'filter-fixture', target: 'result-table' }] })) })
    const jobId = makeJob(deps.store, makeRequest())
    await runGenerationJob(jobId, deps)
    const j = job(deps.store, jobId)
    expect(j.status).toBe('failed')
    expect(j.failure?.code).toBe('reference_invalid')
    expect(j.failure?.details).toEqual([expect.stringContaining('actions.0.target')])
    expect(deps.store.list('screen_revision')).toHaveLength(0)
  })

  it('screen_id 나 baseline_id 가 서버 기대값과 다르면 reference_invalid 로 실패한다', async () => {
    const deps = makeDeps()
    deps.adapter = fakeAdapter({ generate: async () => okResult(sampleSpec({ screen_id: 'OTHER-screen', baseline_id: 'baseline-other-9' })) })
    const jobId = makeJob(deps.store, makeRequest())
    await runGenerationJob(jobId, deps)
    const j = job(deps.store, jobId)
    expect(j.failure?.code).toBe('reference_invalid')
    expect(j.failure?.details).toHaveLength(2)
    expect(j.failure?.details[0]).toContain('TEST-list')
    expect(j.failure?.details[1]).toContain(BASELINE)
  })

  it('어댑터가 예외를 던지면 model_error 로 실패한다 (stage spec_generate)', async () => {
    const deps = makeDeps()
    deps.adapter = fakeAdapter({
      generate: async () => {
        throw new Error('네트워크 오류')
      },
    })
    const jobId = makeJob(deps.store, makeRequest())
    await runGenerationJob(jobId, deps)
    const j = job(deps.store, jobId)
    expect(j.status).toBe('failed')
    expect(j.failure?.code).toBe('model_error')
    expect(j.failure?.stage).toBe('spec_generate')
    expect(j.failure?.message).toContain('네트워크 오류')
    expect(j.prompt_text).toContain('system TEST-list')
  })

  it('모델이 거부(refusal)하면 model_error 로 실패한다', async () => {
    const deps = makeDeps()
    deps.adapter = fakeAdapter({ generate: async () => ({ output: { screen_spec: sampleSpec(), trace_proposals: [], unresolved: [], change_summary: { summary: 'x' } }, stop_reason: 'refusal' }) })
    const jobId = makeJob(deps.store, makeRequest())
    await runGenerationJob(jobId, deps)
    expect(job(deps.store, jobId).failure?.code).toBe('model_error')
  })

  it('렌더러 예외는 renderer_error 로 실패한다', async () => {
    const deps = makeDeps({
      render: () => {
        throw new Error('renderScreen 미구현')
      },
    })
    const jobId = makeJob(deps.store, makeRequest())
    await runGenerationJob(jobId, deps)
    const j = job(deps.store, jobId)
    expect(j.failure?.code).toBe('renderer_error')
    expect(j.failure?.stage).toBe('render')
    expect(deps.store.list('artifact')).toHaveLength(0)
  })

  it('프롬프트 조립기가 예외를 던지면 internal 로 실패한다', async () => {
    const deps = makeDeps({
      assembler: {
        assemblePrompt: () => {
          throw new Error('assemblePrompt 미구현')
        },
        assembleRevisionPrompt: () => {
          throw new Error('assembleRevisionPrompt 미구현')
        },
      },
    })
    const jobId = makeJob(deps.store, makeRequest())
    await runGenerationJob(jobId, deps)
    const j = job(deps.store, jobId)
    expect(j.status).toBe('failed')
    expect(j.failure?.code).toBe('internal')
    expect(j.failure?.message).toContain('assemblePrompt 미구현')
  })

  it('없는 요구사항·레퍼런스를 가리키면 context_build 에서 reference_invalid 로 실패한다', async () => {
    const deps = makeDeps()
    const jobId = makeJob(deps.store, makeRequest({ reference_ids: ['a5000000-0000-4000-8000-000000000099'] }))
    await runGenerationJob(jobId, deps)
    const j = job(deps.store, jobId)
    expect(j.failure?.code).toBe('reference_invalid')
    expect(j.failure?.stage).toBe('context_build')
  })

  it('검증 결과가 다른 artifact hash 를 가리키면 internal 로 실패하고 저장하지 않는다', async () => {
    const deps = makeDeps({ validate: async () => [result('0'.repeat(64), 'V1.schema', 'pass')] })
    const jobId = makeJob(deps.store, makeRequest())
    await runGenerationJob(jobId, deps)
    const j = job(deps.store, jobId)
    expect(j.status).toBe('failed')
    expect(j.failure?.code).toBe('internal')
    expect(j.failure?.stage).toBe('validate')
    expect(deps.store.list('validation_result')).toHaveLength(0)
  })
})

describe('runGenerationJob — 취소', () => {
  it('실행 전에 취소 요청이 있으면 단계에 들어가지 않고 cancelled 로 끝난다', async () => {
    const deps = makeDeps()
    const stages = trackStages(deps.store)
    const jobId = makeJob(deps.store, makeRequest(), { cancel_requested: true })
    await runGenerationJob(jobId, deps)
    const j = job(deps.store, jobId)
    expect(j.status).toBe('cancelled')
    expect(j.finished_at).toBeDefined()
    expect(stages).toEqual([])
    expect(deps.store.list('screen_revision')).toHaveLength(0)
  })

  it('실행 중 취소 요청이 오면 다음 단계 진입 전에 cancelled 로 끝나고 결과를 남기지 않는다', async () => {
    const deps = makeDeps()
    const stages = trackStages(deps.store)
    let jobId = ''
    deps.adapter = fakeAdapter({
      generate: async () => {
        // 모델 호출 중 사용자가 취소를 눌렀다.
        const doc = deps.store.get<JobDocument>('job', jobId)!
        deps.store.put('job', jobId, { ...doc.data, cancel_requested: true }, doc.revision)
        return okResult(sampleSpec())
      },
    })
    jobId = makeJob(deps.store, makeRequest())
    await runGenerationJob(jobId, deps)
    const j = job(deps.store, jobId)
    expect(j.status).toBe('cancelled')
    expect(stages).toEqual(['context_build', 'spec_generate'])
    expect(j.result).toBeUndefined()
    expect(deps.store.list('screen_revision')).toHaveLength(0)
    expect(deps.store.list('artifact')).toHaveLength(0)
  })

  it('이미 cancelled 인 작업은 아무것도 하지 않고, queued 가 아닌 작업은 거부한다', async () => {
    const deps = makeDeps()
    const cancelled = makeJob(deps.store, makeRequest(), { status: 'cancelled', finished_at: now() })
    await runGenerationJob(cancelled, deps)
    expect(job(deps.store, cancelled).status).toBe('cancelled')
    const done = makeJob(deps.store, makeRequest(), { status: 'succeeded', finished_at: now() })
    await expect(runGenerationJob(done, deps)).rejects.toThrow('queued')
    await expect(runGenerationJob('없는-작업', deps)).rejects.toThrow('찾을 수 없다')
  })
})
