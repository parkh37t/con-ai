/**
 * 자격 증명 보관 — 저장 위치(탭/브라우저), 끝 4자리 표시, 삭제, 저장소 접근 실패.
 * 값 전체는 describe 로 나오지 않아야 한다 (화면·로그에 남기지 않기 위한 계약).
 */
import { describe, expect, it } from 'vitest'
import { CREDENTIAL_STORAGE_KEY, CredentialStore, describeCredential } from './credential.js'
import { MemoryStorage, throwingStorage } from './test-helpers.js'

const TOKEN = 'sk-ant-oat01-테스트-토큰-abcd1234'

function stores() {
  const session = new MemoryStorage()
  const local = new MemoryStorage()
  return { session, local, store: new CredentialStore(() => ({ session, local })) }
}

describe('CredentialStore — 저장 위치', () => {
  it('기본은 sessionStorage 이며 localStorage 에는 남지 않는다', () => {
    const { session, local, store } = stores()
    store.save('token', TOKEN, false)
    expect(session.getItem(CREDENTIAL_STORAGE_KEY)).toContain('token')
    expect(local.getItem(CREDENTIAL_STORAGE_KEY)).toBeNull()
    expect(store.load()).toEqual({ kind: 'token', value: TOKEN, persist: false })
  })

  it('"이 브라우저에 저장" 이면 localStorage 로 옮기고 sessionStorage 는 비운다', () => {
    const { session, local, store } = stores()
    store.save('token', TOKEN, false)
    store.save('api_key', 'sk-ant-api-키-9999', true)
    expect(session.getItem(CREDENTIAL_STORAGE_KEY)).toBeNull()
    expect(local.getItem(CREDENTIAL_STORAGE_KEY)).not.toBeNull()
    expect(store.load()).toEqual({ kind: 'api_key', value: 'sk-ant-api-키-9999', persist: true })
  })

  it('삭제하면 두 저장소에서 모두 사라진다', () => {
    const { session, local, store } = stores()
    store.save('token', TOKEN, true)
    store.clear()
    expect(store.load()).toBeNull()
    expect(session.getItem(CREDENTIAL_STORAGE_KEY)).toBeNull()
    expect(local.getItem(CREDENTIAL_STORAGE_KEY)).toBeNull()
  })

  it('빈 값은 저장하지 않는다', () => {
    const { store } = stores()
    expect(() => store.save('token', '   ', false)).toThrow(/비어/)
  })

  it('저장 내용이 깨졌으면 없는 것으로 본다 (예전 값을 새 값처럼 쓰지 않는다)', () => {
    const session = new MemoryStorage()
    session.setItem(CREDENTIAL_STORAGE_KEY, '{"kind":"unknown","value":""}')
    const store = new CredentialStore(() => ({ session, local: null }))
    expect(store.load()).toBeNull()
  })

  it('저장소 접근이 막혀 있으면 읽기는 null, 쓰기는 안내 오류', () => {
    const store = new CredentialStore(() => ({ session: throwingStorage, local: throwingStorage }))
    expect(store.load()).toBeNull()
    expect(() => store.save('token', TOKEN, false)).toThrow(/저장/)
  })
})

describe('describe — 종류와 끝 4자리만', () => {
  it('값 전체는 돌려주지 않는다', () => {
    const { store } = stores()
    store.save('token', TOKEN, false)
    const info = store.describe()
    expect(info).toEqual({ kind: 'token', label: '토큰', last4: '1234', persist: false })
    expect(JSON.stringify(info)).not.toContain(TOKEN)
  })

  it('4자 이하 값은 그대로 (끝 4자리 규칙)', () => {
    expect(describeCredential({ kind: 'api_key', value: 'ab', persist: true })).toEqual({ kind: 'api_key', label: 'API 키', last4: 'ab', persist: true })
  })

  it('없으면 null', () => {
    expect(describeCredential(null)).toBeNull()
  })
})
