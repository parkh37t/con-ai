/**
 * @con-ai/worker-generation — 생성 파이프라인 (계약 §6) 과 저장 문서 형태 (계약 §1).
 * 실행: runGenerationJob(jobId, deps). 문맥 구성(buildGenerationContext)은 API 의 프롬프트 미리보기도 함께 쓴다.
 */
export * from './types.js'
export * from './documents.js'
export * from './errors.js'
export { sha256, specHash, stableStringify } from './hash.js'
export { MemoryStore } from './memory-store.js'
export { DEFAULT_ASSEMBLER, assembleForRequest, baselineIdOf, buildGenerationContext, revisionInstruction, toContextComment, type ContextBuildResult } from './context.js'
export { collectDummy, nextRevisionNo, rendererVersionOf, runGenerationJob } from './pipeline.js'
