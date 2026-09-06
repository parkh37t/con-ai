/**
 * `packages/model-adapter/src/structured-schema.ts` 를 다시 만든다.
 * 실행: `pnpm gen:schema` (저장소 루트에서). wire-schema.ts 를 고치면 반드시 다시 만든다.
 */
import { writeFileSync } from 'node:fs'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { WireOutput, WireRevisionDraft, structuredVariant } from '../src/wire-schema.js'

const screen = zodOutputFormat(structuredVariant(WireOutput) as never).schema
const draft = zodOutputFormat(structuredVariant(WireRevisionDraft) as never).schema

const header = `/**
 * 구조화 출력으로 **실제로 보내는 JSON Schema** — 생성물이다. 손으로 고치지 않는다.
 *
 * 왜 파일로 두나: 브라우저(apps/web)는 번들 크기 때문에 Anthropic SDK 를 넣지 않는다. 예전에는 같은 스키마를
 * 손으로 한 벌 더 적었는데, SDK 변환기가 구조화 출력이 받지 않는 것(enum·const·중첩 anyOf)을 설명으로 옮기는
 * 것을 사람이 따라 적을 수 없어 계속 어긋났고 실제 호출이 400 으로 죽었다. 그래서 한 벌만 두고 여기서 만든다.
 *
 * 다시 만들기: \`pnpm gen:schema\` (wire-schema.ts 를 고치면 반드시 다시 만든다).
 * structured-schema.test.ts 가 이 파일이 현재 wire 스키마와 같은지 매번 확인한다.
 */

export type StructuredJsonSchema = Record<string, unknown>

/** 생성·수정 작업의 모델 출력 전체 (WireOutput 을 structuredVariant 로 바꾼 것). */
export const SCREEN_OUTPUT_JSON_SCHEMA: StructuredJsonSchema = `

const body = header + JSON.stringify(screen, null, 2) + `\n\n/** 코멘트 → 수정 지시문 초안 (WireRevisionDraft). */\nexport const REVISION_DRAFT_JSON_SCHEMA: StructuredJsonSchema = ` + JSON.stringify(draft, null, 2) + '\n'

writeFileSync(new URL('../src/structured-schema.ts', import.meta.url), body)
console.log('생성 완료 — 화면 출력', JSON.stringify(screen).length, '바이트 / 수정 초안', JSON.stringify(draft).length, '바이트')
