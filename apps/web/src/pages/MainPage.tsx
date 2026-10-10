/**
 * 메인 (`#/`) — 이 제품이 무엇을 하는지 보여주고, 「설계서 만들기」 로 들여보낸다.
 *
 * 설계 산출물 screens-v1 의 「메인(랜딩)」 그대로:
 *   히어로(문구 + 설계서 스케치) → 4단계 프로세스 한 줄 → 이 프로젝트 → 최근 설계서 → 시작하려면.
 * 상단 바는 앱 셸(AppTopBar)이 그린다 — 이 화면은 본문만 갖는다.
 *
 * 여기서는 새 데이터를 만들지 않는다. 최근 설계서·예시는 이미 있는 것만 연결하고,
 * 없으면 없다고 적는다(없는 것을 있는 것처럼 보여주지 않는다).
 */
import { api } from '../api.js'
import { ErrorBox } from '../components/common.js'
import { IS_DEMO } from '../demo-mode.js'
import { useAsync, useCredentialTick } from '../hooks.js'
import { PROCESS_STEPS, stepHref, stepStatus } from '../main-steps.js'
import { stageCounts, stageValueText } from '../project-nav.js'
import { hrefTo, hrefToDesign, type Route } from '../router.js'
import { recentDesigns } from '../simple-flow.js'
import type { Meta, Project } from '../types.js'

