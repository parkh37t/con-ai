/**
 * 좌측 작업 레일 (작업대 화면: 프로젝트 홈 · 생성 · 검토 · 완료 · AS-IS · 레퍼런스).
 *
 * 설계 산출물 screens-v1 의 「좌측 프로세스 내비」 그대로:
 *   제품명 → 프로젝트 카드 → 작업 흐름 4항목(번호 배지 + 건수) → 자료 → 바닥(어댑터·실행 검사·역할).
 * 상단 가로 메뉴를 대신한다 — 작업대에서는 세로 레일이 현재 위치와 단계 순서를 함께 보여준다.
 */
import type { ReactNode } from 'react'
import { adapterBadgeText } from '../adapter-badge.js'
import { DEMO_BANNER_TEXT, DEMO_REPO_URL, IS_DEMO } from '../demo-mode.js'
import { STAGE_NAV, stageValueText, type StageCounts, type StageKey } from '../project-nav.js'
import { hrefTo } from '../router.js'
import type { Meta, Project } from '../types.js'

export type RailSection = StageKey | 'references' | 'other'

function stageHref(item: (typeof STAGE_NAV)[number]): string {
  if (item.key === 'asis') return hrefTo('asis')
  return item.stage ? hrefTo('advanced', { stage: item.stage }) : hrefTo('advanced')
}

export function WorkspaceRail({
  project,
  meta,
  metaError,
  counts,
  current,
  credentialChip,
}: {
  project: Project | null
  meta: Meta | null
  metaError: unknown
  counts: StageCounts
  current: RailSection
  credentialChip?: ReactNode
}) {
  return (
    <aside className="rail" data-testid="workspace-rail">
      <a className="rail-brand" href={hrefTo('main')}>
        <span className="rail-mark" aria-hidden="true" />
        AI 기획 에이전트
      </a>

      {project && (
        <a className="rail-project" href={hrefTo('advanced')} data-testid="rail-project">
          <span className="rail-label">프로젝트</span>
          <strong>{project.name}</strong>
          <span className="rail-project-meta">
            {project.org} · {project.profile_id}
          </span>
        </a>
      )}

      <nav className="rail-nav" aria-label="작업 흐름">
        <span className="rail-label">작업 흐름</span>
        {STAGE_NAV.map((item) => {
          const active = item.key === current
          const count = counts[item.key]
          return (
            <a
              key={item.key}
              className={`rail-item${active ? ' active' : ''}`}
              href={stageHref(item)}
              data-testid={`rail-${item.key}`}
              {...(active ? { 'aria-current': 'page' as const } : {})}
              title={count.note ? `${item.label} — ${stageValueText(count)}${count.note}` : item.label}
            >
              <span className="rail-no" aria-hidden="true">
                {item.no}
              </span>
              <span className="rail-item-label">{item.label}</span>
              <span className="rail-count">{stageValueText(count)}</span>
            </a>
          )
        })}

        <span className="rail-label rail-label-gap">자료</span>
        <a className={`rail-item rail-item-quiet${current === 'references' ? ' active' : ''}`} href={hrefTo('references')} data-testid="rail-references">
          <span className="rail-dot" aria-hidden="true" />
          <span className="rail-item-label">레퍼런스 포트폴리오</span>
        </a>
      </nav>

      <div className="rail-foot">
        {credentialChip}
        {meta ? (
          <>
            {/* 더미/실제 구분은 색이 아니라 문구로 한다 (CLAUDE.md). */}
            <span
              className="rail-status"
              data-testid="adapter-badge"
              title={`${IS_DEMO && meta.adapter === 'anthropic' ? '이 브라우저가 내 자격 증명으로 api.anthropic.com 을 직접 호출합니다 (서버 없음). ' : ''}어댑터: ${meta.adapter}, 모델: ${meta.model}${meta.auth ? `, 인증: ${meta.auth}` : ''} · API v${meta.version}`}
            >
              <span className={`rail-status-dot${meta.adapter === 'anthropic' ? ' is-live' : ''}`} aria-hidden="true" />
              {IS_DEMO && meta.adapter === 'fixture' ? '스냅샷 데모 · fixture 더미' : adapterBadgeText(meta, { browser: IS_DEMO })}
            </span>
            {/* 브라우저 모드는 V3 를 아예 돌릴 수 없다(항상 not_run). 서버 모드에서만 실행 검사 가능 여부를 알린다. */}
            {!IS_DEMO && (
              <span className="rail-status" data-testid="playwright-badge" title={`V3 실행 검사(Playwright) ${meta.playwright ? '가능' : '불가 — V3 는 error 로 기록됩니다'}`}>
                <span className={`rail-status-dot${meta.playwright ? ' is-ok' : ' is-off'}`} aria-hidden="true" />
                실행 검사 {meta.playwright ? '가능' : '불가'}
              </span>
            )}
          </>
        ) : metaError ? (
          <span className="rail-status rail-status-error" title={String(metaError)}>
            <span className="rail-status-dot is-off" aria-hidden="true" />
            API 연결 실패
          </span>
        ) : (
          <span className="rail-status muted">어댑터 확인 중…</span>
        )}
        {/* 정적 배포에서만 — 이 화면이 스냅샷 데모라는 사실과 원본 저장소를 한 줄로 남긴다. */}
        {IS_DEMO && (
          <a className="rail-repo" data-testid="demo-banner" href={DEMO_REPO_URL} target="_blank" rel="noreferrer noopener" title={`${DEMO_BANNER_TEXT} · 저장소 parkh37t/con-ai`}>
            저장소 parkh37t/con-ai ↗
          </a>
        )}
      </div>
    </aside>
  )
}
