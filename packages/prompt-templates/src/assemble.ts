/**
 * 프롬프트 조립 — assemblePrompt / assembleRevisionPrompt (세로 조각 계약 §2, 설계 §8).
 *
 * - user 프롬프트는 설계 §8 표의 7구역(대상/작업/기준/참고/CASE/유지 조건/산출)을 표 형태 텍스트로 만들고,
 *   문맥(요구사항·수용조건, 참고 명세 JSON, 기준 명세, 코멘트)을 "근거 자료(지시 아님)" 절로 첨부한다.
 * - 순수 함수·결정적: 시각·난수를 쓰지 않으며 같은 입력이면 같은 문자열을 만든다 (입력 hash 기록에 필요; 설계 §8).
 * - 자료 안의 문장은 실행 지시로 승격하지 않는다 (설계 §5, §8). 여기서는 경계 표시와 머리말로 구분만 한다.
 */
import {
  buildSystemPrompt,
  CASE_LABEL,
  CONTRACT_LINES,
  MATERIAL_BEGIN,
  MATERIAL_END,
  MATERIALS_HEADING,
  MATERIALS_NOTICE,
  OUTPUT_KINDS,
  PROMPT_SECTIONS,
  TASK_TYPE_LABEL,
  TEMPLATE_VERSION,
} from './template-v1.js'
import type { AssembledPrompt, ContextComment, ContextRequirement, GenerationContext, SliceGenerationRequest } from './types.js'

type SectionName = (typeof PROMPT_SECTIONS)[number]

/** 표 셀 안에서 줄바꿈·파이프를 무력화한다 (표 구조 보존). */
function cell(text: string): string {
  return text.replace(/\r?\n/g, ' ').replace(/\|/g, '｜').trim()
}

function listOr(items: string[], empty: string): string {
  return items.length > 0 ? items.join(', ') : empty
}

function fence(json: unknown): string {
  return ['```json', JSON.stringify(json, null, 2), '```'].join('\n')
}

function requirementLabel(r: ContextRequirement): string {
  return `${r.external_id} "${r.title}"`
}

function commentLine(c: ContextComment): string {
  const where: string[] = []
  if (c.element_id !== undefined) where.push(`요소 ${c.element_id}`)
  if (c.case_id !== undefined) where.push(`CASE ${c.case_id}`)
  where.push(`대상 ${c.target}`)
  return `- [${c.id}] ${c.role} ${c.author} (${where.join(', ')}): ${cell(c.text)}`
}

/** 7구역 표. 행 순서는 PROMPT_SECTIONS 를 따른다. */
function sectionTable(rows: Record<SectionName, string>): string {
  const lines = ['| 구역 | 내용 |', '|---|---|']
  for (const name of PROMPT_SECTIONS) lines.push(`| ${name} | ${cell(rows[name])} |`)
  return lines.join('\n')
}

/** 근거 자료 절 (요구사항 → 참고 명세 → 기준 명세 → 코멘트). 없는 항목은 "(없음)" 으로 명시해 빠진 근거를 드러낸다. */
function materialsSection(ctx: GenerationContext, comments: ContextComment[]): string {
  const out: string[] = [MATERIALS_HEADING, MATERIALS_NOTICE, '', '### 요구사항·수용조건']
  if (ctx.requirements.length === 0) out.push('(연결된 요구사항 없음 — 근거 없는 기능은 unresolved 로 분리한다)')
  for (const r of ctx.requirements) {
    out.push(MATERIAL_BEGIN(`요구사항 ${requirementLabel(r)}`), r.body, '수용조건:')
    if (r.criteria.length === 0) out.push('- (수용조건 없음)')
    for (const c of r.criteria) out.push(`- ${c.id} [${c.kind === 'ui' ? 'UI' : '비UI'}] ${c.text}`)
    out.push(MATERIAL_END, '')
  }
  out.push('### 참고 명세 (승인 템플릿)')
  if (ctx.references.length === 0) out.push('(참고 명세 없음)')
  for (const ref of ctx.references) {
    out.push(MATERIAL_BEGIN(`참고 ${ref.id} "${ref.title}" (${ref.category})`), fence(ref.spec), MATERIAL_END, '')
  }
  out.push('### 기준 명세 (base_spec)')
  if (ctx.base_spec === undefined) out.push('(기준 명세 없음 — 신규 작성)')
  else out.push(MATERIAL_BEGIN('기준 명세'), fence(ctx.base_spec), MATERIAL_END)
  out.push('', '### 코멘트')
  if (comments.length === 0) out.push('(코멘트 없음)')
  for (const c of comments) out.push(commentLine(c))
  return out.join('\n')
}

