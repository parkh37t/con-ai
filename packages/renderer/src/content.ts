/**
 * 내용 표현 3종(hero · stat-strip · card-grid)이 **화면에 보여야 하는 문구 전부**.
 *
 * 왜 한 곳에 두나: 같은 목록을 세 곳이 쓴다.
 *  - html.ts       : 이 문구들을 실제로 그린다.
 *  - description.ts: 우측 설명에 같은 내용을 옮긴다 (명세가 UI 와 설명의 공통 원본).
 *  - validators V2 : 그 문구가 화면 영역에 실제로 있는지 본다 (빈 상자 방지).
 * 필드가 늘 때 한 곳만 고치면 나머지가 조용히 어긋나므로 목록을 여기 하나로 둔다.
 *
 * 여러 줄 카피(`\n`)는 자르지 않고 그대로 돌려준다. 줄 단위 비교는 쓰는 쪽이 한다.
 */
import type { Element as SpecElement } from '@con-ai/schemas'

/** 내용 표현 요소인가 (입력 컨트롤이 아니라 «보여주는» 요소). */
export function isContentElement(el: SpecElement): boolean {
  return el.type === 'hero' || el.type === 'stat-strip' || el.type === 'card-grid'
}

/** 화면에 반드시 나타나야 하는 문구들. 빈 문자열·undefined 는 빼고 앞뒤 공백을 정리한다. */
export function contentTexts(el: SpecElement): string[] {
  const out: string[] = []
  const push = (v: string | undefined): void => {
    if (v === undefined) return
    const t = v.trim()
    if (t !== '') out.push(t)
  }
  if (el.hero) {
    push(el.hero.eyebrow)
    push(el.hero.headline)
    push(el.hero.subcopy)
    push(el.hero.search_placeholder)
    for (const c of el.hero.chips ?? []) push(c)
    push(el.hero.visual_note)
  }
  for (const s of el.stats ?? []) {
    push(s.label)
    push(s.value)
    push(s.delta)
    push(s.caption)
  }
  for (const c of el.cards ?? []) {
    push(c.badge)
    push(c.title)
    push(c.desc)
    push(c.meta)
  }
  return out
}
