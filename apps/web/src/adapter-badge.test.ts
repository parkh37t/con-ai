import { describe, expect, it } from 'vitest'
import { adapterBadgeText, credentialChipLabel, realModelHint } from './adapter-badge.js'

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
  it('브라우저 모드는 내 자격 증명으로 직접 호출한다고 표시하며, 종류를 섞지 않는다', () => {
    expect(adapterBadgeText({ adapter: 'anthropic', model: 'claude-opus-5', auth: 'token' }, { browser: true })).toBe('내 토큰으로 실제 호출 · claude-opus-5 · 토큰')
    // 예전에는 API 키인데도 「내 토큰으로 실제 호출 · … · API 키」 라고 적었고 이 테스트가 그 값을 고정했다.
    expect(adapterBadgeText({ adapter: 'anthropic', model: 'claude-opus-5', auth: 'api_key' }, { browser: true })).toBe('내 API 키로 실제 호출 · claude-opus-5 · API 키')
  })
})

describe('realModelHint — fixture 일 때만 안내', () => {
  it('fixture 면 .env 안내, anthropic·미확인이면 null', () => {
    expect(realModelHint({ adapter: 'fixture' })).toContain('MODEL_ADAPTER=anthropic')
    expect(realModelHint({ adapter: 'fixture' })).toContain('ANTHROPIC_AUTH_TOKEN')
    expect(realModelHint({ adapter: 'anthropic' })).toBeNull()
    expect(realModelHint(null)).toBeNull()
  })
  it('정적 배포(브라우저 모드)에서는 서버 .env 대신 자격 증명 칩을 안내한다', () => {
    const hint = realModelHint({ adapter: 'fixture' }, { demo: true })
    expect(hint).toContain('자격 증명 칩')
    expect(hint).not.toContain('MODEL_ADAPTER')
    // 더미인 것은 모델뿐이고 나머지는 실제로 돈다 — 「아무것도 안 돈다」로 읽히게 두지 않는다.
    expect(hint).toContain('더미 어댑터(fixture)')
    expect(hint).toContain('실제로 실행')
  })
})

/**
 * 자격 증명 칩 문구.
 *
 * 없을 때 「스냅샷 데모」라고 적던 때가 있었는데 사실이 아니었다 — 자격 증명이 없어도
 * 더미 어댑터가 명세를 쓰고 나머지 단계는 실제로 돈다. 테스트가 없어서 그 문구가 남아 있었다.
 */
describe('credentialChipLabel — 무엇이 명세를 쓰는지 적는다', () => {
  it('자격 증명이 없으면 «스냅샷» 이 아니라 더미 어댑터라고 적는다', () => {
    const label = credentialChipLabel(null)
    expect(label).toContain('더미 어댑터')
    expect(label).not.toContain('스냅샷')
  })

  it('있으면 종류와 끝 4자리만 적는다 (값 전체를 쓰지 않는다)', () => {
    expect(credentialChipLabel({ kind: 'token', label: '토큰', last4: '9abc', persist: false })).toBe('내 토큰 ····9abc')
    expect(credentialChipLabel({ kind: 'api_key', label: 'API 키', last4: '1234', persist: true })).toBe('내 API 키 ····1234')
  })
})

describe('realModelHint — 토큰을 먼저 안내한다', () => {
  it('서버 모드 안내가 MODEL_AUTH=token 과 발급 명령을 담는다', () => {
    const hint = realModelHint({ adapter: 'fixture' }) ?? ''
    expect(hint).toContain('MODEL_AUTH=token')
    expect(hint).toContain('claude setup-token')
    expect(hint.indexOf('MODEL_AUTH=token')).toBeLessThan(hint.indexOf('MODEL_AUTH=api_key'))
  })

  it('정적 배포 안내도 토큰 발급 명령을 담는다', () => {
    expect(realModelHint({ adapter: 'fixture' }, { demo: true }) ?? '').toContain('claude setup-token')
  })

  it('anthropic 이면 안내하지 않는다', () => {
    expect(realModelHint({ adapter: 'anthropic' })).toBeNull()
  })
})
