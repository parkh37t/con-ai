import { describe, expect, it } from 'vitest'
import { FN_EXTERNAL_ID_PATTERN, FnExternalId, FunctionEntry, IA_EXTERNAL_ID_PATTERN, IaExternalId, IdAlias, IdIssuance } from './id-registry.js'
import { IANode } from './screen.js'

const UUID_A = '11111111-1111-4111-8111-111111111111'
const UUID_B = '22222222-2222-4222-8222-222222222222'
const UUID_P = '33333333-3333-4333-8333-333333333333'
const UUID_S = '44444444-4444-4444-8444-444444444444'
const AT = '2026-09-06T09:00:00Z'

function issuance() {
  return { by: '기획자', at: AT, reason: '갭 제안 승인' }
}

describe('IA 외부 ID 형식', () => {
  it.each(['IA-1', 'IA-1.1', 'IA-2.3.1', 'IA-10.2.30.4'])('%s 는 통과한다', (v) => {
    expect(IaExternalId.safeParse(v).success).toBe(true)
  })

  it.each([
    ['IA-', '번호가 없다'],
    ['IA-0', '자리 값은 1 부터'],
    ['IA-1.0', '중간 자리도 1 부터'],
    ['IA-1.', '마침표로 끝난다'],
    ['ia-1', '소문자 접두어'],
    ['IA1', '하이픈 없음'],
    ['IA-1-1', '구분자가 하이픈'],
    ['FN-1.1-01', '다른 계층의 ID'],
  ])('%s 는 거부한다 (%s)', (v) => {
    expect(IaExternalId.safeParse(v).success).toBe(false)
  })

  it('정규식을 직접 쓰는 곳(도메인 채번)도 같은 판정을 한다', () => {
    expect(IA_EXTERNAL_ID_PATTERN.test('IA-2.3.1')).toBe(true)
    expect(IA_EXTERNAL_ID_PATTERN.test('IA-2.3.')).toBe(false)
  })
})

describe('FN 외부 ID 형식', () => {
  it.each(['FN-1-01', 'FN-2.3.1-02', 'FN-10.2-99'])('%s 는 통과한다', (v) => {
    expect(FnExternalId.safeParse(v).success).toBe(true)
  })

  it.each([
    ['FN-2.3.1-2', '일련번호는 두 자리 고정 (산출물 형식 FN-2.3.1-02)'],
    ['FN-2.3.1-002', '세 자리'],
    ['FN-2.3.1', '일련번호 없음'],
    ['FN--01', '계층 번호 없음'],
    ['IA-2.3.1', '다른 계층의 ID'],
  ])('%s 는 거부한다 (%s)', (v) => {
    expect(FnExternalId.safeParse(v).success).toBe(false)
  })

  it('정규식을 직접 쓰는 곳도 같은 판정을 한다', () => {
    expect(FN_EXTERNAL_ID_PATTERN.test('FN-2.3.1-02')).toBe(true)
    expect(FN_EXTERNAL_ID_PATTERN.test('FN-2.3.1-2')).toBe(false)
  })
})

describe('IdIssuance — 사람 없는 발번은 만들 수 없다', () => {
  it('행위자·시각·사유가 모두 있으면 통과한다', () => {
    expect(IdIssuance.safeParse(issuance()).success).toBe(true)
  })

  it.each([
    ['by', { at: AT, reason: 'r' }],
    ['at', { by: '기획자', reason: 'r' }],
    ['reason', { by: '기획자', at: AT }],
  ])('%s 가 없으면 거부한다', (_field, value) => {
    expect(IdIssuance.safeParse(value).success).toBe(false)
  })

  it('사유가 공백만이면 거부한다 (형식만 채운 발번을 막는다)', () => {
    expect(IdIssuance.safeParse({ by: '기획자', at: AT, reason: '   ' }).success).toBe(false)
  })

  it('행위자가 빈 문자열이면 거부한다', () => {
    expect(IdIssuance.safeParse({ by: '', at: AT, reason: 'r' }).success).toBe(false)
  })

  it('시각이 ISO 8601 이 아니면 거부한다', () => {
    expect(IdIssuance.safeParse({ by: '기획자', at: '2026-09-06', reason: 'r' }).success).toBe(false)
  })
})

describe('IdAlias — 개명은 사유와 행위자를 남긴다', () => {
  it('사유·행위자·시작 시각이 있으면 통과한다', () => {
    expect(IdAlias.safeParse({ external_id: 'IA-1.1', valid_from: AT, reason: '메뉴 재편', by: '기획자' }).success).toBe(true)
  })

  it('사유가 없으면 거부한다', () => {
    expect(IdAlias.safeParse({ external_id: 'IA-1.1', valid_from: AT, by: '기획자' }).success).toBe(false)
  })
})

