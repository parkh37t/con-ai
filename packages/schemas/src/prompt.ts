/**
 * 프롬프트 입력·출력 계약 — GenerationRequest / GenerationOutput / GenerationRecord. 초안(변경 예정).
 *
 * 출처: 설계 §8 (입력 폼 7구역: 대상/작업/기준/참고/CASE/유지 조건/산출; 출력: ScreenSpec, trace_proposals, unresolved, change_summary —
 *       HTML 은 이 단계에서 출력하지 않음; 기록 항목: 프롬프트 템플릿·모델 식별자·입력 hash·원문 anchor·생성 결과;
 *       서버가 스키마와 참조 무결성을 재검사), 설계 §12 (잠긴 요소·동작, 허용 토큰), 설계 §9 (수정은 검증 가능한 변경 집합).
 */
import { z } from 'zod'
import { AnchorRef, ContentHash, ExternalId, InternalId, IsoDateTime, LocalId, NonEmptyText } from './common.js'
import { GenerationJobType } from './job.js'
import { DeviceProfile, RoleId, ShellId } from './screen.js'
import { CaseKind, ScreenSpec, Unresolved, indexScreenSpec } from './screen-spec.js'
import { TraceProposal } from './trace-link.js'

/** MVP 작업 유형 (설계 §3, §8: 신규/수정/참조 복제). */
export const GenerationTaskType = GenerationJobType.extract(['create', 'edit', 'clone_reference']).describe('MVP 작업 유형 (설계 §8 작업 구역)')

/** 산출 종류 (설계 §8 산출 구역). html 은 없다. */
export const GenerationOutputKind = z.enum(['screen_spec', 'trace_proposals', 'unresolved', 'change_summary']).describe('산출 종류 (설계 §8)')

/** 입력 폼 (설계 §8 표의 7구역). */
export const GenerationRequest = z
  .strictObject({
    target: z
      .strictObject({
        project_id: InternalId,
        screen_external_id: ExternalId.optional().describe('기존 화면 ID (수정·복제 원본)'),
        portal: NonEmptyText.describe('포털'),
        device: DeviceProfile,
        roles: z.array(RoleId).min(1).describe('사용자 역할'),
      })
      .describe('대상: 프로젝트, 기존 화면 ID, 포털, PC/모바일, 사용자 역할'),
    task: z
      .strictObject({
        type: GenerationTaskType,
        purpose: NonEmptyText.describe('목적'),
        change_scope: z.string().optional().describe('변경 범위'),
      })
      .describe('작업: 신규/수정/참조 복제, 목적, 변경 범위'),
    baseline: z
      .strictObject({
        baseline_id: ExternalId,
        requirement_ids: z.array(ExternalId).describe('승인 REQ'),
        criterion_ids: z.array(ExternalId).describe('승인 수용조건'),
        policy_ids: z.array(z.string()).default([]).describe('정책'),
        ia_node_ids: z.array(InternalId).default([]).describe('IA'),
        term_ids: z.array(InternalId).default([]).describe('용어'),
      })
      .describe('기준: baseline ID, 승인 REQ·수용조건, 정책·IA·용어'),
    references: z
      .strictObject({
        golden_screen_revision_ids: z.array(InternalId).default([]).describe('golden 화면의 승인 버전'),
        shell: ShellId.optional(),
        design_tokens: z.array(z.string()).default([]).describe('허용 디자인 토큰 (설계 §12)'),
      })
      .describe('참고: golden 화면의 승인 버전, shell, 디자인 토큰'),
    cases: z
      .array(
        z.strictObject({
          kind: CaseKind,
          condition: z.string().optional().describe('적용 조건'),
        }),
      )
      .describe('CASE: 정상·빈값·오류·권한·처리중 등 적용 조건'),
    constraints: z
      .strictObject({
        locked_element_ids: z.array(LocalId).default([]).describe('변경 금지 요소 (설계 §12 잠긴 요소)'),
        locked_action_ids: z.array(LocalId).default([]).describe('변경 금지 동작'),
        data_contracts: z.array(z.string()).default([]).describe('데이터 계약'),
        preserved_behaviors: z.array(z.string()).default([]).describe('유지할 동작'),
      })
      .describe('유지 조건: 변경 금지 요소, 데이터 계약, 유지할 동작'),
    output: z
      .strictObject({
        kinds: z.array(GenerationOutputKind).min(1).describe('요청 산출 (설계 §8: 화면명세 JSON, 근거 연결, 질문·가정·충돌)'),
      })
      .describe('산출'),
  })
  .superRefine((req, ctx) => {
    if (req.task.type === 'edit' && req.target.screen_external_id === undefined) {
      ctx.addIssue({ code: 'custom', path: ['target', 'screen_external_id'], message: '수정 작업에는 기존 화면 ID 가 필요하다 (설계 §8 대상 구역)' })
    }
    if (req.task.type === 'clone_reference' && req.references.golden_screen_revision_ids.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['references', 'golden_screen_revision_ids'], message: '참조 복제에는 golden 화면의 승인 버전이 필요하다 (설계 §8 참고 구역)' })
    }
    if (req.task.type === 'edit' && req.constraints.locked_element_ids.length === 0 && req.task.change_scope === undefined) {
      ctx.addIssue({ code: 'custom', path: ['task', 'change_scope'], message: '수정 작업에는 변경 범위 또는 잠긴 요소가 필요하다 (설계 §9 무관 변경 검사)' })
    }
  })
  .describe('GenerationRequest — 입력 폼 7구역 (설계 §8)')