export function MainPage({ project, meta, route }: { project: Project | null; meta: Meta | null; route: Route }) {
  const credentialTick = useCredentialTick()
  const detail = useAsync(() => (project ? api.project(project.id) : null), [project?.id, credentialTick])
  const analyses = useAsync(() => (project ? api.asisAnalyses(project.id) : null), [project?.id])

  const recent = recentDesigns(detail.data)
  // 「예시 열어보기」는 이미 만들어져 있는 설계서만 연다 (정적 배포에서는 스냅샷에 담긴 설계서).
  const example = recent[0] ?? null
  const counts = stageCounts({ screens: detail.data?.screens ?? null, analyses: analyses.data ?? null })

  return (
    <div className="main-page">
      <div className="main-wrap">
        <section className="main-hero">
          <div className="main-hero-copy">
            <span className="main-kicker">AI 기획 에이전트 · 화면설계</span>
            <h1>
              기획자가 문장을 쓰면,
              <br />
              화면설계서가 나옵니다.
            </h1>
            <p className="main-sub">
              목업과 우측 설명을 같은 명세에서 만들고, 디자이너·퍼블리셔·개발자·고객이 같은 화면에서 검토합니다. 검토가 끝나면 v1.0 으로 확정해 디자인 단계로
              넘깁니다.
            </p>
            <div className="main-cta">
              <a className="main-btn main-btn-primary" data-testid="main-create" href={hrefTo('create')}>
                설계서 만들기
              </a>
              {example ? (
                <a className="main-btn" data-testid="main-example" data-available="true" href={hrefToDesign(example.revision_id)}>
                  예시 열어보기
                </a>
              ) : (
                <span className="main-btn is-disabled" data-testid="main-example" data-available="false" aria-disabled="true" title="아직 만들어진 설계서가 없습니다">
                  예시 열어보기 (아직 없음)
                </span>
              )}
              {/* 4단계 전체를 한 번 돌려보고 싶은 사람을 위한 입구. 「만들기」 는 ② 한 단계만 한다. */}
              <a className="main-btn" data-testid="main-prototype" href={hrefTo('prototype')}>
                4단계 전부 돌려보기
              </a>
            </div>
            <span className="main-fineprint">설계서는 목업 + 번호 설명이 들어 있는 HTML 파일 하나입니다.</span>
          </div>
          <DesignSketch />
        </section>

        <section className="main-section main-section-rule" aria-labelledby="main-steps-title">
          <div className="main-section-head">
            <h2 className="main-section-title" id="main-steps-title">
              4단계 프로세스
            </h2>
            <span className="main-section-note">번호가 곧 순서입니다. 카드를 누르면 그 단계로 갑니다.</span>
          </div>
          <ol className="main-steps">
            {PROCESS_STEPS.map((step) => {
              const status = stepStatus(step, { browserMode: IS_DEMO })
              return (
                <li key={step.no}>
                  <a className="main-step" data-testid="main-step" data-step={step.no} href={stepHref(step)}>
                    <span className="main-step-no" aria-hidden="true">
                      {step.no}
                    </span>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                    <span className={`step-flag step-flag-${status.kind}`} data-testid="main-step-flag" title={status.title}>
                      {status.label}
                    </span>
                  </a>
                </li>
              )
            })}
          </ol>
          {project && (
            <div className="main-project" data-testid="main-project-strip">
              <strong>이 프로젝트</strong>
              <span className="main-project-name">{project.name}</span>
              <span className="main-project-counts">
                <a href={hrefTo('asis')}>① 분석 {stageValueText(counts.asis)}</a>
                <a href={hrefTo('advanced')}>② 화면 {stageValueText(counts.screens)}</a>
                <a href={hrefTo('advanced', { stage: 'review' })}>③ 검토 중 {stageValueText(counts.review)}</a>
                <a href={hrefTo('advanced', { stage: 'done' })}>④ 완료 {stageValueText(counts.done)}</a>
              </span>
            </div>
          )}
        </section>

        <section className="main-section" aria-labelledby="main-recent-title">
          <div className="main-section-head">
            <h2 className="main-section-title" id="main-recent-title">
              최근 만든 설계서
            </h2>
            <a className="main-section-link" href={hrefTo('advanced')}>
              전체 화면 목록 →
            </a>
          </div>
          {detail.error ? <ErrorBox error={detail.error} title="최근 목록을 읽지 못했습니다" /> : null}
          {recent.length === 0 && <p className="main-note">아직 만든 설계서가 없습니다. 「설계서 만들기」 에서 문장 한 줄이면 첫 설계서가 나옵니다.</p>}
          <div className="main-cards">
            {recent.map((d) => (
              <a key={d.revision_id} className="main-card" data-testid="main-recent-card" data-external-id={d.external_id} href={hrefToDesign(d.revision_id)}>
                <strong>{d.title}</strong>
                <code className="main-card-id">{d.external_id}</code>
                <span className="main-card-foot">
                  <span className={`main-card-dot${d.status === 'approved' ? ' is-done' : ''}`} aria-hidden="true" />
                  {d.status === 'approved' ? '완료' : '검토 전'}
                  <span className="main-card-sep">·</span>v{d.versions}
                </span>
              </a>
            ))}
            <a className="main-card main-card-sample" data-testid="main-sample-card" href={hrefTo('references')}>
              <strong>골든 예시 3종</strong>
              <span className="main-card-sub">목록 · 상세 · 팝업 — 학습 규격을 적용한 참고 설계</span>
              <span className="main-card-foot">레퍼런스 포트폴리오 →</span>
            </a>
          </div>
        </section>

        <section className="main-section" aria-labelledby="main-start-title">
          <h2 className="main-section-title" id="main-start-title">
            시작하려면
          </h2>
          <ol className="main-start">
            <li>
              <span className="main-step-no" aria-hidden="true">
                1
              </span>
              <div>
                <strong>내 Claude 토큰을 준비합니다</strong>
                <KeyHelp open={route.query['help'] === 'key'} />
              </div>
            </li>
            <li>
              <span className="main-step-no" aria-hidden="true">
                2
              </span>
              <div>
                <strong>만들 화면을 문장으로 씁니다</strong>
                <p className="main-note">예: “파트너가 견적 요청 목록을 조회하고 상태별로 검색하는 화면. 목록에서 상세로 이동하고 엑셀 다운로드 버튼이 있다.”</p>
              </div>
            </li>
            <li>
              <span className="main-step-no" aria-hidden="true">
                3
              </span>
              <div>
                <strong>「설계서 만들기」 를 누릅니다</strong>
                <p className="main-note">목업과 우측 설명이 함께 있는 HTML 이 나옵니다. 한 줄로 고치면 새 버전이 쌓입니다.</p>
              </div>
            </li>
          </ol>
        </section>
      </div>
    </div>
  )
}

/**
 * 설계서가 어떻게 생겼는지 보여주는 스케치 — 왼쪽 목업, 오른쪽 번호 설명.
 * 실제 데이터가 아니라 형태 안내이므로 글자를 넣지 않고 선과 사각형으로만 그린다
 * (없는 설계서를 있는 것처럼 보이게 하지 않는다).
 */
