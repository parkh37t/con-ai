import { describe, expect, it } from 'vitest'
import { adapterBadgeText, realModelHint } from './adapter-badge.js'

describe('adapterBadgeText — 어댑터 배지 문구', () => {
  it('anthropic 은 모델과 인증 방식을 붙인다', () => {
    expect(adapterBadgeText({ adapter: 'anthropic', model: 'claude-opus-5', auth: 'api_key' })).toBe('anthropic · claude-opus-5 · API 키')
    expect(adapterBadgeText({ adapter: 'anthropic', model: 'claude-opus-5', auth: 'token' })).toBe('anthropic · claude-opus-5 · 토큰')
    expect(adapterBadgeText({ adapter: 'anthropic', model: 'claude-opus-5', auth: 'profile' })).toBe('anthropic · claude-opus-5 · 프로파일')
    expect(adapterBadgeText({ adapter: 'anthropic', model: 'claude-opus-5', auth: 'none' })).toBe('anthropic · claude-opus-5 · 인증 없음')
  })
  it('auth 가 없거나 모르는 값이면(구버전 API) 인증 표시를 생략한다', () => {
    expect(adapterBadgeText({ adapter: 'anthropic', model: 'claude-opus-5' })).toBe('anthropic · claude-opus-5')
    expect(adapterBadgeText({ adapter: 'anthropic', model: 'claude-opus-5', auth: 'oauth' as 'token' })).toBe('anthropic · claude-opus-5')
  })
  it('fixture 는 더미 어댑터 문구', () => {
    expect(adapterBadgeText({ adapter: 'fixture', model: 'fixture', auth: 'none' })).toBe('fixture 더미 어댑터(모델 호출 없음)')
  })
  it('브라우저 모드는 내 토큰으로 직접 호출한다고 표시한다', () => {
    expect(adapterBadgeText({ adapter: 'anthropic', model: 'claude-opus-5', auth: 'token' }, { browser: true })).toBe('내 토큰으로 실제 호출 · claude-opus-5 · 토큰')
    expect(adapterBadgeText({ adapter: 'anthropic', model: 'claude-opus-5', auth: 'api_key' }, { browser: true })).toBe('내 토큰으로 실제 호출 · claude-opus-5 · API 키')
  })
})

describe('realModelHint — fixture 일 때만 안내', () => {
  it('fixture 면 .env 안내, anthropic·미확인이면 null', () => {
    expect(realModelHint({ adapter: 'fixture' })).toContain('MODEL_ADAPTER=anthropic')
    expect(realModelHint({ adapter: 'fixture' })).toContain('ANTHROPIC_AUTH_TOKEN')
    expect(realModelHint({ adapter: 'anthropic' })).toBeNull()
    expect(realModelHint(null)).toBeNull()
  })
  it('정적 배포(브라우저 모드)에서는 서버 .env 대신 자격 증명 패널을 안내한다', () => {
    const hint = realModelHint({ adapter: 'fixture' }, { demo: true })
    expect(hint).toContain('자격 증명 패널')
    expect(hint).not.toContain('MODEL_ADAPTER')
  })
})
