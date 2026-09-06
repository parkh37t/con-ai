/**
 * 구조화 출력 JSON Schema 생성물 검사.
 *
 * 이 검사가 없어서 실제 모델 호출이 두 번 죽었다.
 * 1) 선택 파라미터가 41개여서 API 가 거부했다 (상한 24).
 * 2) 손으로 적은 브라우저 스키마가 SDK 변환기와 달랐다 — 변환기는 구조화 출력이 받지 않는 것
 *    (`enum`·`const`·중첩 `anyOf`)을 설명으로 옮기는데, 사람이 그걸 따라 적을 수 없었다.
 *
 * 지금은 한 벌만 두고(`structured-schema.ts`) 서버·브라우저가 같이 쓴다. 이 검사는 그 한 벌이
 * **현재 wire 스키마와 같은지**, 그리고 **API 가 받지 않는 구조가 없는지** 를 본다.
 */
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { describe, expect, it } from 'vitest'
import { REVISION_DRAFT_JSON_SCHEMA, SCREEN_OUTPUT_JSON_SCHEMA } from './structured-schema.js'
import { countOptionalParameters, STRUCTURED_OUTPUT_OPTIONAL_LIMIT, structuredVariant, WireOutput, WireRevisionDraft } from './wire-schema.js'

const REGENERATE = '`pnpm gen:schema` 로 다시 만든다 (structured-schema.ts 는 생성물이라 손으로 고치지 않는다)'

describe('구조화 출력 스키마 생성물', () => {
  it('화면 출력 스키마가 현재 wire 스키마에서 만든 것과 같다', () => {
    const generated = zodOutputFormat(structuredVariant(WireOutput)).schema
    expect(SCREEN_OUTPUT_JSON_SCHEMA, REGENERATE).toEqual(generated)
  })

  it('수정 초안 스키마가 현재 wire 스키마에서 만든 것과 같다', () => {
    const generated = zodOutputFormat(structuredVariant(WireRevisionDraft)).schema
    expect(REVISION_DRAFT_JSON_SCHEMA, REGENERATE).toEqual(generated)
  })

  it('선택 파라미터가 상한(24) 이하다', () => {
    expect(countOptionalParameters(SCREEN_OUTPUT_JSON_SCHEMA)).toBeLessThanOrEqual(STRUCTURED_OUTPUT_OPTIONAL_LIMIT)
    expect(countOptionalParameters(REVISION_DRAFT_JSON_SCHEMA)).toBeLessThanOrEqual(STRUCTURED_OUTPUT_OPTIONAL_LIMIT)
  })

  /** 변환기가 걷어내는 것들. 하나라도 남아 있으면 API 가 400 으로 거부한다. */
  it('구조화 출력이 받지 않는 구조(enum · const · 중첩 anyOf)가 남아 있지 않다', () => {
    const found: string[] = []
    const walk = (node: unknown, path: string): void => {
      if (node === null || typeof node !== 'object') return
      if (Array.isArray(node)) {
        node.forEach((v, i) => walk(v, `${path}[${i}]`))
        return
      }
      const rec = node as Record<string, unknown>
      if ('enum' in rec) found.push(`enum @ ${path}`)
      if ('const' in rec) found.push(`const @ ${path}`)
      const branches = rec['anyOf']
      if (Array.isArray(branches)) {
        for (const [i, b] of branches.entries()) {
          if (b !== null && typeof b === 'object' && 'anyOf' in (b as Record<string, unknown>)) found.push(`중첩 anyOf @ ${path}.anyOf[${i}]`)
        }
      }
      for (const [k, v] of Object.entries(rec)) walk(v, `${path}.${k}`)
    }
    walk(SCREEN_OUTPUT_JSON_SCHEMA, 'screen')
    walk(REVISION_DRAFT_JSON_SCHEMA, 'draft')
    expect(found).toEqual([])
  })

  it('모든 object 는 additionalProperties:false 이고 모든 키가 required 다', () => {
    const problems: string[] = []
    const walk = (node: unknown, path: string): void => {
      if (node === null || typeof node !== 'object') return
      if (Array.isArray(node)) {
        node.forEach((v, i) => walk(v, `${path}[${i}]`))
        return
      }
      const rec = node as Record<string, unknown>
      if (rec['type'] === 'object') {
        if (rec['additionalProperties'] !== false) problems.push(`additionalProperties @ ${path}`)
        const props = Object.keys((rec['properties'] ?? {}) as Record<string, unknown>)
        const required = (rec['required'] ?? []) as string[]
        if (props.sort().join(',') !== [...required].sort().join(',')) problems.push(`required 불일치 @ ${path}`)
      }
      for (const [k, v] of Object.entries(rec)) walk(v, `${path}.${k}`)
    }
    walk(SCREEN_OUTPUT_JSON_SCHEMA, 'screen')
    expect(problems).toEqual([])
  })

  it('브라우저도 같은 한 벌을 쓴다 (손으로 적은 복사본을 두지 않는다)', async () => {
    // apps/web 은 SDK 를 번들에 넣지 않으므로 이 생성물을 그대로 가져다 쓴다.
    const browser = (await import('../../../apps/web/src/browser-run/anthropic.js')) as { SCREEN_OUTPUT_JSON_SCHEMA: unknown }
    expect(browser.SCREEN_OUTPUT_JSON_SCHEMA).toBe(SCREEN_OUTPUT_JSON_SCHEMA)
  })
})
