/**
 * 정적 데모 모드 스위치 (GitHub Pages 배포용).
 *
 * `VITE_DEMO=1` 로 빌드했을 때만 켜진다 (`pnpm demo:build`). 값은 빌드 시점에 상수로 치환되므로
 * 일반 빌드·개발 서버에서는 `IS_DEMO` 가 false 이고 데모 코드 경로는 그대로 제거된다.
 * 데모가 아닐 때 동작은 이 파일을 쓰기 전과 완전히 같아야 한다.
 */

/** 정적 데모 빌드 여부. */
export const IS_DEMO: boolean = import.meta.env.VITE_DEMO === '1'

/** 데모 정적 산출물의 기준 경로 (`<base>demo/`). GitHub Pages 의 하위 경로(`/con-ai/`) 배포를 위해 BASE_URL 을 쓴다. */
export const DEMO_BASE = `${import.meta.env.BASE_URL ?? '/'}demo/`

/** 데모 배너 문구·링크. */
export const DEMO_BANNER_TEXT = '정적 데모 — 실제 URL 분석과 모델 호출은 로컬 실행에서 동작합니다'
export const DEMO_REPO_URL = 'https://github.com/parkh37t/con-ai'
