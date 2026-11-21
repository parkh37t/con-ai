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
  it('fixture 면 .env 안내 — **claude_code 를 1순위로** 적는다', () => {
    const hint = realModelHint({ adapter: 'fixture' }) ?? ''
    // 구독 토큰 직접 호출(ANTHROPIC_AUTH_TOKEN)을 권하던 문구였다. 그 경로는 약관상 쓸 수 없다.
    expect(hint).toContain('MODEL_ADAPTER=claude_code')
    expect(hint).not.toContain('ANTHROPIC_AUTH_TOKEN')
    expect(hint).toContain('API 키 없음')
    expect(realModelHint({ adapter: 'anthropic' })).toBeNull()
    expect(realModelHint({ adapter: 'claude_code' })).toBeNull()
    expect(realModelHint(null)).toBeNull()
  })

  it('claude_code 배지는 「내 토큰」이 아니라 「내 Claude Code」라고 적는다', () => {
    // 토큰을 넣은 적이 없는 사람에게 「내 토큰으로 호출」은 거짓이다. 우리는 자격 증명을 보지 않는다.
    const text = adapterBadgeText({ adapter: 'claude_code', model: 'claude-opus-5', auth: 'claude_code_cli' })
    expect(text).toBe('내 Claude Code 로 호출(API 키 없음) · claude-opus-5')
    expect(text).not.toContain('토큰')
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

/**
 * 이 describe 는 예전에 「토큰을 먼저 안내한다」였다. **그 사실이 바뀌었다** —
 * Anthropic 이 2026-02 부터 구독 OAuth 토큰의 제3자 사용을 금지했고 Messages API 가 거부한다는 보고가 다수다.
 * 그래서 1순위 안내는 `MODEL_ADAPTER=claude_code`(내 기계의 Claude Code 호출)다.
 * 단언을 지우지 않고 **새 사실로 바꿔** 둔다 — 되돌아가면 여기서 깨진다.
 */
describe('realModelHint — claude_code 를 먼저 안내한다', () => {
  it('서버 모드 안내가 claude_code 를 먼저 적고, 금지된 토큰 경로를 권하지 않는다', () => {
    const hint = realModelHint({ adapter: 'fixture' }) ?? ''
    expect(hint).toContain('MODEL_ADAPTER=claude_code')
    expect(hint).not.toContain('MODEL_AUTH=token')
    expect(hint).not.toContain('claude setup-token')
    expect(hint.indexOf('MODEL_ADAPTER=claude_code')).toBeLessThan(hint.indexOf('MODEL_AUTH=api_key'))
  })

  it('anthropic·claude_code 면 안내하지 않는다 (이미 실제 호출이다)', () => {
    expect(realModelHint({ adapter: 'anthropic' })).toBeNull()
    expect(realModelHint({ adapter: 'claude_code' })).toBeNull()
  })
})
