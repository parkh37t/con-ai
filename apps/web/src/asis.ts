/**
 * AS-IS 분석 표시 로직 (순수 함수) — 계약 §12. 상태·심각도·실패 코드의 한국어 표시,
 * 목록 요약의 페인포인트 수 읽기, 구조 요약 표 행 구성, URL 입력 검사.
 */
import type { AsisAnalysisSummary, AsisStatus, AsisStructure, PainPoint, PainPointSeverity, PainPointStatus } from './types.js'

/** API 서버가 직접 제공하는 합성 레거시 데모 페이지 (계약 §12, e2e 대상). */
export const ASIS_SAMPLE_URL = 'http://localhost:8787/asis-sample'
export const ASIS_SAMPLE_PATH = '/asis-sample'

export type Tone = 'gray' | 'green' | 'red' | 'amber' | 'blue' | 'purple'

export const ASIS_STATUS_LABELS: Readonly<Record<AsisStatus, string>> = {
  queued: '대기',
  running: '실행 중',
  succeeded: '성공',
  failed: '실패',
}
const ASIS_STATUS_TONES: Readonly<Record<AsisStatus, Tone>> = { queued: 'gray', running: 'blue', succeeded: 'green', failed: 'red' }

export function asisStatusLabel(status: string): string {
  return (ASIS_STATUS_LABELS as Record<string, string | undefined>)[status] ?? status
}
export function asisStatusTone(status: string): Tone {
  return (ASIS_STATUS_TONES as Record<string, Tone | undefined>)[status] ?? 'gray'
}

/** 종료 상태이면 폴링을 멈춘다. */
export function isTerminalAsis(status: AsisStatus): boolean {
  return status === 'succeeded' || status === 'failed'
}

export const SEVERITY_LABELS: Readonly<Record<PainPointSeverity, string>> = { high: '높음', medium: '중간', low: '낮음' }
/** 심각도 배지 색 — high 빨강, medium 주황, low 회색. */
const SEVERITY_TONES: Readonly<Record<PainPointSeverity, Tone>> = { high: 'red', medium: 'amber', low: 'gray' }

export function severityLabel(severity: string): string {
  return (SEVERITY_LABELS as Record<string, string | undefined>)[severity] ?? severity
}
export function severityTone(severity: string): Tone {
  return (SEVERITY_TONES as Record<string, Tone | undefined>)[severity] ?? 'gray'
}

export const PAIN_POINT_STATUS_LABELS: Readonly<Record<PainPointStatus, string>> = {
  proposed: '제안',
  adopted: '채택',
  rejected: '거부',
}
const PAIN_POINT_STATUS_TONES: Readonly<Record<PainPointStatus, Tone>> = { proposed: 'blue', adopted: 'green', rejected: 'gray' }

export function painPointStatusLabel(status: string): string {
  return (PAIN_POINT_STATUS_LABELS as Record<string, string | undefined>)[status] ?? status
}
export function painPointStatusTone(status: string): Tone {
  return (PAIN_POINT_STATUS_TONES as Record<string, Tone | undefined>)[status] ?? 'gray'
}

/** 실패 코드의 한국어 표시 (계약 §12: navigation·browser·draft·internal). 모르는 코드는 그대로. */
export const ASIS_FAILURE_LABELS: Readonly<Record<string, string>> = {
  navigation: '페이지 이동 실패',
  browser: '브라우저 실행 실패',
  draft: '페인포인트 초안 생성 실패',
  blocked: '정책 차단 (사설·내부 주소)',
  internal: '내부 오류',
}
export function asisFailureLabel(code: string | undefined): string {
  if (!code) return '원인 미상'
  return ASIS_FAILURE_LABELS[code] ?? code
}

/**
 * 목록 요약의 페인포인트 수. 계약 §12 는 "페인포인트 수" 만 명시해 필드명이 고정되지 않았으므로
 * `pain_point_count`(숫자) / `pain_points`(숫자 또는 배열) 어느 쪽이 와도 읽는다. 알 수 없으면 null.
 */
