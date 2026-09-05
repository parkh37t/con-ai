/**
 * 브라우저 모드 자격 증명 보관 (docs/plan/브라우저모드.md).
 *
 * - 기본은 sessionStorage: 탭을 닫으면 사라진다. "이 브라우저에 저장" 을 켜면 localStorage 에 남는다.
 * - 값은 이 파일 밖으로 그대로 나가지 않는다. 화면·로그·저장 데이터에는 종류와 끝 4자리(describe)만 쓴다.
 * - 사생활 보호 모드처럼 저장소 접근 자체가 예외를 던지는 브라우저가 있어 모든 접근을 try/catch 로 감싼다.
 * - 값은 api.anthropic.com 호출(browser-run/anthropic.ts)에만 쓰인다. 서버로 보내지 않는다 (서버가 없다).
 */

export type CredentialKind = 'api_key' | 'token'

export const CREDENTIAL_KIND_LABELS: Readonly<Record<CredentialKind, string>> = {
  api_key: 'API 키',
  token: '토큰',
}

/** 보관 중인 자격 증명. `value` 를 화면·로그·오류 메시지에 넣지 않는다. */
export interface StoredCredential {
  kind: CredentialKind
  value: string
  /** true 면 localStorage(이 브라우저에 저장), false 면 sessionStorage(탭 종료 시 삭제). */
  persist: boolean
}

/** 화면에 보여줄 요약 — 종류와 끝 4자리만. */
export interface CredentialInfo {
  kind: CredentialKind
  label: string
  last4: string
  persist: boolean
}

export const CREDENTIAL_STORAGE_KEY = 'con-ai:browser:credential'

/** Storage 의 최소 인터페이스 (테스트에서 가짜 저장소를 주입한다). */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface CredentialStorages {
  session: StorageLike | null
  local: StorageLike | null
}

/** 브라우저 저장소를 읽는다. 접근 자체가 실패하면(사생활 보호 모드 등) null 로 둔다. */
export function browserStorages(): CredentialStorages {
  const pick = (name: 'sessionStorage' | 'localStorage'): StorageLike | null => {
    try {
      const s = (globalThis as { [k: string]: unknown })[name]
      if (s === undefined || s === null) return null
      return s as StorageLike
    } catch {
      return null
    }
  }
  return { session: pick('sessionStorage'), local: pick('localStorage') }
}

function isKind(v: unknown): v is CredentialKind {
  return v === 'api_key' || v === 'token'
}

/** 저장된 JSON 문자열 → StoredCredential. 형태가 깨졌으면 null. */
function parse(raw: string | null, persist: boolean): StoredCredential | null {
  if (raw === null || raw.length === 0) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const rec = parsed as Record<string, unknown>
    const kind = rec['kind']
    const value = rec['value']
    if (!isKind(kind) || typeof value !== 'string' || value.trim().length === 0) return null
    return { kind, value, persist }
  } catch {
    return null
  }
}

/** 종류와 끝 4자리만 남긴다. 값 전체는 절대 돌려주지 않는다. */
export function describeCredential(cred: StoredCredential | null): CredentialInfo | null {
  if (!cred) return null
  const v = cred.value
  return {
    kind: cred.kind,
    label: CREDENTIAL_KIND_LABELS[cred.kind],
    last4: v.length <= 4 ? v : v.slice(-4),
    persist: cred.persist,
  }
}

export class CredentialStore {
  readonly #storages: () => CredentialStorages

  constructor(storages: () => CredentialStorages = browserStorages) {
    this.#storages = storages
  }

  /** sessionStorage 를 먼저 본다 (같은 탭에서 방금 넣은 값이 우선). */
  load(): StoredCredential | null {
    const { session, local } = this.#storages()
    const fromSession = parse(this.#read(session), false)
    if (fromSession) return fromSession
    return parse(this.#read(local), true)
  }

  /** 저장. persist 면 localStorage, 아니면 sessionStorage 에 두고 반대쪽은 지운다. */
  save(kind: CredentialKind, value: string, persist: boolean): StoredCredential {
    const trimmed = value.trim()
    if (trimmed.length === 0) throw new Error('자격 증명 값이 비어 있습니다.')
    const cred: StoredCredential = { kind, value: trimmed, persist }
    const { session, local } = this.#storages()
    const payload = JSON.stringify({ kind, value: trimmed })
    if (persist) {
      this.#write(local, payload)
      this.#remove(session)
    } else {
      this.#write(session, payload)
      this.#remove(local)
    }
    return cred
  }

  /** 양쪽 저장소에서 모두 지운다. */
  clear(): void {
    const { session, local } = this.#storages()
    this.#remove(session)
    this.#remove(local)
  }

  describe(): CredentialInfo | null {
    return describeCredential(this.load())
  }

  #read(storage: StorageLike | null): string | null {
    if (!storage) return null
    try {
      return storage.getItem(CREDENTIAL_STORAGE_KEY)
    } catch {
      return null
    }
  }

  #write(storage: StorageLike | null, payload: string): void {
    if (!storage) throw new Error('이 브라우저에서 저장소를 쓸 수 없습니다 (사생활 보호 모드일 수 있습니다).')
    try {
      storage.setItem(CREDENTIAL_STORAGE_KEY, payload)
    } catch {
      throw new Error('자격 증명을 저장하지 못했습니다 (저장소 접근이 막혀 있습니다).')
    }
  }

  #remove(storage: StorageLike | null): void {
    if (!storage) return
    try {
      storage.removeItem(CREDENTIAL_STORAGE_KEY)
    } catch {
      /* 지우기 실패는 무시 — 값을 화면에 다시 쓰지는 않는다 */
    }
  }
}

/** 앱이 쓰는 기본 인스턴스. */
export const credentialStore = new CredentialStore()
