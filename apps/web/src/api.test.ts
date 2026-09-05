import { describe, expect, it } from 'vitest'
import { ApiError, errorMessage, errorReasons, extractError, normalizeReasons } from './api.js'

describe('normalizeReasons — 거부 이유 표준화', () => {
  it('문자열·RuleReason·zod issue 형태를 문자열 목록으로 만든다', () => {
    expect(normalizeReasons(['a', { code: 'approval.hash_mismatch', message: 'hash 불일치' }, { message: '메시지만' }, { path: ['sections', 0, 'id'], message: '중복' }])).toEqual([
      'a',
      '[approval.hash_mismatch] hash 불일치',
      '메시지만',
      'sections.0.id: 중복',
    ])
  })
  it('단일 문자열·null·빈 값·의미 없는 항목 처리', () => {
    expect(normalizeReasons('하나')).toEqual(['하나'])
    expect(normalizeReasons(undefined)).toEqual([])
    expect(normalizeReasons(null)).toEqual([])
    expect(normalizeReasons(['', '  ', 42, {}])).toEqual([])
  })
})

describe('extractError — 오류 본문 해석', () => {
  it('{error} / {message} / {reasons} 를 읽고 HTTP 상태를 붙인다', () => {
    expect(extractError(400, { error: '승인 불가', reasons: [{ code: 'x', message: 'y' }] }, '기본')).toEqual({ message: '승인 불가 (HTTP 400)', reasons: ['[x] y'] })
    expect(extractError(500, { message: '내부 오류' }, '기본')).toEqual({ message: '내부 오류 (HTTP 500)', reasons: [] })
    expect(extractError(404, {}, '기본')).toEqual({ message: '기본 (HTTP 404)', reasons: [] })
  })
  it('본문이 문자열이면 그대로, 없으면 기본 문구', () => {
    expect(extractError(502, 'Bad Gateway', '기본')).toEqual({ message: 'Bad Gateway', reasons: [] })
    expect(extractError(503, undefined, '기본')).toEqual({ message: '기본 (HTTP 503)', reasons: [] })
  })
  it('reasons 가 없고 issues/details 만 있어도 모은다', () => {
    expect(extractError(422, { error: '스키마', issues: [{ path: ['a'], message: 'm' }], details: ['d'] }, '기본').reasons).toEqual(['a: m', 'd'])
  })
})

describe('ApiError / errorMessage / errorReasons', () => {
  it('상태·이유를 보존한다', () => {
    const e = new ApiError('/api/x', 400, '실패', ['r1'])
    expect(e.status).toBe(400)
    expect(e.reasons).toEqual(['r1'])
    expect(errorMessage(e)).toBe('실패')
    expect(errorReasons(e)).toEqual(['r1'])
    expect(errorMessage(new Error('e'))).toBe('e')
    expect(errorMessage('문자열')).toBe('문자열')
    expect(errorReasons(new Error('e'))).toEqual([])
  })
})
