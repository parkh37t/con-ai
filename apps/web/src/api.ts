/**
 * API 클라이언트 — 세로 조각 계약 §7 의 엔드포인트를 타입이 있는 함수로 감싼다.
 * 오류는 ApiError({status, reasons}) 로 던지고 화면이 그대로 보여준다. 모델 키·인증정보는 여기 없다 (호출은 서버 어댑터만).
 */
import type {
  ApprovalResponse,
  AsisAnalysis,
  AsisAnalysisSummary,
  Comment,
  CommentInput,
  CommentStatus,
  ExportManifest,
  Job,
  Meta,
  PainPointStatus,
  Project,
  ProjectDetail,
  PromptPreviewResponse,
  ReasonLike,
  Reference,
  RevisionDetail,
  RevisionPromptDraft,
  ScreenDetail,
  SliceGenerationRequest,
  ValidationResult,
} from './types.js'
import { handle as demoHandle } from './demo-api.js'
import { DEMO_BASE, IS_DEMO } from './demo-mode.js'
import { exportFileUrl } from './export-paths.js'

export class ApiError extends Error {
  override readonly name = 'ApiError'
  readonly status: number
  readonly reasons: string[]
  readonly path: string

  constructor(path: string, status: number, message: string, reasons: string[] = []) {
    super(message)
    this.path = path
    this.status = status
    this.reasons = reasons
  }
}

/** domain RuleReason[] / 문자열[] / 단일 문자열을 표시용 문자열 목록으로 통일한다. */
export function normalizeReasons(raw: unknown): string[] {
  if (raw === undefined || raw === null) return []
  const list: unknown[] = Array.isArray(raw) ? raw : [raw]
  const out: string[] = []
  for (const item of list) {
    if (typeof item === 'string') {
      if (item.trim()) out.push(item)
    } else if (typeof item === 'object' && item !== null) {
      const r = item as Partial<Exclude<ReasonLike, string>> & { path?: unknown }
      const msg = typeof r.message === 'string' ? r.message : ''
      const code = typeof r.code === 'string' ? r.code : ''
      const path = Array.isArray(r.path) ? r.path.map(String).join('.') : ''
      const text = [code ? `[${code}]` : '', path ? `${path}:` : '', msg].filter(Boolean).join(' ')
      if (text) out.push(text)
    }
  }
  return out
}

