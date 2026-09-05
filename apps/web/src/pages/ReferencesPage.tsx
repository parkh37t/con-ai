/** 레퍼런스 포트폴리오 — BNK 식 예시 갤러리. 카드 선택 시 spec 요약(영역·요소·CASE)과 구조를 보여준다. */
import { useState } from 'react'
import { api } from '../api.js'
import { Badge, Empty, ErrorBox, Loading } from '../components/common.js'
import { CATEGORY_LABELS, ReferenceCard } from '../components/ReferenceCard.js'
import { useAsync } from '../hooks.js'
import { CASE_LABELS, summarizeSpec } from '../summary.js'
import type { Reference } from '../types.js'

export function ReferencesPage({ projectId }: { projectId: string }) {
  const refs = useAsync(() => api.references(projectId), [projectId])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = refs.data?.find((r) => r.id === selectedId) ?? null

  return (
    <div className="page">
      <section className="card">
        <div className="card-head">
          <h2>레퍼런스 포트폴리오</h2>
          <span className="muted small">S2B 학습 규격을 적용한 합성 골든 예시. 생성 작업대의 "참고 화면" 에서 같은 목록을 선택한다.</span>
        </div>
        {refs.error ? <ErrorBox error={refs.error} title="레퍼런스를 읽지 못했습니다" /> : null}
        {refs.loading && !refs.data && <Loading />}
        {refs.data && refs.data.length === 0 && <Empty>레퍼런스가 없습니다.</Empty>}
        {refs.data && refs.data.length > 0 && (
          <div className="ref-grid">
            {refs.data.map((r) => (
              <ReferenceCard key={r.id} reference={r} selected={r.id === selectedId} onSelect={(id, on) => setSelectedId(on ? id : null)} />
            ))}
          </div>
        )}
      </section>
      {selected && <ReferenceDetail reference={selected} />}
    </div>
  )
}

function ReferenceDetail({ reference }: { reference: Reference }) {
  const s = summarizeSpec(reference.spec)
  const spec = reference.spec
  return (
    <section className="card">
      <div className="card-head">
        <h3>
          {reference.title} <Badge tone="blue">{CATEGORY_LABELS[reference.category] ?? reference.category}</Badge>
        </h3>
        <span className="muted small">{reference.source}</span>
      </div>
      <dl className="kv">
        <dt>레퍼런스 ID</dt>
        <dd>
          <code>{reference.id}</code>
        </dd>
        <dt>목적</dt>
        <dd>{spec.purpose ?? '—'}</dd>
        <dt>shell · 기기</dt>
        <dd>
          {spec.shell ?? '—'} · {spec.device ?? '—'}
        </dd>
        <dt>요약</dt>
        <dd>
          영역 {s.sections} · 요소 {s.elements} · CASE {s.cases} · 동작 {s.actions} · 메시지 {s.messages} · 미확정 {s.unresolved} · 잠금 {s.locked}
        </dd>
      </dl>
      <div className="two-col">
        <div>
          <h4>영역·요소</h4>
          {(spec.sections ?? []).length === 0 ? (
            <Empty>영역 정보가 없습니다.</Empty>
          ) : (
            <ul className="spec-sections">
              {(spec.sections ?? []).map((sec) => (
                <li key={sec.id}>
                  <strong>
                    {sec.display_no ? `${sec.display_no}. ` : ''}
                    {sec.title}
                  </strong>{' '}
                  <code className="muted">{sec.id}</code>
                  <ul>
                    {sec.elements.map((el) => (
                      <li key={el.id}>
                        {el.display_no ? `${el.display_no}. ` : ''}
                        {el.label} <span className="muted small">{el.type}</span> <code className="muted small">{el.id}</code>
                        {el.required && <Badge tone="red">필수</Badge>}
                        {(el.locked || spec.locked_elements?.includes(el.id)) && <Badge tone="gray">잠김</Badge>}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h4>CASE</h4>
          {(spec.states ?? []).length === 0 ? (
            <Empty>CASE 정보가 없습니다.</Empty>
          ) : (
            <ul>
              {(spec.states ?? []).map((st) => (
                <li key={st.id}>
                  <Badge tone="gray">{st.case_kind ? (CASE_LABELS[st.case_kind] ?? st.case_kind) : 'CASE'}</Badge> <code>{st.id}</code>
                  {st.expected ? ` — ${st.expected}` : ''}
                  {st.fixture_id && <span className="muted small"> (fixture {st.fixture_id})</span>}
                </li>
              ))}
            </ul>
          )}
          {(spec.actions ?? []).length > 0 && (
            <>
              <h4>동작</h4>
              <ul>
                {(spec.actions ?? []).map((a) => (
                  <li key={a.id}>
                    <code>{a.id}</code> <span className="muted small">{a.type}</span>
                    {a.label ? ` — ${a.label}` : ''}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