/** 변경 요약 (설계 §8 change_summary, §9 검증 가능한 변경 집합). */
export const ChangeSummary = z
  .strictObject({
    summary: NonEmptyText.describe('사람이 읽는 변경 요약'),
    added_ids: z.array(LocalId).default([]).describe('추가한 요소/동작/CASE'),
    changed_ids: z.array(LocalId).default([]),
    removed_ids: z.array(LocalId).default([]),
    locked_violations: z.array(LocalId).default([]).describe('잠긴 요소를 건드렸다면 여기 적는다 (있으면 V5 회귀 실패 대상)'),
  })
  .describe('change_summary (설계 §8)')

/** 모델 출력 계약 — 서버가 재검사한다. 최상위 키는 이 넷뿐이며 html 이 있으면 실패한다 (설계 §8). */
export const GenerationOutput = z
  .strictObject({
    screen_spec: ScreenSpec,
    trace_proposals: z.array(TraceProposal),
    unresolved: z.array(Unresolved).describe('빠진 근거·질문·가정·충돌 (설계 §8)'),
    change_summary: ChangeSummary,
  })
  .superRefine((out, ctx) => {
    const { index } = indexScreenSpec(out.screen_spec)
    out.trace_proposals.forEach((p, i) => {
      const id = p.element_or_action_id
      if (!index.elements.has(id) && !index.sections.has(id) && !index.actions.has(id)) {
        ctx.addIssue({ code: 'custom', path: ['trace_proposals', i, 'element_or_action_id'], message: `제안이 가리키는 요소/동작이 화면명세에 없다: ${id}` })
      }
      if (!index.criteria.has(p.criterion_id)) {
        ctx.addIssue({ code: 'custom', path: ['trace_proposals', i, 'criterion_id'], message: `제안의 수용조건이 화면명세 requirements 에 없다: ${p.criterion_id}` })
      }
      if (!index.requirements.has(p.requirement_id)) {
        ctx.addIssue({ code: 'custom', path: ['trace_proposals', i, 'requirement_id'], message: `제안의 요구사항이 화면명세 requirements 에 없다: ${p.requirement_id}` })
      }
    })
  })
  .describe('GenerationOutput (설계 §8)')

/** 생성 기록 — 템플릿·모델 식별자·입력 hash·원문 anchor·결과 (설계 §8). */
export const GenerationRecord = z
  .object({
    id: InternalId,
    generation_job_id: InternalId,
    prompt_template_id: InternalId,
    prompt_template_version: NonEmptyText,
    model_id: NonEmptyText.describe('모델 식별자'),
    input_hash: ContentHash.describe('조립된 프롬프트 입력 hash'),
    context_anchors: z.array(AnchorRef).describe('문맥에 넣은 원문 anchor (설계 §8: 문맥 목록에 원문 위치와 버전 포함)'),
    output_hash: ContentHash.optional().describe('생성 결과 hash (실패면 없음)'),
    output: GenerationOutput.optional().describe('검사에 통과한 결과'),
    raw_output_ref: z.string().optional().describe('스키마 실패 시 원본 출력 저장 위치 (다시 보여주지 않고 오류 전달용)'),
    recorded_at: IsoDateTime,
  })
  .describe('GenerationRecord (설계 §8)')

export type GenerationTaskType = z.infer<typeof GenerationTaskType>
export type GenerationRequest = z.infer<typeof GenerationRequest>
export type GenerationRequestInput = z.input<typeof GenerationRequest>
export type ChangeSummary = z.infer<typeof ChangeSummary>
export type GenerationOutput = z.infer<typeof GenerationOutput>
export type GenerationOutputInput = z.input<typeof GenerationOutput>
export type GenerationRecord = z.infer<typeof GenerationRecord>
