/** content hash 유틸 — 산출물(HTML)·명세(JSON) hash 는 모두 SHA-256 소문자 hex 64자 (schemas ContentHash). */
import { createHash } from 'node:crypto'

export function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

/** 키 순서에 영향받지 않는 JSON 직렬화 — 같은 명세는 같은 spec_hash 를 갖는다. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value))
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[key]
      if (v !== undefined) out[key] = sortKeys(v)
    }
    return out
  }
  return value
}

export function specHash(spec: unknown): string {
  return sha256(stableStringify(spec))
}
