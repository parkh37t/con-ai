/** 테스트 보조 — 테스트 파일에서만 쓴다 (index.ts 에서 재수출하지 않는다). */
import type { ZodSafeParseResult } from 'zod'

/** 배열 요소를 꺼내되 없으면 실패시킨다 (noUncheckedIndexedAccess 대응). */
export function at<T>(items: readonly T[] | undefined, index: number): T {
  const item = items?.[index]
  if (item === undefined) throw new Error(`테스트 데이터에 index ${index} 가 없다`)
  return item
}

/** 실패한 파싱 결과의 issue 경로를 'a.0.b' 형태로 모은다. */
export function issuePaths(result: ZodSafeParseResult<unknown>): string[] {
  if (result.success) return []
  return result.error.issues.map((i) => i.path.map(String).join('.'))
}

/** 실패한 파싱 결과의 메시지를 모은다. */
export function issueMessages(result: ZodSafeParseResult<unknown>): string[] {
  if (result.success) return []
  return result.error.issues.map((i) => i.message)
}

/** strictObject 가 거부한 미정의 키 목록 (zod 4 는 path 가 아니라 issue.keys 로 보고한다). */
export function unrecognizedKeys(result: ZodSafeParseResult<unknown>): string[] {
  if (result.success) return []
  return result.error.issues.flatMap((i) => (i.code === 'unrecognized_keys' ? i.keys : []))
}
