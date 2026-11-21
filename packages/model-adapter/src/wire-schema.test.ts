import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { GenerationOutput, ScreenSpecShape, type GenerationOutputInput } from '@con-ai/schemas'
import { describe, expect, it } from 'vitest'
import { sampleWireOutput } from './test-fixtures.js'
import {
  countOptionalParameters,
  STRUCTURED_OUTPUT_OPTIONAL_LIMIT,
  stripNulls,
  structuredVariant,
  toGenerationOutputInput,
  WireElement,
  WireOutput,
  WirePainPointDraft,
  WireRevisionDraft,
  WireScreenSpec,
} from './wire-schema.js'

describe('wire 스키마 — 구조화 출력용 순수 zod 객체', () => {
  it('zodOutputFormat 이 WireOutput·WireRevisionDraft 를 JSON Schema 로 변환한다 (변환 실패 시 오류 메시지 보고)', () => {
    let format: ReturnType<typeof zodOutputFormat> | undefined
    try {
      format = zodOutputFormat(WireOutput)
    } catch (err) {
      throw new Error(`zodOutputFormat 변환 실패: ${err instanceof Error ? err.message : String(err)}`)
    }
    expect(format.type).toBe('json_schema')
    const schema = format.schema as { type: string; additionalProperties: boolean; required: string[]; properties: Record<string, unknown> }
    expect(schema.type).toBe('object')
    expect(schema.additionalProperties).toBe(false)
    expect(schema.required).toEqual(['screen_spec', 'trace_proposals', 'unresolved', 'change_summary'])
    expect(Object.keys(schema.properties)).not.toContain('html')
    const draft = zodOutputFormat(WireRevisionDraft).schema as { required: string[] }
    expect(draft.required).toEqual(['prompt', 'rationale'])
  })

  it('wire 스키마의 ScreenSpec 키가 schemas ScreenSpecShape 와 같다', () => {
    const wireKeys = Object.keys(WireScreenSpec.shape).sort()
    const shapeKeys = Object.keys(ScreenSpecShape.shape).sort()
    expect(wireKeys).toEqual(shapeKeys)
  })

  it('format.parse 가 모델 텍스트를 WireOutput 으로 읽고, 그 결과는 서버의 GenerationOutput(참조 검사 포함)을 통과한다', () => {
    const format = zodOutputFormat(WireOutput)
    const parsed = format.parse(JSON.stringify(sampleWireOutput()))
    const asInput: GenerationOutputInput = toGenerationOutputInput(parsed)
    const r = GenerationOutput.safeParse(asInput)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.trace_proposals[0]?.status).toBe('candidate')
  })

  it('wire 파싱은 구조만 본다 — 참조가 깨진 출력도 wire 는 통과시키고 서버 스키마가 거부한다', () => {
    const out = sampleWireOutput()
    out.screen_spec.locked_elements = ['ghost']
    expect(WireOutput.safeParse(out).success).toBe(true)
    const r = GenerationOutput.safeParse(toGenerationOutputInput(out))
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues.map((i) => i.path.join('.'))).toContain('screen_spec.locked_elements.0')
  })

  it('허용 컴포넌트·동작·CASE 값이 아닌 출력은 wire 에서 거부한다', () => {
    const out = sampleWireOutput()
    const first = out.screen_spec.sections[0]?.elements[0]
    if (first === undefined) throw new Error('테스트 데이터 오류')
    ;(first as { type: string }).type = 'iframe'
    const r = WireOutput.safeParse(out)
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]?.path.join('.')).toBe('screen_spec.sections.0.elements.0.type')
  })
})

/**
 * 구조화 출력의 선택 파라미터 상한 — 이 검사가 없어서 실제 모델 호출이 400 으로 죽었다.
 * (API: "Schemas contains too many optional parameters (41) … limit: 24")
 */
