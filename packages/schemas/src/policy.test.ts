import { describe, expect, it } from 'vitest'
import { StateModel } from './policy.js'
import { issuePaths } from './test-utils.js'

const UUID = '11111111-1111-4111-8111-111111111111'
const model = (name: string, origin: string, values: string[]) => ({
  id: UUID, project_id: UUID, name, origin, scope: '주문', values: values.map((v) => ({ value: v, label: v })), evidence: [{ anchor_id: UUID }], status: 'proposed',
})

describe('업무 상태 모델 (설계 §6 StateModel, 보고서 §4)', () => {
  it('출처 체계마다 별도 레코드로 두며 값이 겹쳐도 서로 합치지 않는다', () => {
    const a = StateModel.safeParse(model('주문 상태(더미 규칙)', '기존 더미 규칙', ['ORDERED', 'SHIPPED']))
    const b = StateModel.safeParse(model('주문 상태(용어집 개정)', '개정 용어집', ['ORDERED', 'DELIVERED', 'CANCELLED']))
    expect(a.success && b.success).toBe(true)
    if (a.success && b.success) {
      expect(a.data.values.map((v) => v.value)).not.toEqual(b.data.values.map((v) => v.value))
      expect(a.data.origin).not.toBe(b.data.origin)
    }
  })

  it('전이가 값 목록에 없는 상태를 가리키거나 값이 중복되면 실패한다', () => {
    const bad = StateModel.safeParse({ ...model('x', 'y', ['A', 'A']), transitions: [{ from: 'A', to: 'Z' }] })
    expect(issuePaths(bad)).toEqual(expect.arrayContaining(['values.1.value', 'transitions.0.to']))
  })
})
