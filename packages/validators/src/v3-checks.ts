/**
 * V3 검사 목록과 「필수 여부」 규칙 — **순수 함수만** 둔다 (node:·playwright 의존 없음).
 *
 * v3.ts 는 Playwright 로 실제 브라우저를 띄우므로 서버에서만 돌지만, 검사 이름과 조건부 필수 규칙은
 * 브라우저(정적 배포)에서도 그대로 써야 한다. 두 곳이 다른 목록을 쓰면 같은 산출물이 환경에 따라
 * 다른 필수 검사를 갖게 되므로, 이 파일 하나만 정본으로 둔다.
 */
export const V3_CHECKS = ['V3.console_errors', 'V3.case_switch', 'V3.search_filter', 'V3.download'] as const

/** 렌더러가 body[data-action-types] 에 적은 명세 동작 종류 (없으면 트리거 표식으로 추정). */
export function actionTypesOf(html: string): Set<string> {
  const m = /<body\b[^>]*\bdata-action-types="([^"]*)"/.exec(html)
  if (m) return new Set((m[1] ?? '').split(/\s+/).filter(Boolean))
  const found = new Set<string>()
  const re = /data-action-type="([^"]+)"/g
  let a: RegExpExecArray | null
  while ((a = re.exec(html)) !== null) if (a[1] !== undefined) found.add(a[1])
  return found
}

/** 검사별 필수 여부 — 조건부 검사는 명세에 해당 동작이 있을 때만 필수 (index.ts requiredChecksFor 와 같은 규칙). */
export function v3RequiredFlags(html: string): Record<(typeof V3_CHECKS)[number], boolean> {
  const types = actionTypesOf(html)
  return {
    'V3.console_errors': true,
    'V3.case_switch': true,
    'V3.search_filter': types.has('filter-fixture'),
    'V3.download': types.has('download-fixture'),
  }
}