describe('구조화 출력 선택 파라미터 상한', () => {
  const cases = [
    ['WireOutput', WireOutput],
    ['WireRevisionDraft', WireRevisionDraft],
    ['WirePainPointDraft', WirePainPointDraft],
  ] as const

  it('원본 WireOutput 은 상한을 넘는다 — 그래서 그대로 보내면 안 된다', () => {
    expect(countOptionalParameters(zodOutputFormat(WireOutput).schema)).toBeGreaterThan(STRUCTURED_OUTPUT_OPTIONAL_LIMIT)
  })

  it.each(cases)('%s 를 변환해 보내면 선택 파라미터가 상한 이하다', (_name, schema) => {
    const converted = zodOutputFormat(structuredVariant(schema)).schema
    expect(countOptionalParameters(converted)).toBeLessThanOrEqual(STRUCTURED_OUTPUT_OPTIONAL_LIMIT)
  })

  it('변환해도 키는 하나도 잃지 않는다 (선택이 사라지는 것이 아니라 null 을 허용할 뿐)', () => {
    const converted = zodOutputFormat(structuredVariant(WireOutput)).schema as { properties: Record<string, unknown> }
    const spec = converted.properties['screen_spec'] as { properties: Record<string, unknown>; required: string[] }
    expect(Object.keys(spec.properties).sort()).toEqual(Object.keys(WireScreenSpec.shape).sort())
    expect(spec.required.sort()).toEqual(Object.keys(WireScreenSpec.shape).sort())
  })

  it('변환 스키마는 «해당 없음» 을 null 로 받아들이고, 키를 빠뜨리면 거부한다', () => {
    const variant = structuredVariant(WireElement)
    // 모델이 보내야 하는 모습 — 모든 키가 있고, 해당 없는 값은 null.
    const asModelSends = {
      id: 'quote_no',
      type: 'text-input',
      label: '견적번호',
      required: null,
      display_no: null,
      placeholder: null,
      options: null,
      columns: null,
      hero: null,
      stats: null,
      cards: null,
      default_sort: null,
      max_length: null,
      validations: null,
      trace: null,
      locked: null,
      note: null,
    }
    // 이 객체가 WireElement 의 «모든» 키를 덮는지 먼저 본다 — 키가 늘었는데 여기만 안 고치면 검사가 헛돈다.
    expect(Object.keys(asModelSends).sort()).toEqual(Object.keys(WireElement.shape).sort())
    expect(variant.safeParse(asModelSends).success).toBe(true)
    // 키를 빠뜨리면 거부한다 — 선택이 사라진 것이 아니라 «필수 + null 허용» 이 됐기 때문이다.
    const { note: _note, ...missingKey } = asModelSends
    expect(variant.safeParse(missingKey).success).toBe(false)
    // 원본 스키마는 null 을 거부한다 — 그래서 되읽기 전에 반드시 걷어내야 한다.
    expect(WireElement.safeParse(asModelSends).success).toBe(false)
    const stripped = WireElement.safeParse(stripNulls(asModelSends))
    expect(stripped.success).toBe(true)
    if (stripped.success) {
      expect(stripped.data.placeholder).toBeUndefined()
      expect(stripped.data.id).toBe('quote_no')
    }
  })

  it('null 을 걷어낸 출력은 서버 스키마(GenerationOutput)를 그대로 통과한다', () => {
    const withNulls = JSON.parse(JSON.stringify(sampleWireOutput())) as Record<string, unknown>
    const spec = withNulls['screen_spec'] as { sections: Array<{ elements: Array<Record<string, unknown>> }>; roles?: unknown }
    const el = spec.sections[0]?.elements[0]
    if (el === undefined) throw new Error('테스트 데이터 오류')
    el['placeholder'] = null
    el['columns'] = null
    spec.roles = null

    expect(WireOutput.safeParse(withNulls).success).toBe(false) // null 이 그대로면 못 읽는다
    const reread = WireOutput.safeParse(stripNulls(withNulls))
    expect(reread.success).toBe(true)
    if (reread.success) {
      expect(reread.data.screen_spec.sections[0]?.elements[0]?.placeholder).toBeUndefined()
      expect(GenerationOutput.safeParse(toGenerationOutputInput(reread.data)).success).toBe(true)
    }
  })

  it('배열 원소의 null 은 지우지 않는다 — 형식 오류를 조용히 없애지 않는다', () => {
    expect(stripNulls({ a: [1, null, 2] })).toEqual({ a: [1, null, 2] })
  })
})
