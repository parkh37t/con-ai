/** 앱 루트 — 해시 라우팅, 메타·프로젝트 로딩, 상단 바. */
import { useEffect, useState, type ReactNode } from 'react'
import { api } from './api.js'
import { ErrorBox, Loading } from './components/common.js'
import { CredentialChip, CredentialPanel } from './components/CredentialPanel.js'
import { TopBar, type TopBarSection } from './components/TopBar.js'
import { DEMO_BANNER_TEXT, DEMO_REPO_URL, IS_DEMO } from './demo-mode.js'
import { useAsync, useHashRoute } from './hooks.js'
import { ApprovePage } from './pages/ApprovePage.js'
import { AsisDetailPage } from './pages/AsisDetailPage.js'
import { AsisListPage } from './pages/AsisListPage.js'
import { DesignPage } from './pages/DesignPage.js'
import { GeneratePage } from './pages/GeneratePage.js'
import { HomePage } from './pages/HomePage.js'
import { MainPage } from './pages/MainPage.js'
import { ReferencesPage } from './pages/ReferencesPage.js'
import { ReviewPage } from './pages/ReviewPage.js'
import { SimpleHomePage } from './pages/SimpleHomePage.js'
import { hrefTo } from './router.js'

export function App() {
  const route = useHashRoute()
  const meta = useAsync(() => api.meta(), [])
  const projects = useAsync(() => api.projects(), [])

  const requestedProject = route.query['project']
  const projectList = projects.data ?? []
  const project = (requestedProject ? projectList.find((p) => p.id === requestedProject) : undefined) ?? projectList[0] ?? null

  // 메인·만들기·설계서 결과는 자체 상단 바를 가진다 — 앱 상단 바·자격 증명 패널 없이 화면만 보여준다 (UI 를 단순하게 유지).
  const simpleShell = route.name === 'main' || route.name === 'create' || route.name === 'design'

  // 자격 증명 패널은 기본으로 접혀 있다. 칩을 누르거나, 패널을 열려는 기존 진입(`?help=key` / `?cred=open`)이면 열린 채로 온다.
  const credentialRequested = route.query['help'] === 'key' || route.query['cred'] === 'open'
  const [credentialOpen, setCredentialOpen] = useState(credentialRequested)
  useEffect(() => {
    if (credentialRequested) setCredentialOpen(true)
  }, [credentialRequested])

  const current: TopBarSection =
    route.name === 'advanced'
      ? 'home'
      : route.name === 'references'
        ? 'references'
        : route.name === 'asis' || route.name === 'asis_detail'
          ? 'asis'
          : route.name === 'not_found'
            ? 'other'
            : 'screen'

  let body: ReactNode
  if (projects.error) {
    body = <ErrorBox error={projects.error} title="프로젝트 목록을 읽지 못했습니다" />
  } else if (route.name === 'design') {
    body = <DesignPage key={route.revisionId} revisionId={route.revisionId} route={route} />
  } else if (route.name === 'generate') {
    body = <GeneratePage key={route.screenId} screenId={route.screenId} route={route} />
  } else if (route.name === 'review') {
    body = <ReviewPage key={route.screenId} screenId={route.screenId} route={route} />
  } else if (route.name === 'approve') {
    body = <ApprovePage key={route.screenId} screenId={route.screenId} route={route} />
  } else if (route.name === 'asis_detail') {
    body = <AsisDetailPage key={route.analysisId} analysisId={route.analysisId} />
  } else if (route.name === 'main') {
    // 메인은 프로젝트를 아직 못 읽었어도 그린다 (히어로·프로세스·안내는 데이터가 없어도 맞는 말이다).
    body = <MainPage key={project?.id ?? 'no-project'} project={project} meta={meta.data} route={route} />
  } else if (!projects.data) {
    body = <Loading text="프로젝트를 불러오는 중…" />
  } else if (!project) {
    body = <div className="empty">프로젝트가 없습니다. API 의 시드 데이터(계약 §10)가 만들어졌는지 확인하세요.</div>
  } else if (route.name === 'create') {
    body = <SimpleHomePage key={project.id} project={project} meta={meta.data} route={route} />
  } else if (route.name === 'advanced') {
    body = <HomePage key={project.id} project={project} projects={projectList} meta={meta.data} />
  } else if (route.name === 'references') {
    body = <ReferencesPage key={project.id} projectId={project.id} />
  } else if (route.name === 'asis') {
    body = <AsisListPage key={project.id} project={project} />
  } else {
    body = (
      <div className="empty">
        알 수 없는 경로입니다: <code>{route.path}</code> · <a href={hrefTo('main')}>메인 화면으로</a>
      </div>
    )
  }

  if (simpleShell) {
    return (
      <div className={`app app-simple${route.name === 'main' ? ' app-main' : ''}`}>
        <DemoBanner />
        <main className="main main-simple">{body}</main>
      </div>
    )
  }

  return (
    <div className="app">
      {/* 상단 도크 — 내비 한 줄이 기준선이고, 자격 증명 패널은 그 아래로 필요할 때만 펼쳐진다.
          데모 안내는 별도 띠가 아니라 내비 오른쪽 칩으로 흡수해 상단 겹침(배너+패널+내비+헤더)을 없앴다. */}
      <div className="topdock">
        <TopBar
          meta={meta.data}
          metaError={meta.error}
          current={current}
          /* 정적 배포에서만 자격 증명을 다룬다. 서버 모드에서는 모델 호출이 서버 어댑터의 몫이라 화면에 인증정보를 두지 않는다. */
          credentialChip={IS_DEMO ? <CredentialChip open={credentialOpen} onToggle={() => setCredentialOpen((v) => !v)} /> : null}
        />
        {IS_DEMO && <CredentialPanel open={credentialOpen} onClose={() => setCredentialOpen(false)} onChanged={() => meta.reload()} />}
      </div>
      <main className="main">{body}</main>
    </div>
  )
}

/** 정적 데모(GitHub Pages) 안내 — 자체 상단 바를 쓰는 화면(메인·만들기·설계서)에서만 한 줄 띠로 남긴다. */
function DemoBanner() {
  if (!IS_DEMO) return null
  return (
    <div className="demo-banner" data-testid="demo-banner" role="note">
      <span>{DEMO_BANNER_TEXT}</span>
      <a href={DEMO_REPO_URL} target="_blank" rel="noreferrer noopener">
        저장소 parkh37t/con-ai
      </a>
    </div>
  )
}