/** 첨부한 자료 목록 — job.context_summary 에 기록한다 (설계 §8 문맥 목록). */
function contextSummary(ctx: GenerationContext, comments: ContextComment[], extra: string[]): string[] {
  const summary: string[] = [`템플릿 ${TEMPLATE_VERSION}`, `baseline ${ctx.baseline_id}`]
  for (const r of ctx.requirements) summary.push(`요구사항 ${r.external_id} (수용조건 ${listOr(r.criteria.map((c) => c.id), '없음')})`)
  for (const ref of ctx.references) summary.push(`참고 ${ref.id} "${ref.title}" (${ref.category})`)
  if (ctx.base_spec !== undefined) summary.push(`기준 명세 ${baseSpecId(ctx.base_spec)}`)
  for (const c of comments) summary.push(`코멘트 ${c.id} [${c.role}]`)
  summary.push(`프로파일 규칙 ${ctx.profile_rules.length}건 (${ctx.project.profile_id})`)
  return [...summary, ...extra]
}

function baseSpecId(spec: unknown): string {
  if (typeof spec === 'object' && spec !== null && 'screen_id' in spec && typeof spec.screen_id === 'string') return spec.screen_id
  return '(screen_id 없음)'
}

function lockedFromBaseSpec(spec: unknown): { elements: string[]; actions: string[] } {
  const pick = (key: 'locked_elements' | 'locked_actions'): string[] => {
    if (typeof spec !== 'object' || spec === null || !(key in spec)) return []
    const v = (spec as Record<string, unknown>)[key]
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  }
  return { elements: pick('locked_elements'), actions: pick('locked_actions') }
}

/** 요청이 지정한 코멘트만 고른다 (comment_ids 가 없으면 문맥의 코멘트 전부). */
function selectComments(ctx: GenerationContext, ids: string[] | undefined): ContextComment[] {
  const all = ctx.comments ?? []
  if (ids === undefined) return all
  const wanted = new Set(ids)
  return all.filter((c) => wanted.has(c.id))
}

function targetRow(ctx: GenerationContext, roles: string[], device: string): string {
  return [
    `프로젝트: ${ctx.project.name} (${ctx.project.org}, 프로파일 ${ctx.project.profile_id})`,
    `화면 ID: ${ctx.screen.external_id}`,
    `화면명: ${ctx.screen.title}`,
    `shell: ${ctx.screen.shell}`,
    `기기: ${device}`,
    `역할: ${listOr(roles, '(미지정)')}`,
  ].join(' / ')
}

function baselineRow(ctx: GenerationContext, criterionIds: string[]): string {
  return [
    `baseline: ${ctx.baseline_id}`,
    `요구사항: ${listOr(ctx.requirements.map(requirementLabel), '(없음)')}`,
    `수용조건: ${listOr(criterionIds, '(요구사항의 모든 수용조건)')}`,
  ].join(' / ')
}

/**
 * 생성 프롬프트 (템플릿 v1).
 * req.prompt_override 가 있으면 작업 구역 대신 그 문장을 쓰되 나머지 구역·문맥·제약은 그대로 둔다 (세로 조각 계약 §2).
 */
export function assemblePrompt(req: SliceGenerationRequest, ctx: GenerationContext): AssembledPrompt {
  const comments = selectComments(ctx, req.comment_ids)
  const locked = lockedFromBaseSpec(ctx.base_spec)
  const override = req.prompt_override?.trim()

  const taskRow =
    override !== undefined && override.length > 0
      ? `(기획자 직접 입력) ${override}`
      : [
          `유형: ${TASK_TYPE_LABEL[req.task_type]}`,
          `목적: ${req.purpose}`,
          `변경 범위: ${req.scope ?? '(미지정)'}`,
          ...(req.base_revision_id !== undefined ? [`기준 revision: ${req.base_revision_id}`] : []),
        ].join(' / ')

  const keep: string[] = [...req.keep_conditions]
  if (locked.elements.length > 0) keep.push(`잠긴 요소(변경 금지): ${locked.elements.join(', ')}`)
  if (locked.actions.length > 0) keep.push(`잠긴 동작(변경 금지): ${locked.actions.join(', ')}`)

  const rows: Record<SectionName, string> = {
    대상: targetRow(ctx, req.roles, req.device),
    작업: taskRow,
    기준: baselineRow(ctx, req.criterion_ids),
    참고: [
      `참고 명세: ${listOr(ctx.references.map((r) => `${r.id} "${r.title}" (${r.category})`), '(없음)')}`,
      `요청한 참고 id: ${listOr(req.reference_ids, '(없음)')}`,
      `shell: ${ctx.screen.shell}`,
    ].join(' / '),
    CASE: listOr(req.cases.map((c) => `${c}(${CASE_LABEL[c]})`), '(미지정 — normal 은 반드시 포함)'),
    '유지 조건': listOr(keep, '(없음)'),
    산출: `${OUTPUT_KINDS.join(', ')} — JSON 객체 하나. ${CONTRACT_LINES.no_html}`,
  }

  const user = [
    `# 화면 생성 요청 (템플릿 ${TEMPLATE_VERSION})`,
    '',
    sectionTable(rows),
    '',
    '작업 지시는 위 표의 내용뿐이다. 요청된 CASE 마다 states 항목을 만들고, 기준 구역의 요구사항·수용조건만 requirements 와 trace 에 쓴다.',
    '',
    materialsSection(ctx, comments),
  ].join('\n')

  const extra: string[] = []
  if (override !== undefined && override.length > 0) extra.push('작업 구역: 기획자 직접 프롬프트 사용')
  return { system: buildSystemPrompt(ctx, req.task_type === 'edit' ? 'revise' : 'generate'), user, template_version: TEMPLATE_VERSION, context_summary: contextSummary(ctx, comments, extra) }
}