describe('FunctionEntry', () => {
  const base = { id: UUID_A, name: '견적 목록 조회' }

  it('발번 전에는 external_id 없이 통과한다 (미발번은 정상 상태다)', () => {
    const parsed = FunctionEntry.safeParse(base)
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.kind).toBe('normal')
  })

  it('외부 ID 가 있는데 발번 기록이 없으면 거부한다', () => {
    expect(FunctionEntry.safeParse({ ...base, external_id: 'FN-1.1.1-01' }).success).toBe(false)
  })

  it('외부 ID + 발번 기록이면 통과한다', () => {
    expect(FunctionEntry.safeParse({ ...base, external_id: 'FN-1.1.1-01', issued: issuance() }).success).toBe(true)
  })

  it('예외 기능은 정상 기능을 가리켜야 한다', () => {
    expect(FunctionEntry.safeParse({ ...base, kind: 'exception' }).success).toBe(false)
    expect(FunctionEntry.safeParse({ ...base, kind: 'exception', base_function_id: UUID_B }).success).toBe(true)
  })

  it('정상 기능은 예외 참조를 갖지 않는다', () => {
    expect(FunctionEntry.safeParse({ ...base, kind: 'normal', base_function_id: UUID_B }).success).toBe(false)
  })

  it('자기 자신의 예외일 수 없다', () => {
    expect(FunctionEntry.safeParse({ ...base, kind: 'exception', base_function_id: UUID_A }).success).toBe(false)
  })
})

describe('IANode 추적 체인 확장', () => {
  const node = { id: UUID_A, project_id: UUID_P, parent_id: null, name: '견적 목록', order: 0, portal: '파트너 포털', kind: 'screen' as const, screen_plan_id: UUID_S }

  it('추가 필드가 하나도 없어도 통과한다 (기존 시드 무손상)', () => {
    expect(IANode.safeParse(node).success).toBe(true)
  })

  it('외부 ID 가 있는데 발번 기록이 없으면 거부한다', () => {
    expect(IANode.safeParse({ ...node, external_id: 'IA-1.1.1' }).success).toBe(false)
  })

  it('FN 계층부가 소속 IA 번호와 다르면 거부한다', () => {
    const bad = {
      ...node,
      external_id: 'IA-1.1.1',
      issued: issuance(),
      functions: [{ id: UUID_B, name: '조회', external_id: 'FN-2.3.1-01', issued: issuance() }],
    }
    const parsed = IANode.safeParse(bad)
    expect(parsed.success).toBe(false)
    if (!parsed.success) expect(parsed.error.issues.some((i) => i.message.includes('계층부'))).toBe(true)
  })

  it('FN 계층부가 소속 IA 번호와 같으면 통과한다', () => {
    const ok = {
      ...node,
      external_id: 'IA-1.1.1',
      issued: issuance(),
      functions: [{ id: UUID_B, name: '조회', external_id: 'FN-1.1.1-01', issued: issuance() }],
    }
    expect(IANode.safeParse(ok).success).toBe(true)
  })

  it('같은 노드 안에서 FN 외부 ID 가 중복이면 거부한다', () => {
    const dup = {
      ...node,
      external_id: 'IA-1.1.1',
      issued: issuance(),
      functions: [
        { id: UUID_B, name: '조회', external_id: 'FN-1.1.1-01', issued: issuance() },
        { id: UUID_S, name: '검색', external_id: 'FN-1.1.1-01', issued: issuance() },
      ],
    }
    expect(IANode.safeParse(dup).success).toBe(false)
  })

  it('예외 기능이 가리키는 정상 기능이 같은 노드에 없으면 거부한다 (FN 은 IA 1개에만 소속)', () => {
    const orphan = { ...node, functions: [{ id: UUID_B, name: '조회 실패', kind: 'exception' as const, base_function_id: UUID_S }] }
    expect(IANode.safeParse(orphan).success).toBe(false)
  })

  it('요구사항 연결과 AS-IS 대응 표기를 담을 수 있다', () => {
    const linked = { ...node, requirement_ids: ['REQ-QT-001', 'REQ-QT-004'], asis_ref: '레거시 /quote/list', change_reason: 'AS-IS 페인포인트 채택' }
    const parsed = IANode.safeParse(linked)
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.requirement_ids).toEqual(['REQ-QT-001', 'REQ-QT-004'])
  })

  it('카테고리 노드 규칙은 그대로다', () => {
    expect(IANode.safeParse({ ...node, kind: 'category', screen_plan_id: UUID_S }).success).toBe(false)
  })
})