function DesignSketch() {
  return (
    <div className="sketch" aria-hidden="true">
      <div className="sketch-chrome">
        <i />
        <i />
        <i />
        <span>SAMPLE-quote-list · v2</span>
      </div>
      <div className="sketch-body">
        <div className="sketch-mock">
          <div className="sketch-gnb">
            <span className="sketch-logo" />
            <span className="sketch-tab is-on" />
            <span className="sketch-tab" />
          </div>
          <div className="sketch-area">
            <span className="sketch-marker">1</span>
            <span className="sketch-field" />
            <span className="sketch-field sketch-field-wide" />
            <span className="sketch-btn" />
          </div>
          <div className="sketch-area sketch-area-tall">
            <span className="sketch-marker">2</span>
            <span className="sketch-row sketch-row-head" />
            <span className="sketch-row" />
            <span className="sketch-row" />
            <span className="sketch-row" />
          </div>
        </div>
        <div className="sketch-desc">
          <span className="sketch-desc-label">DESCRIPTION</span>
          <div className="sketch-desc-item">
            <span className="sketch-no">1</span>
            <span className="sketch-lines">
              <i className="is-title" />
              <i />
              <i className="is-short" />
            </span>
          </div>
          <div className="sketch-desc-item">
            <span className="sketch-no">2</span>
            <span className="sketch-lines">
              <i className="is-title" />
              <i />
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * 자격 증명 안내 — 확인된 사실만 적는다. **내 Claude 구독 토큰이 1순위**다(콘솔 결제 설정 없이 쓴다).
 * 서버 모드에서는 브라우저에 자격 증명을 넣지 않으므로 첫 줄을 실행 모드에 맞게 바꾼다.
 */
function KeyHelp({ open }: { open: boolean }) {
  return (
    <details className="main-help" data-testid="main-key-help" open={open}>
      <summary>내 Claude 토큰 넣는 법</summary>
      <ul>
        <li>
          {IS_DEMO
            ? '이 페이지는 서버가 없는 정적 배포라 브라우저가 직접 Anthropic API 를 호출합니다. 그래서 사용자의 자격 증명이 필요합니다.'
            : '지금 이 화면은 서버 모드로 열려 있어 모델 호출은 서버가 합니다(자격 증명은 서버 환경변수에 둡니다). 아래는 서버가 없는 정적 배포에서 브라우저가 직접 호출할 때 필요한 이야기입니다.'}
        </li>
        <li>
          <strong>내 Claude 구독 토큰 (권장)</strong> — 터미널에서 <code>claude setup-token</code> 을 실행해 받습니다(Claude Code CLI, Claude 구독이 있어야 합니다).
          받은 값을 위 패널의 <strong>토큰(OAuth)</strong> 에 붙여넣습니다. <strong>콘솔 결제 수단·크레딧 설정이 필요하지 않습니다</strong> — 구독으로 동작합니다.
        </li>
        <li>
          <strong>API 키 (대안)</strong> —{' '}
          <a href="https://platform.claude.com" target="_blank" rel="noreferrer noopener">
            platform.claude.com
          </a>{' '}
          에서 로그인 → API 키를 만들고 복사합니다(키는 만들 때 한 번만 보입니다). 이쪽은 <strong>사용한 만큼 과금</strong>되어 결제 수단·크레딧 설정이 필요합니다.
        </li>
        <li>
          <strong>만료되면</strong> 인증 실패(HTTP 401)로 끝나고 화면이 그 이유를 그대로 보여줍니다. <code>claude setup-token</code> 을 다시 실행해 새 값을 넣으면 됩니다.
        </li>
        <li>값은 이 브라우저에만 저장되고 api.anthropic.com 으로만 전송됩니다. 공용 PC 에서는 저장하지 마세요.</li>
        <li>
          아무도 자격 증명을 넣지 않게 하려면 서버를 두고 서버에 하나만 두는 방법이 있습니다 — <code>.env</code> 에{' '}
          <code>MODEL_ADAPTER=anthropic</code>, <code>MODEL_AUTH=token</code>, <code>ANTHROPIC_AUTH_TOKEN</code> 을 채웁니다(<code>docs/plan/배포.md</code>).
          Anthropic 내부 CLI 가 있는 환경이라면 <code>ant auth login</code> 프로필로 두 변수 없이도 됩니다(<code>MODEL_AUTH=auto</code>).
        </li>
      </ul>
    </details>
  )
}
