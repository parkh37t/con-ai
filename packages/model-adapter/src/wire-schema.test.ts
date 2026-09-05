import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { GenerationOutput, ScreenSpecShape, type GenerationOutputInput } from '@con-ai/schemas'
import { describe, expect, it } from 'vitest'
import { sampleWireOutput } from './test-fixtures.js'
import { toGenerationOutputInput, WireOutput, WireRevisionDraft, WireScreenSpec } from './wire-schema.js'

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
