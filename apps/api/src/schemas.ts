/** API 요청 본문 스키마 (zod). 검증 실패는 400 과 이유로 돌려준다. */
import { z } from 'zod'
import type { SliceGenerationRequest } from '@con-ai/prompt-templates'

const NonEmpty = z.string().trim().min(1, '빈 문자열은 허용하지 않는다')

/** 계약 §2 SliceGenerationRequest. screen_id 는 경로 파라미터로 받으므로 본문에서는 선택이며, 있으면 경로와 같아야 한다. */
export const SliceGenerationRequestBody = z
  .strictObject({
    screen_id: z.string().optional(),
    task_type: z.enum(['create', 'edit', 'clone_reference']),
    purpose: NonEmpty.describe('변경 목적'),
    scope: z.string().optional(),
    requirement_ids: z.array(z.string()).default([]),
    criterion_ids: z.array(z.string()).default([]),
    reference_ids: z.array(z.string()).default([]),
    cases: z.array(z.enum(['normal', 'empty', 'error', 'permission', 'processing'])).default(['normal']),
    keep_conditions: z.array(z.string()).default([]),
    roles: z.array(z.string()).default([]),
    device: z.enum(['desktop', 'mobile']).default('desktop'),
    base_revision_id: z.string().optional(),
    comment_ids: z.array(z.string()).optional(),
    prompt_override: z.string().optional(),
  })
  .superRefine((body, ctx) => {
    if (body.task_type === 'clone_reference' && body.reference_ids.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['reference_ids'], message: '참조 복제에는 레퍼런스가 최소 1개 필요하다' })
    }
  })

export type SliceGenerationRequestBody = z.infer<typeof SliceGenerationRequestBody>

/** 경로의 screen_id 를 넣어 계약 타입으로 만든다. exactOptionalPropertyTypes 때문에 undefined 필드는 넣지 않는다. */
export function toSliceRequest(screenId: string, body: SliceGenerationRequestBody): SliceGenerationRequest {
  const req: SliceGenerationRequest = {
    screen_id: screenId,
    task_type: body.task_type,
    purpose: body.purpose,
    requirement_ids: body.requirement_ids,
    criterion_ids: body.criterion_ids,
    reference_ids: body.reference_ids,
    cases: body.cases,
    keep_conditions: body.keep_conditions,
    roles: body.roles,
    device: body.device,
  }
  if (body.scope !== undefined) req.scope = body.scope
  if (body.base_revision_id !== undefined) req.base_revision_id = body.base_revision_id
  if (body.comment_ids !== undefined) req.comment_ids = body.comment_ids
  if (body.prompt_override !== undefined) req.prompt_override = body.prompt_override
  return req
}

/**
 * 화면 생성 (한 줄 입력 → 화면설계서). 외부 ID 는 서버가 자동 부여하므로 본문에 받지 않는다.
 * `sample_from` 은 예시 더미데이터를 복제해 올 레퍼런스 id (선택).
 */
export const ScreenCreateBody = z.strictObject({
  title: NonEmpty.max(120, '제목은 120자 이하여야 한다'),
  device: z.enum(['desktop', 'mobile']).default('desktop'),
  shell: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*-(?:page|popup)$/, 'shell 은 `<포털>-page` 또는 `<포털>-popup` 형식이어야 한다')
    .optional(),
  sample_from: z.string().optional(),
})
export type ScreenCreateBody = z.infer<typeof ScreenCreateBody>

/** 화면 제목 수정 — 외부 ID·별칭·상태는 바꾸지 않는다 (개명은 별도 작업, CLAUDE.md ID 규칙). */
export const ScreenPatchBody = z.strictObject({
  title: NonEmpty.max(120, '제목은 120자 이하여야 한다'),
})
export type ScreenPatchBody = z.infer<typeof ScreenPatchBody>

export const CommentBody = z.strictObject({
  target: z.enum(['screen', 'description']),
  element_id: z.string().optional(),
  section_id: z.string().optional(),
  case_id: z.string().optional(),
  display_no: z.string().optional(),
  author: NonEmpty,
  role: z.enum(['planner', 'designer', 'publisher', 'developer', 'client']),
  text: NonEmpty,
  blocking: z.boolean().default(false),
})
export type CommentBody = z.infer<typeof CommentBody>

export const CommentPatchBody = z.strictObject({
  status: z.enum(['open', 'resolved', 'wont_fix']),
  revision: z.int().min(1).describe('클라이언트가 본 문서 revision (설계 §11, §13)'),
})
export type CommentPatchBody = z.infer<typeof CommentPatchBody>

export const RevisionPromptBody = z.strictObject({
  comment_ids: z.array(z.string()).min(1, '코멘트를 최소 1개 골라야 한다'),
})
export type RevisionPromptBody = z.infer<typeof RevisionPromptBody>

export const ApprovalBody = z.strictObject({
  revision_id: NonEmpty,
  approver: NonEmpty,
  /** 승인자가 본 artifact hash (선택). 있으면 저장된 hash 와 정확히 같아야 한다. */
  artifact_hash: z.string().optional(),
  note: z.string().optional(),
})
export type ApprovalBody = z.infer<typeof ApprovalBody>

/** 계약 §12: AS-IS 분석 대상 URL — http/https 만, 최대 2000자. */
const AsisUrl = z
  .string()
  .trim()
  .min(1, '빈 문자열은 허용하지 않는다')
  .max(2000, 'URL 은 2000자 이하여야 한다')
  .refine((value) => {
    try {
      const u = new URL(value)
      return u.protocol === 'http:' || u.protocol === 'https:'
    } catch {
      return false
    }
  }, 'http/https URL 만 허용한다')

export const AsisCreateBody = z.strictObject({
  url: AsisUrl,
  note: z.string().optional(),
})
export type AsisCreateBody = z.infer<typeof AsisCreateBody>

/** 계약 §12: 페인포인트 채택/거부. revision 은 클라이언트가 본 asis_analysis 문서 revision (오래된 저장 거부). */
export const AsisPainPointPatchBody = z.strictObject({
  status: z.enum(['proposed', 'adopted', 'rejected']),
  revision: z.int().min(1).describe('클라이언트가 본 문서 revision (설계 §11)'),
})
export type AsisPainPointPatchBody = z.infer<typeof AsisPainPointPatchBody>