export function painPointCountOf(summary: Pick<AsisAnalysisSummary, 'pain_point_count' | 'pain_points'>): number | null {
  if (typeof summary.pain_point_count === 'number' && Number.isFinite(summary.pain_point_count)) return summary.pain_point_count
  if (typeof summary.pain_points === 'number' && Number.isFinite(summary.pain_points)) return summary.pain_points
  if (Array.isArray(summary.pain_points)) return summary.pain_points.length
  return null
}

/** 실행 폼의 URL 검사 (계약 §12: http/https 만). 문제 없으면 null, 있으면 한국어 오류 문구. */
export function validateAsisUrl(url: string): string | null {
  const t = url.trim()
  if (!t) return '분석할 URL 을 입력하세요.'
  if (!/^https?:\/\//i.test(t)) return 'http:// 또는 https:// 로 시작하는 URL 만 분석할 수 있습니다.'
  try {
    new URL(t)
  } catch {
    return 'URL 형식이 올바르지 않습니다.'
  }
  return null
}

export interface StructureRow {
  key: string
  label: string
  value: string
}

function num(v: number | undefined): string {
  return typeof v === 'number' && Number.isFinite(v) ? String(v) : '—'
}
function text(v: string | undefined): string {
  return v && v.trim() ? v : '—'
}

/** 구조 요약 표 행 — 제목·언어·설명과 counts(레이블 없는 필드, alt 없는 이미지 등). */
export function structureSummaryRows(structure: AsisStructure | null | undefined): StructureRow[] {
  if (!structure) return []
  const forms = structure.forms ?? []
  const fieldCount = forms.reduce((n, f) => n + (f.fields?.length ?? 0), 0)
  const c = structure.counts
  return [
    { key: 'title', label: '제목 (title)', value: text(structure.title) },
    { key: 'lang', label: '언어 (lang)', value: text(structure.lang) },
    { key: 'description', label: '설명 (meta description)', value: text(structure.description) },
    { key: 'headings', label: '헤딩 수 (h1~h3, 상위 30)', value: String((structure.headings ?? []).length) },
    { key: 'nav_links', label: '내비 링크 수 (상위 30)', value: String((structure.nav_links ?? []).length) },
    { key: 'forms', label: '폼 수', value: String(forms.length) },
    { key: 'fields', label: '폼 필드 수', value: String(fieldCount) },
    { key: 'fields_without_label', label: '레이블 없는 필드 수', value: num(c?.fields_without_label) },
    { key: 'buttons', label: '버튼 수 (상위 30)', value: String((structure.buttons ?? []).length) },
    { key: 'links', label: '링크 수 (전체)', value: num(c?.links) },
    { key: 'images', label: '이미지 수', value: num(c?.images) },
    { key: 'images_without_alt', label: 'alt 없는 이미지 수', value: num(c?.images_without_alt) },
    { key: 'tables', label: '표 수', value: num(c?.tables) },
    { key: 'iframes', label: 'iframe 수', value: num(c?.iframes) },
  ]
}

// ---------------------------------------------------------------- 발견된 신호 (문제 있는 항목만)

/** 내비 링크가 이보다 많으면 "평평한 메뉴" 로 본다 (페인포인트 초안 규칙과 같은 기준). */
export const NAV_LINK_LIMIT = 15

export interface AsisSignal {
  key: string
  /** 무엇이 문제인지 (짧은 명사구) */
  label: string
  /** 수치 — 정상값과 구분되게 크게 보여준다 */
  value: string
  /** 왜 문제인지 한 문장 */
  hint: string
}

/**
 * 구조 요약 중 **문제 있는 항목만** 고른다. 정상값은 여기 넣지 않는다
 * (전체 표는 접힘으로 따로 둔다 — 문제가 정상값에 묻히지 않게).
 */
export function asisSignalRows(structure: AsisStructure | null | undefined): AsisSignal[] {
  if (!structure) return []
  const c = structure.counts
  const signals: AsisSignal[] = []

  const noLabel = c?.fields_without_label
  if (typeof noLabel === 'number' && noLabel > 0) {
    signals.push({
      key: 'fields_without_label',
      label: '레이블 없는 입력 필드',
      value: `${noLabel}개`,
      hint: '무엇을 넣는 칸인지 추측해야 하고, 스크린리더가 항목 이름을 읽지 못한다.',
    })
  }

  const noAlt = c?.images_without_alt
  if (typeof noAlt === 'number' && noAlt > 0) {
    signals.push({
      key: 'images_without_alt',
      label: 'alt 없는 이미지',
      value: `${noAlt}개`,
      hint: '이미지가 전달하는 정보를 텍스트로는 얻을 수 없다.',
    })
  }

  const h1 = (structure.headings ?? []).filter((h) => h.level === 1).length
  if (h1 === 0) {
    signals.push({
      key: 'h1_missing',
      label: 'h1 제목',
      value: '0건',
      hint: '페이지 주제를 나타내는 최상위 제목이 없어 문서 구조·검색 탐색이 어렵다.',
    })
  }

  const navCount = (structure.nav_links ?? []).length
  if (navCount > NAV_LINK_LIMIT) {
    signals.push({
      key: 'nav_links',
      label: '내비게이션 링크',
      value: `${navCount}개`,
      hint: `기준 ${NAV_LINK_LIMIT}개를 넘어 메뉴가 평평하다. 원하는 항목을 찾으려면 전체를 훑어야 한다.`,
    })
  }

  const iframes = c?.iframes
  if (typeof iframes === 'number' && iframes > 0) {
    signals.push({
      key: 'iframes',
      label: 'iframe 삽입',
      value: `${iframes}개`,
      hint: '반응형·접근성·보안 정책을 본문과 함께 제어하기 어렵다.',
    })
  }

  if (!structure.description || !structure.description.trim()) {
    signals.push({
      key: 'description',
      label: 'meta description',
      value: '없음',
      hint: '검색 결과·링크 공유 미리보기에서 서비스 설명이 비어 보인다.',
    })
  }

  return signals
}

// ---------------------------------------------------------------- 페인포인트 필터·집계

export type SeverityFilter = 'all' | PainPointSeverity
export type PainPointStatusFilter = 'all' | PainPointStatus

export interface PainPointTally {
  total: number
  proposed: number
  adopted: number
  rejected: number
}

/** 상태별 건수 — 필터와 무관하게 전체를 센다. */
export function painPointTally(list: readonly Pick<PainPoint, 'status'>[]): PainPointTally {
  const tally: PainPointTally = { total: list.length, proposed: 0, adopted: 0, rejected: 0 }
  for (const p of list) {
    if (p.status === 'proposed') tally.proposed += 1
    else if (p.status === 'adopted') tally.adopted += 1
    else if (p.status === 'rejected') tally.rejected += 1
  }
  return tally
}

/** 심각도·상태 칩 필터. 'all' 은 거르지 않는다 (기본값이므로 순서·건수가 원본 그대로여야 한다). */
export function filterPainPoints<T extends Pick<PainPoint, 'severity' | 'status'>>(
  list: readonly T[],
  severity: SeverityFilter,
  status: PainPointStatusFilter,
): T[] {
  return list.filter((p) => (severity === 'all' || p.severity === severity) && (status === 'all' || p.status === status))
}

/** 분석 소요 시간 — 생성/종료 시각이 없거나 뒤집혀 있으면 null (없는 값을 0 으로 위장하지 않는다). */
export function asisDurationLabel(createdAt: string | undefined, finishedAt: string | undefined): string | null {
  if (!createdAt || !finishedAt) return null
  const start = new Date(createdAt).getTime()
  const end = new Date(finishedAt).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null
  const ms = end - start
  if (ms < 1000) return `${ms}ms`
  const sec = ms / 1000
  return sec < 60 ? `${sec.toFixed(1)}초` : `${Math.floor(sec / 60)}분 ${Math.round(sec % 60)}초`
}
