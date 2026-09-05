/**
 * 브라우저 저장소 — 스냅샷을 초기 상태로 두고, 브라우저에서 만든 결과만 localStorage 에 누적한다.
 *
 * 키 접두사 `con-ai:browser:`. 담는 것: 생성한 revision(명세·검증 결과·HTML), 코멘트, 승인(완료) 기록.
 * 스냅샷 자체는 저장하지 않는다 (public/demo 정적 파일이 원본).
 *
 * - 용량 초과(QuotaExceededError)는 삼키지 않고 마지막 오류로 남겨 화면이 알린다. 저장에 실패해도 현재 탭의 화면은 계속 동작한다.
 * - 자격 증명 값은 여기에 절대 넣지 않는다 (browser-run/credential.ts 가 따로 보관한다).
 * - 저장 데이터는 이 브라우저 밖으로 나가지 않는다 — 다른 사람과 공유되지 않는다.
 */
import type { Artifact, Comment, ElementIndexEntry, Screen, ScreenRevision, ScreenSpecLike, ValidationResult } from '../types.js'
import type { StorageLike } from './credential.js'

export { browserArtifactUrl, registerArtifactHtml, releaseArtifactUrls } from './artifact-urls.js'

export const BROWSER_STORE_PREFIX = 'con-ai:browser:'
export const BROWSER_STORE_KEY = `${BROWSER_STORE_PREFIX}state`
export const BROWSER_STORE_VERSION = 1

/** 브라우저에서 생성한 revision 하나 (검토 화면이 필요로 하는 것 전부). */
export interface BrowserRevisionRecord {
  screen_id: string
  screen_external_id: string
  project_id: string
  revision: ScreenRevision
  spec: ScreenSpecLike
  artifact: Artifact
  validation_results: ValidationResult[]
  element_index: ElementIndexEntry[]
  html: string
  /** 이 revision 을 만든 작업의 모델·어댑터 표기 (manifest·표시용). */
  generated_by: string
}

/** 완료(v1.0) 기록 — 브라우저 모드는 파일을 서버에 쓰지 않고 다운로드로 대체한다. */
export interface BrowserApprovalRecord {
  screen_id: string
  revision_id: string
  artifact_hash: string
  approved_by: string
  approved_at: string
  version: string
}

/** 브라우저에서 만든 화면 하나 (한 줄 입력 흐름). 스냅샷에 없는 화면이라 이 브라우저에만 있다. */
export interface BrowserScreenRecord {
  screen: Screen
  /** 이 화면에 붙인 예시 더미데이터 (fixture_id → 행). 레퍼런스의 열 구성을 따른다. */
  dummy: Record<string, unknown[]>
}

export interface BrowserStoreData {
  version: number
  revisions: BrowserRevisionRecord[]
  /** 브라우저에서 만든 화면 (스냅샷 화면은 여기 없다). */
  screens: BrowserScreenRecord[]
  /** 화면 id → 사용자가 고친 제목 (스냅샷 화면도 덮어쓴다). */
  titles: Record<string, string>
  /** revision id → 코멘트 목록 (스냅샷 revision 의 코멘트도 여기서 덮어쓴다). */
  comments: Record<string, Comment[]>
  /** 화면 id → 완료 기록. */
  approvals: Record<string, BrowserApprovalRecord>
}

export function emptyStoreData(): BrowserStoreData {
  return { version: BROWSER_STORE_VERSION, revisions: [], screens: [], titles: {}, comments: {}, approvals: {} }
}

function localStorageOrNull(): StorageLike | null {
  try {
    const s = (globalThis as { localStorage?: unknown }).localStorage
    return s === undefined || s === null ? null : (s as StorageLike)
  } catch {
    return null
  }
}

/** 용량 초과인지 (브라우저마다 이름·코드가 달라 둘 다 본다). */
function isQuotaError(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false
  const rec = e as { name?: unknown; code?: unknown }
  return rec.name === 'QuotaExceededError' || rec.name === 'NS_ERROR_DOM_QUOTA_REACHED' || rec.code === 22 || rec.code === 1014
}

export const QUOTA_MESSAGE =
  '브라우저 저장 공간이 가득 찼습니다 — 생성 결과(HTML)를 더 저장하지 못했습니다. 아래 "브라우저 저장 데이터 지우기" 로 이전 결과를 비우거나, 필요한 산출물을 먼저 내려받으세요.'

export class BrowserStore {
  readonly #storage: () => StorageLike | null
  #cache: BrowserStoreData | null = null
  /** 마지막 저장 실패 메시지 (화면이 그대로 보여준다). */
  lastError: string | null = null

  constructor(storage: () => StorageLike | null = localStorageOrNull) {
    this.#storage = storage
  }

