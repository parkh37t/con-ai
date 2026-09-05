/**
 * V2 렌더링 검사 (설계 §10 V2: HTML 구조, shell, 설명 위치, 번호·메시지). 외부 의존성 없이 정규식 태그 스캐너로 검사한다.
 *
 * - V2.shell            : 페이지 .root-shell/.screen-wrap/#right-panel, 팝업 .popup-shell/.popup-wrap/.spec-side (프로파일 값).
 * - V2.description_order: 설명 영역의 data-desc-key 순서가 프로파일 description_order 와 같다.
 * - V2.element_ids      : 명세의 모든 영역·요소 id 가 화면 영역과 설명 영역 양쪽에 data-element-id 로 있다.
 * - V2.display_numbers  : 렌더러와 같은 번호 규칙(buildElementIndex)으로 만든 번호가 화면 배지(data-display-no)와 설명 번호에 일치한다.
 * - V2.no_external_refs : src/href/action/url()/@import 로 외부(http·https·//) 자원을 참조하지 않는다 (설계 §9 오프라인).
 */
import { shellKindOf, type ScreenSpecShape } from '@con-ai/schemas'
import { buildElementIndex, type RenderProfile } from '@con-ai/renderer'
import { makeResult, newRunId, type ResultFactoryInput } from './result.js'
import type { CheckResult, CommonOptions } from './types.js'

export const V2_CHECKS = ['V2.shell', 'V2.description_order', 'V2.element_ids', 'V2.display_numbers', 'V2.no_external_refs'] as const

export interface ScannedTag {
  name: string
  attrs: Record<string, string>
  index: number
}

const TAG_RE = /<([a-zA-Z][\w-]*)\b([^>]*)>/g
const ATTR_RE = /([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g

/** 여는 태그를 모두 스캔한다 (속성은 큰따옴표·작은따옴표·따옴표 없음 지원). */
export function scanTags(html: string): ScannedTag[] {
  const out: ScannedTag[] = []
  TAG_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = TAG_RE.exec(html)) !== null) {
    const attrs: Record<string, string> = {}
    const raw = m[2] ?? ''
    ATTR_RE.lastIndex = 0
    let a: RegExpExecArray | null
    while ((a = ATTR_RE.exec(raw)) !== null) {
      const key = a[1]
      if (key === undefined || key === '/') continue
      attrs[key.toLowerCase()] = a[2] ?? a[3] ?? a[4] ?? ''
    }
    out.push({ name: (m[1] ?? '').toLowerCase(), attrs, index: m.index })
  }
  return out
}

function hasClass(tag: ScannedTag, cls: string): boolean {
  return (tag.attrs.class ?? '').split(/\s+/).includes(cls)
}

export interface HtmlRegions {
  screen: { start: number; end: number } | undefined
  description: { start: number; end: number } | undefined
  tags: ScannedTag[]
}

/** shell 프로파일로 화면 영역과 설명 영역의 문자 범위를 찾는다. */
export function findRegions(html: string, tags: ScannedTag[], shell: RenderProfile['page_shell']): HtmlRegions {
  const screenTag = tags.find((t) => hasClass(t, shell.screen))
  const panelTag = tags.find((t) => t.attrs.id === shell.panel || hasClass(t, shell.panel))
  let screen: HtmlRegions['screen']
  let description: HtmlRegions['description']
  if (screenTag) screen = { start: screenTag.index, end: panelTag ? panelTag.index : html.length }
  if (panelTag) {
    const close = html.indexOf(`</${panelTag.name}>`, panelTag.index)
    description = { start: panelTag.index, end: close >= 0 ? close : html.length }
  }
  return { screen, description, tags }
}

function within(tags: ScannedTag[], region: { start: number; end: number } | undefined): ScannedTag[] {
  if (!region) return []
  return tags.filter((t) => t.index >= region.start && t.index < region.end)
}

