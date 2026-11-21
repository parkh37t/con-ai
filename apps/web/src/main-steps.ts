/**
 * 메인 화면(`#/`)의 4단계 프로세스 카드 — 순수 데이터·규칙 (CLAUDE.md 의 제품 목적 4단계).
 *
 * 카드마다 "지금 이 실행 모드에서 되는 일인가" 를 표시한다. 브라우저(정적 배포)에는 서버가 없어
 * AS-IS 분석(Playwright 로 대상 사이트 방문)과 완료·이관(v1.0 폴더 저장)이 동작하지 않는다.
 * 되지 않는 것을 "지금 가능" 으로 표시하지 않는다.
 */
import { hrefTo, type FlatRouteName } from './router.js'

export interface ProcessStep {
  /** 카드 좌상단 검은 사각 배지의 번호 (1~4). */
  no: number
  title: string
  body: string
  /** 카드를 누르면 가는 화면. */
  route: FlatRouteName
  /** 서버(Node + Chromium + 저장소)가 있어야 동작하는 단계인가. */
  needsServer: boolean
}

/** 제품 목적의 4단계 (CLAUDE.md). 순서를 바꾸지 않는다 — 번호 배지가 곧 프로세스 순서다. */
export const PROCESS_STEPS: readonly ProcessStep[] = [
  { no: 1, title: 'AS-IS 분석', body: '대상 서비스를 분석해 페인포인트를 찾습니다', route: 'asis', needsServer: true },
  { no: 2, title: '생성', body: '요구사항과 IA 를 반영해 화면설계서를 만듭니다', route: 'create', needsServer: false },
  { no: 3, title: '검토', body: '화면·설명을 클릭해 의견을 남기고 바로 수정합니다', route: 'advanced', needsServer: false },
  { no: 4, title: '완료·이관', body: 'v1.0 으로 확정해 디자인 단계로 넘깁니다', route: 'advanced', needsServer: true },
]

export interface StepStatus {
  kind: 'now' | 'server_required'
  label: string
  /** 마우스를 올렸을 때 보이는 이유. */
  title: string
}

export const STEP_STATUS_NOW = '지금 가능'
export const STEP_STATUS_SERVER = '서버 실행 필요'

/**
 * 카드 우하단 배지.
 * - 서버 모드(`pnpm serve`·`pnpm dev`)에서는 네 단계 모두 동작한다.
 * - 브라우저 모드(정적 배포)에서는 서버가 필요한 단계를 "서버 실행 필요" 로 적는다.
 */
export function stepStatus(step: Pick<ProcessStep, 'needsServer'>, opts: { browserMode: boolean }): StepStatus {
  if (step.needsServer && opts.browserMode) {
    return {
      kind: 'server_required',
      label: STEP_STATUS_SERVER,
      title: '이 페이지는 서버가 없는 정적 배포입니다. 이 단계는 로컬·사내 서버 실행(pnpm serve)에서 동작합니다.',
    }
  }
  return { kind: 'now', label: STEP_STATUS_NOW, title: '지금 이 실행 모드에서 동작합니다.' }
}

/** 카드 링크(해시). */
export function stepHref(step: Pick<ProcessStep, 'route'>): string {
  return hrefTo(step.route)
}
