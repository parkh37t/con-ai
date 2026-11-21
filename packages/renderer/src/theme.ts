/**
 * 브랜드 테마 — 목업이 «설계용 와이어프레임» 이 아니라 **실제 서비스 화면**으로 보이게 하는 값들.
 *
 * 왜 필요한가: 화면설계서의 목업은 디자이너·고객이 「이 화면이 어떤 모습이 되는가」를 보는 자리다.
 * 회색 상자와 검은 버튼만 있으면 구조는 읽히지만 «만들어질 화면» 은 보이지 않는다.
 * 그래서 색·글꼴 굵기·모서리·그림자·상단 바를 프로젝트의 브랜드로 갈아끼운다.
 *
 * 규칙
 * - **외부 자원을 쓰지 않는다.** 웹폰트·이미지·CDN 링크 없음 (V2.no_external_refs). 로고는 인라인 SVG 도형이다.
 * - 색은 CSS 변수로만 주입한다. 클래스 이름과 구조는 그대로다 — V2 구조 검사가 보는 것을 바꾸지 않는다.
 * - 값은 **합성 브랜드**다. 실제 회사의 로고·정확한 색을 복제하지 않는다.
 */

export interface BrandTheme {
  id: string
  name: string
  /** 주색 — GNB 강조·주요 버튼·링크·표 머리. */
  primary: string
  /** 주색 위에 얹는 글자색. */
  on_primary: string
  /** 포인트 — 배지·강조 문구·로고 한 조각. */
  accent: string
  /** 상단 유틸 바(짙은 띠) 배경. */
  top_bar: string
  /** 제목 글자. */
  ink: string
  /** 본문 글자. */
  text: string
  /** 보조 글자. */
  muted: string
  /** 경계선. */
  line: string
  /** 카드·입력 배경. */
  surface: string
  /** 화면 바탕 (카드 뒤). */
  canvas: string
  /** 모서리 반경 (px). */
  radius: number
  /** 상태 색 3종 — 표의 상태 pill 에 쓴다. 배경까지 정해 둔다 (색 계산 함수에 기대지 않는다). */
  ok: string
  ok_bg: string
  warn: string
  warn_bg: string
  danger: string
  danger_bg: string
}

/** 기본 테마 — 프로젝트에 테마가 없을 때. 중립적이되 «설계 문서» 가 아니라 «제품 화면» 으로 보이게 한다. */
export const DEFAULT_BRAND_THEME: BrandTheme = {
  id: 'neutral',
  name: '기본',
  primary: '#1f4fd8',
  on_primary: '#ffffff',
  accent: '#e0245e',
  top_bar: '#141a2b',
  ink: '#101527',
  text: '#333a4d',
  muted: '#6b7280',
  line: '#e3e7ef',
  surface: '#ffffff',
  canvas: '#f5f7fb',
  radius: 12,
  ok: '#1f7a4d',
  ok_bg: '#e3f4ea',
  warn: '#a3620b',
  warn_bg: '#fdf1dc',
  danger: '#b42318',
  danger_bg: '#fde8e6',
}

/**
 * 프로젝트별 합성 브랜드. 실제 회사의 자산이 아니라 **이 저장소가 만든 예시 색**이다.
 * (금융은 짙은 남색 + 포인트, 커머스는 따뜻한 색 — 업종의 관습을 따랐을 뿐이다.)
 */
export const BRAND_THEMES: Readonly<Record<string, BrandTheme>> = {
  neutral: DEFAULT_BRAND_THEME,
  /** 파트너 견적 포털 — 신뢰감 있는 청록 계열. */
  partner: {
    ...DEFAULT_BRAND_THEME,
    id: 'partner',
    name: '파트너 포털',
    primary: '#0f5f8f',
    accent: '#f0782d',
    top_bar: '#0b2436',
    ink: '#0d1b26',
    canvas: '#f2f6f9',
  },
  /** 뱅킹 — 짙은 남색 + 선명한 포인트. */
  banking: {
    ...DEFAULT_BRAND_THEME,
    id: 'banking',
    name: '뱅킹',
    primary: '#0c2071',
    accent: '#f21d85',
    top_bar: '#081540',
    ink: '#101736',
    text: '#3a4157',
    muted: '#6b7390',
    line: '#e3e7f0',
    canvas: '#eef1f8',
    radius: 14,
  },
  /** 커머스 — 따뜻한 코랄. */
  commerce: {
    ...DEFAULT_BRAND_THEME,
    id: 'commerce',
    name: '커머스',
    primary: '#d64545',
    accent: '#f2a03d',
    top_bar: '#2a1a1a',
    ink: '#241716',
    canvas: '#fbf6f4',
    radius: 10,
  },
}

/** id 로 테마를 고른다. 모르는 id 면 기본 테마 (없는 브랜드를 지어내지 않는다). */
export function themeById(id: string | undefined): BrandTheme {
  if (id === undefined) return DEFAULT_BRAND_THEME
  return BRAND_THEMES[id] ?? DEFAULT_BRAND_THEME
}

/** 색 문자열이 CSS 에 넣어도 안전한 값인지 — 주입을 막는다 (#rgb/#rrggbb 만 받는다). */
export function isSafeColor(value: string): boolean {
  return /^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$/.test(value)
}

/**
 * 테마 → CSS 변수 블록. 값이 색 형식이 아니면 기본 테마 값으로 되돌린다
 * (모델이나 저장 데이터에서 온 값이 스타일에 끼어들지 못하게 한다).
 */
export function themeStyle(theme: BrandTheme): string {
  const safe = (value: string, fallback: string): string => (isSafeColor(value) ? value : fallback)
  const d = DEFAULT_BRAND_THEME
  const radius = Number.isFinite(theme.radius) ? Math.min(24, Math.max(0, Math.round(theme.radius))) : d.radius
  return [
    ':root{',
    `--brand:${safe(theme.primary, d.primary)};`,
    `--brand-on:${safe(theme.on_primary, d.on_primary)};`,
    `--brand-accent:${safe(theme.accent, d.accent)};`,
    `--brand-top:${safe(theme.top_bar, d.top_bar)};`,
    `--brand-ink:${safe(theme.ink, d.ink)};`,
    `--brand-text:${safe(theme.text, d.text)};`,
    `--brand-muted:${safe(theme.muted, d.muted)};`,
    `--brand-line:${safe(theme.line, d.line)};`,
    `--brand-surface:${safe(theme.surface, d.surface)};`,
    `--brand-canvas:${safe(theme.canvas, d.canvas)};`,
    `--brand-ok:${safe(theme.ok, d.ok)};`,
    `--brand-ok-bg:${safe(theme.ok_bg, d.ok_bg)};`,
    `--brand-warn:${safe(theme.warn, d.warn)};`,
    `--brand-warn-bg:${safe(theme.warn_bg, d.warn_bg)};`,
    `--brand-danger:${safe(theme.danger, d.danger)};`,
    `--brand-danger-bg:${safe(theme.danger_bg, d.danger_bg)};`,
    `--brand-radius:${radius}px;`,
    '}',
  ].join('')
}