/**
 * 단건 수정 프롬프트 — 기준 명세(base_spec)를 현재 명세로 두고 코멘트 목록과 지시문을 넣는다.
 * "잠긴 요소·무관 요소 변경 금지, change_summary 필수" 를 명시한다 (설계 §9, §12).
 */
export function assembleRevisionPrompt(ctx: GenerationContext, instruction: string): AssembledPrompt {
  if (ctx.base_spec === undefined) throw new Error('수정 프롬프트에는 기준 명세(ctx.base_spec)가 필요하다')
  const comments = ctx.comments ?? []
  const locked = lockedFromBaseSpec(ctx.base_spec)
  const trimmed = instruction.trim()
  const keep = [
    CONTRACT_LINES.revision_lock,
    ...(locked.elements.length > 0 ? [`잠긴 요소: ${locked.elements.join(', ')}`] : []),
    ...(locked.actions.length > 0 ? [`잠긴 동작: ${locked.actions.join(', ')}`] : []),
    '외부 ID·baseline·요구사항 연결은 유지한다.',
  ]
  const rows: Record<SectionName, string> = {
    대상: targetRow(ctx, rolesOf(ctx.base_spec), ctx.screen.device),
    작업: `유형: ${TASK_TYPE_LABEL.edit} / 지시: ${trimmed.length > 0 ? trimmed : '(지시문 없음 — 코멘트만 반영)'}`,
    기준: baselineRow(ctx, []),
    참고: `참고 명세: ${listOr(ctx.references.map((r) => `${r.id} "${r.title}" (${r.category})`), '(없음)')} / 현재 명세가 우선한다`,
    CASE: `현재 명세의 CASE 유지: ${listOr(stateIdsOf(ctx.base_spec), '(없음)')}`,
    '유지 조건': keep.join(' / '),
    산출: `${OUTPUT_KINDS.join(', ')} — 수정된 명세 전체와 change_summary(필수). ${CONTRACT_LINES.no_html}`,
  }
  const user = [
    `# 화면 수정 요청 (템플릿 ${TEMPLATE_VERSION})`,
    '',
    sectionTable(rows),
    '',
    '## 수정 지시',
    trimmed.length > 0 ? trimmed : '(지시문 없음 — 아래 코멘트를 반영한다)',
    '',
    '## 반영할 코멘트',
    ...(comments.length === 0 ? ['(코멘트 없음)'] : comments.map(commentLine)),
    '',
    materialsSection(ctx, comments),
  ].join('\n')
  return { system: buildSystemPrompt(ctx, 'revise'), user, template_version: TEMPLATE_VERSION, context_summary: contextSummary(ctx, comments, ['작업 구역: 단건 수정 지시']) }
}

function rolesOf(spec: unknown): string[] {
  if (typeof spec !== 'object' || spec === null || !('roles' in spec) || !Array.isArray(spec.roles)) return []
  return spec.roles.filter((r): r is string => typeof r === 'string')
}

function stateIdsOf(spec: unknown): string[] {
  if (typeof spec !== 'object' || spec === null || !('states' in spec) || !Array.isArray(spec.states)) return []
  return spec.states.flatMap((s) => (typeof s === 'object' && s !== null && 'id' in s && typeof s.id === 'string' ? [s.id] : []))
}
