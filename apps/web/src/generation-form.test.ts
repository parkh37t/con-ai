import { describe, expect, it } from 'vitest'
import { buildEditRequest, buildRequest, initialFormState, splitLines, splitRoles, toggleIn, validateForm } from './generation-form.js'

describe('initialFormState', () => {
  it('정상 CASE 기본 선택, 기기·기준 revision 은 화면에서', () => {
    const f = initialFormState({ device: 'mobile', current_revision_id: 'rev-1' })
    expect(f.cases).toEqual(['normal'])
    expect(f.device).toBe('mobile')
    expect(f.base_revision_id).toBe('rev-1')
    expect(f.task_type).toBe('create')
    expect(initialFormState(null).device).toBe('desktop')
    expect(initialFormState(null).base_revision_id).toBe('')
  })
})

describe('splitLines / splitRoles / toggleIn', () => {
  it('유지 조건은 줄 단위, 빈 줄 제거', () => {
    expect(splitLines(' 검색 영역 유지 \n\n\r\n정렬 기본값 유지\n')).toEqual(['검색 영역 유지', '정렬 기본값 유지'])
    expect(splitLines('')).toEqual([])
  })
  it('역할은 쉼표·공백·줄바꿈으로 나누고 중복 제거', () => {
    expect(splitRoles('partner, admin admin\nbuyer')).toEqual(['partner', 'admin', 'buyer'])
    expect(splitRoles('')).toEqual([])
  })
  it('toggleIn 은 순서를 유지하며 켜고 끈다', () => {
    expect(toggleIn(['a', 'b'], 'c', true)).toEqual(['a', 'b', 'c'])
    expect(toggleIn(['a', 'b'], 'a', false)).toEqual(['b'])
    expect(toggleIn(['a'], 'a', true)).toEqual(['a'])
    expect(toggleIn(['a'], 'z', false)).toEqual(['a'])
  })
})

describe('validateForm', () => {
  const ok = { ...initialFormState(null), purpose: '견적 목록 조회' }
  it('목적과 CASE 가 있으면 통과', () => {
    expect(validateForm(ok)).toEqual([])
  })
  it('목적이 없으면 직접 프롬프트로 대신할 수 있다', () => {
    expect(validateForm({ ...ok, purpose: '' })).toEqual(['목적을 입력하거나 직접 프롬프트를 쓰세요.'])
    expect(validateForm({ ...ok, purpose: '', use_prompt_override: true, prompt_override: '목록 화면을 만들어라' })).toEqual([])
    expect(validateForm({ ...ok, use_prompt_override: true, prompt_override: '  ' })).toEqual(['직접 프롬프트를 켰지만 내용이 비어 있습니다.'])
  })
  it('CASE 0개, 기준 revision 없는 수정, 참고 없는 참조 복제는 오류', () => {
    expect(validateForm({ ...ok, cases: [] })).toEqual(['CASE 를 최소 1개 선택하세요 (정상 CASE 권장).'])
    expect(validateForm({ ...ok, task_type: 'edit', base_revision_id: '' })[0]).toContain('기준 revision')
    expect(validateForm({ ...ok, task_type: 'clone_reference', reference_ids: [] })[0]).toContain('참고 화면')
  })
})

describe('buildRequest — 폼 → SliceGenerationRequest (계약 §2)', () => {
  const form = {
    ...initialFormState({ device: 'desktop', current_revision_id: 'rev-1' }),
    purpose: ' 견적 목록 ',
    scope: '',
    requirement_ids: ['req-uuid-1'],
    criterion_ids: ['AC-001', 'AC-002'],
    reference_ids: ['ref-list'],
    cases: ['error', 'normal'] as const,
    keep_conditions_text: '검색 영역 유지\n\n기본 정렬 유지',
    roles_text: 'partner, admin',
  }

  it('선택 필드는 값이 있을 때만 넣고 CASE 는 정해진 순서로 정렬한다', () => {
    const req = buildRequest('screen-1', { ...form, cases: [...form.cases] })
    expect(req).toEqual({
      screen_id: 'screen-1',
      task_type: 'create',
      purpose: '견적 목록',
      requirement_ids: ['req-uuid-1'],
      criterion_ids: ['AC-001', 'AC-002'],
      reference_ids: ['ref-list'],
      cases: ['normal', 'error'],
      keep_conditions: ['검색 영역 유지', '기본 정렬 유지'],
      roles: ['partner', 'admin'],
      device: 'desktop',
    })
    expect('scope' in req).toBe(false)
    expect('base_revision_id' in req).toBe(false)
    expect('prompt_override' in req).toBe(false)
  })

  it('수정이면 base_revision_id, 직접 프롬프트가 켜져 있으면 prompt_override, 코멘트가 있으면 comment_ids', () => {
    const req = buildRequest('screen-1', { ...form, cases: [...form.cases], task_type: 'edit', scope: ' 검색 영역 ', use_prompt_override: true, prompt_override: ' 라벨을 바꿔라 ' }, { comment_ids: ['c1'] })
    expect(req.base_revision_id).toBe('rev-1')
    expect(req.scope).toBe('검색 영역')
    expect(req.prompt_override).toBe('라벨을 바꿔라')
    expect(req.comment_ids).toEqual(['c1'])
  })

  it('직접 프롬프트 토글이 꺼져 있으면 내용이 있어도 보내지 않는다', () => {
    const req = buildRequest('s', { ...form, cases: ['normal'], use_prompt_override: false, prompt_override: '무시' })
    expect('prompt_override' in req).toBe(false)
  })
})

describe('buildEditRequest — 검토 화면의 단건 수정', () => {
  it('기준 revision·코멘트·프롬프트를 고정하고 목적은 첫 줄', () => {
    const req = buildEditRequest({ screen_id: 's1', base_revision_id: 'rev-2', comment_ids: ['c1', 'c2'], prompt: '\n검색어 라벨을 "품목명"으로 바꾼다\n두 번째 줄', device: 'mobile', cases: ['empty', 'normal'], roles: ['partner'] })
    expect(req).toEqual({
      screen_id: 's1',
      task_type: 'edit',
      purpose: '검색어 라벨을 "품목명"으로 바꾼다',
      requirement_ids: [],
      criterion_ids: [],
      reference_ids: [],
      cases: ['normal', 'empty'],
      keep_conditions: [],
      roles: ['partner'],
      device: 'mobile',
      base_revision_id: 'rev-2',
      comment_ids: ['c1', 'c2'],
      prompt_override: '검색어 라벨을 "품목명"으로 바꾼다\n두 번째 줄',
    })
  })
  it('CASE 가 비면 normal, 긴 첫 줄은 120자로 자른다', () => {
    const req = buildEditRequest({ screen_id: 's1', base_revision_id: 'r', comment_ids: [], prompt: 'x'.repeat(200), device: 'desktop', cases: [] })
    expect(req.cases).toEqual(['normal'])
    expect(req.purpose).toHaveLength(120)
    expect(req.purpose.endsWith('...')).toBe(true)
  })
})
