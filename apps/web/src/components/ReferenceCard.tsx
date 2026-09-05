/** 레퍼런스 포트폴리오 카드 — 제목·분류·설명·태그·S2B 학습 규격 표시. 갤러리(선택)와 생성 작업대(체크) 양쪽에서 쓴다. */
import { summarizeSpec } from '../summary.js'
import type { Reference, ReferenceCategory } from '../types.js'
import { Badge } from './common.js'

export const CATEGORY_LABELS: Readonly<Record<ReferenceCategory, string>> = {
  list: '목록',
  detail: '상세',
  popup: '팝업',
  form: '입력 폼',
}

export function ReferenceCard({ reference, selected, onSelect, checkbox }: { reference: Reference; selected: boolean; onSelect: (id: string, on: boolean) => void; checkbox?: boolean }) {
  const s = summarizeSpec(reference.spec)
  const inputId = `ref-${reference.id}`
  return (
    <div className={`ref-card${selected ? ' selected' : ''}`} data-testid="ref-card">
      <label htmlFor={inputId} className="ref-card-head">
        <input id={inputId} data-testid={`reference-${reference.id}`} type={checkbox ? 'checkbox' : 'radio'} name={checkbox ? undefined : 'reference-select'} checked={selected} onChange={(e) => onSelect(reference.id, e.target.checked)} />
        <span className="ref-title">{reference.title}</span>
        <Badge tone="blue">{CATEGORY_LABELS[reference.category] ?? reference.category}</Badge>
      </label>
      <p className="ref-desc">{reference.description}</p>
      <div className="ref-meta">
        <span className="muted small">
          영역 {s.sections} · 요소 {s.elements} · CASE {s.cases}
        </span>
        {reference.spec.shell && <span className="muted small">shell {reference.spec.shell}</span>}
      </div>
      <div className="tags">
        {reference.tags.map((t) => (
          <span key={t} className="tag">
            #{t}
          </span>
        ))}
      </div>
      <div className="ref-source">
        <Badge tone="purple" title={reference.source}>
          S2B 학습 규격
        </Badge>
        <span className="muted small">{reference.source}</span>
      </div>
    </div>
  )
}
