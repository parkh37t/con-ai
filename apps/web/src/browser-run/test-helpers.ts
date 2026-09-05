/**
 * 브라우저 모드 테스트 도구 — 가짜 저장소·가짜 fetch·스냅샷 명세.
 * 실제 네트워크는 절대 쓰지 않는다 (fetch 를 주입해 응답을 만든다).
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { FetchLike } from './anthropic.js'
import type { StorageLike } from './credential.js'

/** 메모리 저장소 (sessionStorage·localStorage 대역). */
export class MemoryStorage implements StorageLike {
  readonly map = new Map<string, string>()
  /** true 면 setItem 이 용량 초과로 실패한다. */
  quotaFull = false

  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    if (this.quotaFull) {
      const err = new Error('quota') as Error & { name: string }
      err.name = 'QuotaExceededError'
      throw err
    }
    this.map.set(key, value)
  }

  removeItem(key: string): void {
    this.map.delete(key)
  }

  /** 저장된 값 전부를 한 문자열로 (비밀 값이 들어갔는지 확인할 때 쓴다). */
  dump(): string {
    return JSON.stringify([...this.map.entries()])
  }
}

/** 접근할 때마다 예외를 던지는 저장소 (사생활 보호 모드 흉내). */
export const throwingStorage: StorageLike = {
  getItem() {
    throw new Error('저장소 접근 거부')
  },
  setItem() {
    throw new Error('저장소 접근 거부')
  },
  removeItem() {
    throw new Error('저장소 접근 거부')
  },
}

export interface CapturedCall {
  url: string
  init: RequestInit
  headers: Record<string, string>
  body: Record<string, unknown>
}

/** 응답을 미리 정해 두는 fetch. 호출 내용을 calls 에 기록한다. */
export function fakeFetch(responses: Array<{ status?: number; body: unknown } | Error>): { fetch: FetchLike; calls: CapturedCall[] } {
  const calls: CapturedCall[] = []
  let index = 0
  const fetchLike: FetchLike = async (url, init) => {
    const headers = (init.headers ?? {}) as Record<string, string>
    calls.push({ url, init, headers, body: JSON.parse(String(init.body ?? '{}')) as Record<string, unknown> })
    const next = responses[Math.min(index, responses.length - 1)]
    index += 1
    if (next instanceof Error) throw next
    const status = next?.status ?? 200
    return new Response(JSON.stringify(next?.body ?? {}), { status, headers: { 'content-type': 'application/json' } })
  }
  return { fetch: fetchLike, calls }
}

/** 모델이 구조화 출력으로 돌려주는 정상 응답. */
export function modelResponse(output: unknown, opts: { stop_reason?: string } = {}): { status: number; body: unknown } {
  return {
    status: 200,
    body: {
      id: 'msg_test',
      model: 'claude-opus-5',
      content: [{ type: 'text', text: JSON.stringify(output) }],
      stop_reason: opts.stop_reason ?? 'end_turn',
      usage: { input_tokens: 100, output_tokens: 200 },
    },
  }
}

const HERE = dirname(fileURLToPath(import.meta.url))

interface SnapshotRevision {
  spec: Record<string, unknown>
  comments: unknown[]
}

/** 데모 스냅샷에서 실제 ScreenSpec 하나를 읽는다 (V1·V2 를 진짜로 통과하는 명세). */
export function snapshotSpec(): Record<string, unknown> {
  const raw = readFileSync(resolve(HERE, '../../public/demo/snapshot.json'), 'utf8')
  const snapshot = JSON.parse(raw) as Record<string, unknown>
  const key = Object.keys(snapshot).find((k) => k.startsWith('/api/revisions/'))
  if (key === undefined) throw new Error('스냅샷에 revision 이 없다')
  return JSON.parse(JSON.stringify((snapshot[key] as SnapshotRevision).spec)) as Record<string, unknown>
}

/** 스냅샷 전체 (데모 상태 구성용). */
export function snapshotFile(): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(HERE, '../../public/demo/snapshot.json'), 'utf8')) as Record<string, unknown>
}

/** 모델 출력 한 벌 (screen_spec + 나머지 3종). */
export function modelOutput(spec: Record<string, unknown>): Record<string, unknown> {
  return {
    screen_spec: spec,
    trace_proposals: [],
    unresolved: [],
    change_summary: { summary: '테스트 생성', added_ids: [], changed_ids: [], removed_ids: [], locked_violations: [] },
  }
}