/** 오류 본문에서 메시지·이유를 뽑는다 (`{error}`, `{message}`, `{reasons}`, `{issues}`, `{details}` 어느 형태든). */
export function extractError(status: number, body: unknown, fallback: string): { message: string; reasons: string[] } {
  const withStatus = (m: string) => (status === 0 ? m : `${m} (HTTP ${status})`)
  if (typeof body === 'string' && body.trim()) return { message: body.slice(0, 500), reasons: [] }
  if (typeof body !== 'object' || body === null) return { message: withStatus(fallback), reasons: [] }
  const b = body as Record<string, unknown>
  const message = [b['error'], b['message'], b['title']].find((v): v is string => typeof v === 'string' && v.trim().length > 0) ?? fallback
  const reasons = [...normalizeReasons(b['reasons']), ...normalizeReasons(b['issues']), ...normalizeReasons(b['details']), ...normalizeReasons(b['errors'])]
  return { message: withStatus(message), reasons }
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return undefined
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

async function request<T>(method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown): Promise<T> {
  // 정적 데모 빌드(VITE_DEMO=1)에서는 서버 대신 스냅샷 기반 인메모리 핸들러가 응답한다.
  // 오류 형태·ApiError 는 아래 실제 호출 경로와 똑같이 유지한다. 일반 빌드에서는 이 분기가 통째로 제거된다.
  if (IS_DEMO) {
    let result: { status: number; data: unknown }
    try {
      result = await demoHandle(method, path, body)
    } catch (e) {
      throw new ApiError(path, 0, `정적 데모 데이터를 읽을 수 없습니다 (${path}). ${e instanceof Error ? e.message : ''}`.trim())
    }
    if (result.status < 200 || result.status >= 300) {
      const { message, reasons } = extractError(result.status, result.data, `${method} ${path} 요청이 실패했습니다`)
      throw new ApiError(path, result.status, message, reasons)
    }
    return result.data as T
  }
  const init: RequestInit = { method, headers: { Accept: 'application/json' } }
  if (body !== undefined) {
    init.headers = { Accept: 'application/json', 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  let res: Response
  try {
    res = await fetch(path, init)
  } catch (e) {
    throw new ApiError(path, 0, `API 에 연결할 수 없습니다 (${path}). API 서버(8787)가 실행 중인지 확인하세요. ${e instanceof Error ? e.message : ''}`.trim())
  }
  const data = await readBody(res)
  if (!res.ok) {
    const { message, reasons } = extractError(res.status, data, `${method} ${path} 요청이 실패했습니다`)
    throw new ApiError(path, res.status, message, reasons)
  }
  return data as T
}

export const api = {
  meta: () => request<Meta>('GET', '/api/meta'),
  projects: () => request<Project[]>('GET', '/api/projects'),
  project: (id: string) => request<ProjectDetail>('GET', `/api/projects/${encodeURIComponent(id)}`),
  references: (projectId: string) => request<Reference[]>('GET', `/api/projects/${encodeURIComponent(projectId)}/references`),
  promptPreview: (screenId: string, req: SliceGenerationRequest) => request<PromptPreviewResponse>('POST', `/api/screens/${encodeURIComponent(screenId)}/prompt-preview`, req),
  createJob: (screenId: string, req: SliceGenerationRequest) => request<{ job_id: string }>('POST', `/api/screens/${encodeURIComponent(screenId)}/generation-jobs`, req),
  job: (id: string) => request<Job>('GET', `/api/jobs/${encodeURIComponent(id)}`),
  screen: (id: string) => request<ScreenDetail>('GET', `/api/screens/${encodeURIComponent(id)}`),
  revision: (id: string) => request<RevisionDetail>('GET', `/api/revisions/${encodeURIComponent(id)}`),
  /** 격리 iframe 이 읽는 산출물 HTML. 데모에서는 스냅샷이 떠 둔 정적 파일(`<base>demo/artifacts/…`)을 가리킨다. */
  artifactHtmlUrl: (artifactId: string) => (IS_DEMO ? `${DEMO_BASE}artifacts/${encodeURIComponent(artifactId)}.html` : `/api/artifacts/${encodeURIComponent(artifactId)}/html`),
  revalidate: (artifactId: string) => request<ValidationResult[] | { validation_results: ValidationResult[] }>('POST', `/api/artifacts/${encodeURIComponent(artifactId)}/validations`),
  createComment: (revisionId: string, input: CommentInput) => request<Comment>('POST', `/api/revisions/${encodeURIComponent(revisionId)}/comments`, input),
  patchComment: (id: string, body: { status: CommentStatus; revision: number }) => request<Comment>('PATCH', `/api/comments/${encodeURIComponent(id)}`, body),
  revisionPrompt: (revisionId: string, commentIds: string[]) => request<RevisionPromptDraft>('POST', `/api/revisions/${encodeURIComponent(revisionId)}/revision-prompt`, { comment_ids: commentIds }),
  approve: (screenId: string, body: { revision_id: string; approver: string }) => request<ApprovalResponse>('POST', `/api/screens/${encodeURIComponent(screenId)}/approvals`, body),
  /** 내보낸 manifest.json — 승인 응답에 manifest 가 없을 때 읽는다. */
  exportManifest: (exportPath: string) => request<ExportManifest>('GET', exportFileUrl(exportPath, 'manifest.json')),

  // -------------------------------------------------------------- AS-IS 분석 (계약 §12)
  /** 분석 실행 — 202 `{analysis_id}`. http/https URL 만 (서버가 다시 검사한다). */
  createAsisAnalysis: (projectId: string, body: { url: string; note?: string }) =>
    request<{ analysis_id: string }>('POST', `/api/projects/${encodeURIComponent(projectId)}/asis-analyses`, body),
  /** 프로젝트의 분석 목록 요약 (id, url, status, 페인포인트 수, created_at). */
  asisAnalyses: (projectId: string) => request<AsisAnalysisSummary[]>('GET', `/api/projects/${encodeURIComponent(projectId)}/asis-analyses`),
  /** 분석 문서 전체 (structure·screenshots·summary·pain_points·failure). */
  asisAnalysis: (id: string) => request<AsisAnalysis>('GET', `/api/asis-analyses/${encodeURIComponent(id)}`),
  /** 페인포인트 채택/거부 — 갱신된 문서를 돌려받는다. revision 은 낙관적 잠금. */
  patchAsisPainPoint: (analysisId: string, painPointId: string, body: { status: PainPointStatus; revision: number }) =>
    request<AsisAnalysis>('PATCH', `/api/asis-analyses/${encodeURIComponent(analysisId)}/pain-points/${encodeURIComponent(painPointId)}`, body),
  /** 스크린샷 PNG URL (image/png). 데모에서는 스냅샷이 떠 둔 정적 파일(`<base>demo/asis/…`)을 가리킨다. */
  asisAssetUrl: (assetId: string) => (IS_DEMO ? `${DEMO_BASE}asis/${encodeURIComponent(assetId)}.png` : `/api/asis-assets/${encodeURIComponent(assetId)}`),
}

/** 화면 표시용 오류 문자열. */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message
  if (e instanceof Error) return e.message
  return String(e)
}

export function errorReasons(e: unknown): string[] {
  return e instanceof ApiError ? e.reasons : []
}
