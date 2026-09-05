/**
 * @con-ai/prompt-templates — 버전 관리된 프롬프트 템플릿과 문맥 조립 (세로 조각 계약 §2, 설계 §8).
 * 운영 사용자가 보는 프롬프트 본문은 template-v1.ts, 조립 규칙은 assemble.ts 에 있다.
 */
export * from './types.js'
export { assemblePrompt, assembleRevisionPrompt } from './assemble.js'
export {
  TEMPLATE_VERSION,
  PROMPT_SECTIONS,
  OUTPUT_KINDS,
  TASK_TYPE_LABEL,
  CASE_LABEL,
  CONTRACT_LINES,
  MATERIALS_HEADING,
  MATERIALS_NOTICE,
  MATERIAL_BEGIN,
  MATERIAL_END,
  buildSystemPrompt,
} from './template-v1.js'