const EXTERNAL_ATTR_RE = /\b(?:src|href|action|xlink:href|poster|data)\s*=\s*["']?\s*(?:https?:)?\/\//gi
const EXTERNAL_CSS_RE = /(?:url\(\s*["']?\s*(?:https?:)?\/\/|@import\b)/gi

export function findExternalRefs(html: string): string[] {
  const found: string[] = []
  for (const re of [EXTERNAL_ATTR_RE, EXTERNAL_CSS_RE]) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(html)) !== null) {
      const snippet = html.slice(m.index, Math.min(html.length, m.index + 80)).replace(/\s+/g, ' ')
      found.push(`@${m.index}: ${snippet}`)
      if (found.length >= 20) return found
    }
  }
  return found
}

export function runV2(html: string, spec: ScreenSpecShape, profile: RenderProfile, opts: CommonOptions): CheckResult[] {
  const base: ResultFactoryInput = { artifact_hash: opts.artifact_hash, validation_run_id: opts.validation_run_id ?? newRunId(), stage: 'V2' }
  const started = Date.now()
  const results: CheckResult[] = []
  const kind = shellKindOf(spec.shell)
  const shell = kind === 'popup' ? profile.popup_shell : profile.page_shell
  const other = kind === 'popup' ? profile.page_shell : profile.popup_shell
  const tags = scanTags(html)
  const regions = findRegions(html, tags, shell)

  // V2.shell
  {
    const problems: string[] = []
    const rootTag = tags.find((t) => hasClass(t, shell.root))
    if (!rootTag) problems.push(`루트 .${shell.root} 없음`)
    if (!regions.screen) problems.push(`화면 영역 .${shell.screen} 없음`)
    if (!regions.description) problems.push(`설명 영역 ${kind === 'popup' ? '.' : '#'}${shell.panel} 없음`)
    if (rootTag && regions.screen && regions.screen.start < rootTag.index) problems.push(`.${shell.screen} 이 .${shell.root} 밖에 있다`)
    if (rootTag && regions.description && regions.description.start < rootTag.index) problems.push(`${shell.panel} 이 .${shell.root} 밖에 있다`)
    if (tags.some((t) => hasClass(t, other.root))) problems.push(`${kind === 'popup' ? '팝업' : '페이지'} shell 에 다른 shell 의 루트 .${other.root} 가 섞여 있다 (설계 §9)`)
    const bodyTag = tags.find((t) => t.name === 'body')
    if (bodyTag && bodyTag.attrs['data-shell'] !== undefined && bodyTag.attrs['data-shell'] !== spec.shell) problems.push(`body[data-shell]=${bodyTag.attrs['data-shell']} 이 명세 shell(${spec.shell})과 다르다`)
    results.push(
      problems.length > 0
        ? makeResult(base, { check_id: 'V2.shell', status: 'fail', required: true, message: `shell 구조 위반 ${problems.length}건`, evidence: problems, started_at: started })
        : makeResult(base, { check_id: 'V2.shell', status: 'pass', required: true, evidence: [`shell=${spec.shell}(${kind})`, `root=.${shell.root}`, `screen=.${shell.screen}`, `panel=${shell.panel}`], started_at: started }),
    )
  }

  const descTags = within(tags, regions.description)
  const screenTags = within(tags, regions.screen)

  // V2.description_order
  {
    const keys = descTags.map((t) => t.attrs['data-desc-key']).filter((k): k is string => k !== undefined)
    const expected = profile.description_order
    const same = keys.length === expected.length && keys.every((k, i) => k === expected[i])
    results.push(
      same
        ? makeResult(base, { check_id: 'V2.description_order', status: 'pass', required: true, evidence: [`order=${keys.join(' → ')}`], started_at: started })
        : makeResult(base, {
            check_id: 'V2.description_order',
            status: 'fail',
            required: true,
            message: regions.description ? '설명 절 순서가 프로파일과 다르다 (설계 §9)' : '설명 영역이 없어 순서를 확인할 수 없다',
            evidence: [`expected=${expected.join(' → ')}`, `actual=${keys.join(' → ') || '(없음)'}`],
            started_at: started,
          }),
    )
  }

  // V2.element_ids
  const ids: Array<{ id: string; kind: 'section' | 'element' }> = []
  for (const s of spec.sections) {
    ids.push({ id: s.id, kind: 'section' })
    for (const e of s.elements) ids.push({ id: e.id, kind: 'element' })
  }
  const screenIds = new Set(screenTags.map((t) => t.attrs['data-element-id']).filter((v): v is string => v !== undefined))
  const descIds = new Set(descTags.map((t) => t.attrs['data-element-id']).filter((v): v is string => v !== undefined))
  {
    const problems: string[] = []
    for (const { id, kind: k } of ids) {
      if (!screenIds.has(id)) problems.push(`화면에 ${k} ${id} 의 data-element-id 없음`)
      if (!descIds.has(id)) problems.push(`설명에 ${k} ${id} 의 data-element-id 없음`)
    }
    for (const id of screenIds) if (!ids.some((x) => x.id === id)) problems.push(`화면에 명세에 없는 data-element-id ${id}`)
    for (const id of descIds) if (!ids.some((x) => x.id === id)) problems.push(`설명에 명세에 없는 data-element-id ${id}`)
    results.push(
      problems.length > 0
        ? makeResult(base, { check_id: 'V2.element_ids', status: 'fail', required: true, message: `요소 id 불일치 ${problems.length}건`, evidence: problems, started_at: started })
        : makeResult(base, { check_id: 'V2.element_ids', status: 'pass', required: true, evidence: [`영역·요소 ${ids.length}개가 화면·설명 양쪽에 있다`], started_at: started }),
    )
  }

  // V2.display_numbers — 렌더러와 같은 번호 규칙으로 기대값을 만든다.
  {
    const expected = buildElementIndex(spec, profile)
    const problems: string[] = []
    const numbered = (list: ScannedTag[]) => {
      const map = new Map<string, Set<string>>()
      for (const t of list) {
        const id = t.attrs['data-element-id']
        const no = t.attrs['data-display-no']
        if (id === undefined || no === undefined) continue
        const set = map.get(id) ?? new Set<string>()
        set.add(no)
        map.set(id, set)
      }
      return map
    }
    const screenNos = numbered(screenTags)
    const descNos = numbered(descTags)
    for (const entry of expected) {
      const s = screenNos.get(entry.element_id)
      const d = descNos.get(entry.element_id)
      if (!s || !s.has(entry.display_no)) problems.push(`화면 ${entry.element_id}: 기대 ${entry.display_no}, 실제 ${s ? [...s].join('/') : '없음'}`)
      else if (s.size > 1) problems.push(`화면 ${entry.element_id}: 번호가 여러 개 ${[...s].join('/')}`)
      if (!d || !d.has(entry.display_no)) problems.push(`설명 ${entry.element_id}: 기대 ${entry.display_no}, 실제 ${d ? [...d].join('/') : '없음'}`)
      else if (d.size > 1) problems.push(`설명 ${entry.element_id}: 번호가 여러 개 ${[...d].join('/')}`)
    }
    // 배지 텍스트가 data-display-no 와 같은지 (화면 쪽)
    const badgeRe = /<span class="badge[^"]*" data-badge-for="([^"]+)">([^<]*)<\/span>/g
    const region = regions.screen
    if (region) {
      const part = html.slice(region.start, region.end)
      let m: RegExpExecArray | null
      while ((m = badgeRe.exec(part)) !== null) {
        const exp = expected.find((e) => e.element_id === m?.[1])
        if (exp && exp.display_no !== m[2]) problems.push(`배지 ${m[1]}: 표시 ${m[2]}, 기대 ${exp.display_no}`)
      }
    }
    results.push(
      problems.length > 0
        ? makeResult(base, { check_id: 'V2.display_numbers', status: 'fail', required: true, message: `번호 불일치 ${problems.length}건 (화면 배지와 설명 번호는 같은 데이터에서 만든다; 설계 §9)`, evidence: problems, started_at: started })
        : makeResult(base, { check_id: 'V2.display_numbers', status: 'pass', required: true, evidence: expected.map((e) => `${e.element_id}=${e.display_no}`), started_at: started }),
    )
  }

  // V2.no_external_refs
  {
    const refs = findExternalRefs(html)
    results.push(
      refs.length > 0
        ? makeResult(base, { check_id: 'V2.no_external_refs', status: 'fail', required: true, message: `외부 자원 참조 ${refs.length}건 — 오프라인 완료로 표시할 수 없다 (설계 §9)`, evidence: refs, started_at: started })
        : makeResult(base, { check_id: 'V2.no_external_refs', status: 'pass', required: true, evidence: ['src/href/action/url()/@import 에 외부 주소 없음'], started_at: started }),
    )
  }

  return results
}
