/**
 * 정적 배포의 「① AS-IS 분석」 샘플 대상.
 *
 * 브라우저는 다른 사이트를 캡처할 수 없다(그건 지금도 정직하게 실패한다). 대신 **미리 분석해 둔 합성 대상**을 고르면
 * 그 구조에 페인포인트 규칙을 **실제로 돌린다**.
 *
 * 무엇이 진짜이고 무엇이 기록인지
 * - **기록**: 페이지 구조(structure)와 스크린샷 2장. `pnpm demo:snapshot` 이 서버의 실제 분석기(Playwright)로
 *   합성 페이지(`/asis-sample`, `/asis-sample-2`)를 분석해 남긴 값이다. 손으로 지어낸 값이 아니다.
 * - **지금 실행**: 페인포인트 초안. 서버와 같은 `FixtureAdapter.draftPainPoints` 규칙을 이 브라우저에서 돌린다.
 * - 대상은 전부 **가상 데이터**다. 실제 고객 사이트를 복제하지 않는다.
 */
import { DEMO_BASE } from './demo-mode.js'
import type { AsisStructure } from './browser-run/deps.js'

/** `demo/asis-samples.json` 한 항목. */
export interface AsisSampleTarget {
  id: string
  label: string
  description: string
  /** 화면에 보여줄 대상 주소. 이 브라우저가 다시 접속하지는 않는다 (가상 호스트). */
  url: string
  captured_at: string
  structure: AsisStructure
  screenshots: { desktop: string; mobile: string }
}

/** 이 대상이 「미리 분석해 둔 샘플」이라는 사실을 화면·문서에 같은 문장으로 적는다. */
export const ASIS_SAMPLE_NOTE =
  '미리 분석해 둔 합성 대상입니다 — 페이지 구조·스크린샷은 서버 분석기(Playwright)가 남긴 기록이고, 페인포인트는 지금 이 브라우저에서 규칙으로 만듭니다.'

let cache: Promise<AsisSampleTarget[]> | null = null

/** 샘플 목록을 읽는다. 파일이 없으면 빈 목록 — 없는 대상을 지어내지 않는다. */
export async function loadAsisSamples(): Promise<AsisSampleTarget[]> {
  if (!cache) {
    cache = fetch(`${DEMO_BASE}asis-samples.json`, { headers: { Accept: 'application/json' } })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as unknown
        return Array.isArray(data) ? (data as AsisSampleTarget[]) : []
      })
      .catch(() => [])
  }
  return cache
}

/** 테스트·다시 읽기용. */
export function setAsisSamples(list: AsisSampleTarget[] | null): void {
  cache = list === null ? null : Promise.resolve(list)
}

/** URL 이 샘플 대상인가 (정확히 같을 때만 — 비슷한 주소를 샘플로 처리하지 않는다). */
export function findAsisSample(list: readonly AsisSampleTarget[], url: string): AsisSampleTarget | undefined {
  const wanted = url.trim()
  return list.find((s) => s.url === wanted)
}
