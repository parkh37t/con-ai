/**
 * AS-IS 분석 표시 로직 (순수 함수) — 계약 §12. 상태·심각도·실패 코드의 한국어 표시,
 * 목록 요약의 페인포인트 수 읽기, 구조 요약 표 행 구성, URL 입력 검사.
 */
import type { AsisAnalysisSummary, AsisStatus, AsisStructure, PainPointSeverity, PainPointStatus } from './types.js'

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
