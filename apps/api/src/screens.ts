/**
 * 화면 생성 보조 (한 줄 입력 → 화면설계서 흐름).
 *
 * "만들기" 화면은 기획자가 문장 하나만 쓰고 버튼을 누른다. 그러려면 대상 화면 레코드가 먼저 있어야 하므로
 * `POST /api/projects/:id/screens` 가 화면을 만든다. 여기 있는 함수는 그 API 가 쓰는 순수 규칙이다.
 *
 * - 외부 ID 는 `SCREEN-001` 형식으로 프로젝트 안에서 겹치지 않게 부여한다 (기존 화면 ID 는 건드리지 않는다).
 * - 새 화면에는 더미데이터가 없어 표가 비어 보인다. 그래서 참고 레퍼런스(sample_from)의 더미데이터를
 *   **같은 열 구성 그대로 복제**해 `<새 외부 ID>-<CASE>` fixture 로 붙인다. 값은 시드와 같은 합성 예시 데이터다.
 */
import type { DummyDataDocument, ReferenceDocument, ScreenDocument } from '@con-ai/worker-generation'

/** 자동 부여하는 외부 ID 접두사. */
export const AUTO_SCREEN_PREFIX = 'SCREEN'

/** shell 형식 — `<포털>-page` 또는 `<포털>-popup` (계약 §2·프롬프트 템플릿). */
export const SHELL_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*-(?:page|popup)$/

/** 팝업으로 볼 낱말 (문장·제목에서 찾는다). */
const POPUP_WORDS = ['팝업', '모달', 'popup', 'modal']

/**
 * 프로젝트 안에서 겹치지 않는 다음 외부 ID (`SCREEN-001`).
 * 이미 `SCREEN-<숫자>` 가 있으면 가장 큰 번호 다음을 쓰고, 그 밖의 형식(`SAMPLE-…`)은 세지 않는다.
 */
export function nextScreenExternalId(existing: readonly string[]): string {
  let max = 0
  const re = new RegExp(`^${AUTO_SCREEN_PREFIX}-(\\d+)$`)
  for (const id of existing) {
    const m = re.exec(id)
    if (!m) continue
    const n = Number.parseInt(m[1] ?? '', 10)
    if (Number.isFinite(n) && n > max) max = n
  }
  const taken = new Set(existing)
  let next = max + 1
  // 방어: `SCREEN-0001` 처럼 자리수가 다른 값이 이미 있어도 충돌하지 않게 한 번 더 확인한다.
  let candidate = `${AUTO_SCREEN_PREFIX}-${String(next).padStart(3, '0')}`
  while (taken.has(candidate)) {
    next += 1
    candidate = `${AUTO_SCREEN_PREFIX}-${String(next).padStart(3, '0')}`
  }
  return candidate
}

/** 프로젝트에서 이미 쓰는 포털 이름 (가장 많이 쓰인 shell 의 앞부분). 없으면 'partner'. */
export function portalOf(shells: readonly string[]): string {
  const count = new Map<string, number>()
  for (const shell of shells) {
    const m = /^(.+)-(?:page|popup)$/.exec(shell)
    if (!m?.[1]) continue
    count.set(m[1], (count.get(m[1]) ?? 0) + 1)
  }
  let best: string | null = null
  let bestN = 0
  for (const [portal, n] of count) {
    if (n > bestN) {
      best = portal
      bestN = n
    }
  }
  return best ?? 'partner'
}

/** 제목·문장에 팝업 낱말이 있으면 `<포털>-popup`, 아니면 `<포털>-page`. */
export function deriveShell(title: string, shells: readonly string[]): string {
  const portal = portalOf(shells)
  const lower = title.toLowerCase()
  return POPUP_WORDS.some((w) => lower.includes(w)) ? `${portal}-popup` : `${portal}-page`
}

/** fixture id `<screen_external_id>-<suffix>` 에서 suffix 를 떼어낸다 (예: `REF-quote-list-normal` → `normal`). */
export function fixtureSuffix(id: string, screenExternalId: string): string | null {
  const prefix = `${screenExternalId}-`
  return id.startsWith(prefix) ? id.slice(prefix.length) : null
}

export interface DummyCopyInput {
  /** 복제 대상 레퍼런스 (없으면 복제하지 않는다). */
  reference: ReferenceDocument | undefined
  /** 프로젝트의 모든 더미데이터 문서. */
  dummy: readonly DummyDataDocument[]
  project_id: string
  new_external_id: string
}

/**
 * 레퍼런스의 더미데이터를 새 화면 이름으로 복제한다.
 *
 * 모델은 참고 명세를 보고 대체로 `<화면 외부 ID>-<CASE>` 를 fixture_id 로 쓴다. 열 구성도 참고 명세를 따라가므로
 * 같은 행 데이터를 그대로 붙이면 표가 채워진 목업이 나온다. 이름이 어긋나면 파이프라인이 빈 배열로 렌더하고
 * unresolved 에 남기므로(계약 §6), 있는 것을 없는 것처럼 꾸미지 않는다.
 */
export function copyDummyForNewScreen(input: DummyCopyInput): DummyDataDocument[] {
  const ref = input.reference
  if (!ref) return []
  const source = ref.spec.screen_id
  const out: DummyDataDocument[] = []
  for (const doc of input.dummy) {
    if (doc.screen_external_id !== source) continue
    const suffix = fixtureSuffix(doc.id, source)
    if (suffix === null) continue
    out.push({
      id: `${input.new_external_id}-${suffix}`,
      project_id: input.project_id,
      screen_external_id: input.new_external_id,
      case_kind: doc.case_kind,
      rows: doc.rows.map((r) => ({ ...r })),
      note: `레퍼런스 "${ref.title}" 의 예시 데이터를 새 화면(${input.new_external_id})으로 복제`,
    })
  }
  return out
}

/** 새 화면 문서 (외부 ID·shell 은 위 규칙으로 정한다). */
export function newScreenDocument(input: { id: string; project_id: string; external_id: string; title: string; shell: string; device: 'desktop' | 'mobile' }): ScreenDocument {
  return {
    id: input.id,
    project_id: input.project_id,
    external_id: input.external_id,
    title: input.title,
    shell: input.shell,
    device: input.device,
    status: 'draft',
    aliases: [],
  }
}