  load(): BrowserStoreData {
    if (this.#cache) return this.#cache
    const raw = this.#read()
    const parsed = parseStoreData(raw)
    this.#cache = parsed
    return parsed
  }

  /** 저장 성공 여부. 실패해도 메모리 캐시는 갱신해 현재 탭의 화면은 이어진다. */
  save(data: BrowserStoreData): boolean {
    this.#cache = data
    const storage = this.#storage()
    if (!storage) {
      this.lastError = '이 브라우저에서 저장소를 쓸 수 없어 생성 결과가 새로고침 후 사라집니다 (사생활 보호 모드일 수 있습니다).'
      return false
    }
    try {
      storage.setItem(BROWSER_STORE_KEY, JSON.stringify(data))
      this.lastError = null
      return true
    } catch (e) {
      this.lastError = isQuotaError(e) ? QUOTA_MESSAGE : `브라우저 저장에 실패했습니다: ${e instanceof Error ? e.message : String(e)}`
      return false
    }
  }

  addScreen(record: BrowserScreenRecord): boolean {
    const data = this.load()
    const screens = [...data.screens.filter((s) => s.screen.id !== record.screen.id), record]
    return this.save({ ...data, screens })
  }

  /** 제목만 바꾼다 (외부 ID·별칭은 그대로). */
  setTitle(screenId: string, title: string): boolean {
    const data = this.load()
    const screens = data.screens.map((s) => (s.screen.id === screenId ? { ...s, screen: { ...s.screen, title } } : s))
    return this.save({ ...data, screens, titles: { ...data.titles, [screenId]: title } })
  }

  addRevision(record: BrowserRevisionRecord): boolean {
    const data = this.load()
    const revisions = [...data.revisions.filter((r) => r.revision.id !== record.revision.id), record]
    return this.save({ ...data, revisions })
  }

  setComments(revisionId: string, comments: Comment[]): boolean {
    const data = this.load()
    return this.save({ ...data, comments: { ...data.comments, [revisionId]: comments.map((c) => ({ ...c })) } })
  }

  setApproval(record: BrowserApprovalRecord): boolean {
    const data = this.load()
    return this.save({ ...data, approvals: { ...data.approvals, [record.screen_id]: record } })
  }

  /** 브라우저에 쌓인 결과를 모두 지운다 (스냅샷 데모는 그대로 남는다). */
  reset(): void {
    this.#cache = emptyStoreData()
    this.lastError = null
    const storage = this.#storage()
    if (!storage) return
    try {
      storage.removeItem(BROWSER_STORE_KEY)
    } catch {
      /* 지우기 실패는 무시 */
    }
  }

  isEmpty(): boolean {
    const d = this.load()
    return d.revisions.length === 0 && d.screens.length === 0 && Object.keys(d.titles).length === 0 && Object.keys(d.comments).length === 0 && Object.keys(d.approvals).length === 0
  }

  /** 대략적인 저장 용량 (바이트) — 화면에 안내용으로 보여준다. */
  approximateBytes(): number {
    try {
      return JSON.stringify(this.load()).length
    } catch {
      return 0
    }
  }

  #read(): string | null {
    const storage = this.#storage()
    if (!storage) return null
    try {
      return storage.getItem(BROWSER_STORE_KEY)
    } catch {
      return null
    }
  }
}

/** 저장 문자열 → 데이터. 형태가 깨졌거나 버전이 다르면 빈 상태로 시작한다 (예전 데이터를 새 결과처럼 쓰지 않는다). */
export function parseStoreData(raw: string | null): BrowserStoreData {
  if (raw === null || raw.length === 0) return emptyStoreData()
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return emptyStoreData()
    const rec = parsed as Record<string, unknown>
    if (rec['version'] !== BROWSER_STORE_VERSION) return emptyStoreData()
    const revisions = Array.isArray(rec['revisions']) ? (rec['revisions'] as BrowserRevisionRecord[]).filter(isRevisionRecord) : []
    // screens·titles 는 나중에 추가된 항목이라 예전 저장 데이터에는 없다 (없으면 빈 값으로 시작한다).
    const screens = Array.isArray(rec['screens']) ? (rec['screens'] as BrowserScreenRecord[]).filter(isScreenRecord) : []
    const titles = typeof rec['titles'] === 'object' && rec['titles'] !== null ? (rec['titles'] as Record<string, string>) : {}
    const comments = typeof rec['comments'] === 'object' && rec['comments'] !== null ? (rec['comments'] as Record<string, Comment[]>) : {}
    const approvals = typeof rec['approvals'] === 'object' && rec['approvals'] !== null ? (rec['approvals'] as Record<string, BrowserApprovalRecord>) : {}
    return { version: BROWSER_STORE_VERSION, revisions, screens, titles, comments, approvals }
  } catch {
    return emptyStoreData()
  }
}

function isScreenRecord(v: unknown): v is BrowserScreenRecord {
  if (typeof v !== 'object' || v === null) return false
  const screen = (v as Record<string, unknown>)['screen']
  if (typeof screen !== 'object' || screen === null) return false
  const s = screen as Record<string, unknown>
  return typeof s['id'] === 'string' && typeof s['project_id'] === 'string' && typeof s['external_id'] === 'string'
}

function isRevisionRecord(v: unknown): v is BrowserRevisionRecord {
  if (typeof v !== 'object' || v === null) return false
  const r = v as Record<string, unknown>
  const revision = r['revision']
  return typeof r['html'] === 'string' && typeof r['screen_id'] === 'string' && typeof revision === 'object' && revision !== null && typeof (revision as Record<string, unknown>)['id'] === 'string'
}

/** 앱이 쓰는 기본 인스턴스. */
export const browserStore = new BrowserStore()
