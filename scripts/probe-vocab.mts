/**
 * 어휘 사용 점검 — **모델이 히어로·KPI 인포스트립·카드 그리드를 실제로 쓰는지** 본다.
 *
 * 왜 스크립트인가: 「모델이 새 어휘를 안 쓴다」는 한 건씩 눌러 봐서는 안 보이는 **분포**의 성질이다.
 * 그리고 fixture 어댑터는 규칙으로 답하므로 이 질문에 답할 수 없다 — 실제 모델이 있어야 답이 나온다.
 *
 * 왜 `pnpm check` 에 넣지 않는가: 비결정적이고 유료다. 검사는 사람이 키를 넣고 따로 돌린다.
 *
 * 판정 (CLAUDE.md: pass / fail / error / not_run 을 구분한다)
 *  - not_run : 자격 증명이 없거나 MODEL_ADAPTER!=anthropic. **절대 pass 로 적지 않는다.**
 *  - error   : 호출·파싱이 예외로 끝났다 (스키마 위반 포함 — 여기서 «프롬프트가 스키마를 어긴다» 가 잡힌다).
 *  - fail    : 명세는 나왔지만 어휘를 안 썼거나(메인 요청), 엉뚱하게 썼거나(목록·상세 요청),
 *              V1·V2 필수 검사가 통과하지 못했다.
 *  - pass    : 위 조건을 모두 만족한다.
 *
 * 실행:  set -a; source .env; set +a; MODEL_ADAPTER=anthropic pnpm probe:vocab
 *
 * `PROBE_ALLOW_FIXTURE=1` 은 **스크립트 자체가 도는지** 보는 자기 점검이다 (더미 어댑터로 판정 로직만 밟는다).
 * 모델을 부르지 않으므로 그 결과는 어휘 점검의 답이 아니다 — 출력에 그렇게 적는다.
 */
import { ScreenSpec, type ScreenSpecShape } from '@con-ai/schemas'
import { assemblePrompt, type GenerationContext, type SliceGenerationRequest } from '@con-ai/prompt-templates'
import { createAdapter } from '@con-ai/model-adapter'
import { renderScreen, S2B_LEARNED_PROFILE } from '@con-ai/renderer'
import { runV1, runV2 } from '@con-ai/validators'

type Status = 'pass' | 'fail' | 'error' | 'not_run'

const CONTENT_TYPES = new Set(['hero', 'stat-strip', 'card-grid'])

interface Probe {
  id: string
  /** 이 요청이 «메인 화면» 인가 — 기대하는 어휘가 갈린다. */
  main: boolean
  title: string
  purpose: string
  device: 'desktop' | 'mobile'
}

/** 고정 문장 6개 — 메인 3 / 목록·상세 3. 어휘를 «쓰는가» 와 «남용하는가» 를 같이 본다. */
const PROBES: readonly Probe[] = [
  { id: 'main-portal', main: true, title: '메인 페이지', purpose: '그룹 포털 메인 페이지를 만든다. 대표 안내 문구와 통합검색, 요약 지표, 자주 쓰는 메뉴 카드, 최근 공지를 한 화면에 둔다', device: 'desktop' },
  { id: 'main-app', main: true, title: '홈', purpose: '모바일 앱 홈 화면을 만든다. 잔액과 이번 달 지출 요약, 자주 쓰는 기능 바로가기, 최근 알림을 보여 준다', device: 'mobile' },
  { id: 'main-landing', main: true, title: '서비스 소개', purpose: '서비스 소개 랜딩 페이지를 만든다. 큰 카피와 검색, 핵심 숫자 3개, 기능 카드 4장을 둔다', device: 'desktop' },
  { id: 'list-order', main: false, title: '주문 목록', purpose: '주문 목록 조회 화면을 만든다. 기간·상태로 검색하고 결과를 표로 보여 준다', device: 'desktop' },
  { id: 'list-domain', main: false, title: '도메인 관리 목록', purpose: '커머스 도메인 주문 내역 조회 목록 화면을 만든다', device: 'desktop' },
  { id: 'detail-order', main: false, title: '주문 상세', purpose: '주문 상세 화면을 만든다. 기본 정보와 품목 내역 표를 보여 준다', device: 'desktop' },
]

function contextOf(p: Probe): GenerationContext {
  return {
    project: { name: '어휘 점검 샘플', org: '와일리 컨버전스 본부', profile_id: 's2b-learned-v1' },
    screen: { external_id: `PROBE-${p.id}`, title: p.title, shell: 'sample-page', device: p.device },
    requirements: [
      {
        external_id: 'PROBE-REQ-001',
        title: p.title,
        body: p.purpose,
        criteria: [
          { id: 'PROBE-AC-01', text: `${p.title} 진입 시 화면의 주요 구성이 보인다`, kind: 'ui' },
          { id: 'PROBE-AC-02', text: '조회 결과가 없으면 안내 문구를 표시한다', kind: 'ui' },
          { id: 'PROBE-AC-03', text: '조회 오류 시 오류 안내를 표시한다', kind: 'ui' },
        ],
      },
    ],
    references: [],
    profile_rules: S2B_LEARNED_PROFILE.rules,
    baseline_id: 'probe-baseline-1',
  }
}

function requestOf(p: Probe): SliceGenerationRequest {
  return {
    screen_id: `PROBE-${p.id}`,
    task_type: 'create',
    purpose: p.purpose,
    requirement_ids: ['PROBE-REQ-001'],
    criterion_ids: [],
    reference_ids: [],
    cases: ['normal', 'empty', 'error'],
    keep_conditions: [],
    roles: ['member'],
    device: p.device,
  }
}

interface Row {
  id: string
  status: Status
  used: string[]
  note: string
}

/** 명세가 나왔을 때의 판정 — 어휘 사용/남용과 V1·V2 필수 검사. */
function judge(p: Probe, spec: ScreenSpecShape): { status: Status; used: string[]; note: string } {
  const elements = spec.sections.flatMap((s) => s.elements)
  const used = [...new Set(elements.filter((e) => CONTENT_TYPES.has(e.type)).map((e) => e.type))]
  const heroCount = elements.filter((e) => e.type === 'hero').length

  if (p.main) {
    if (used.length === 0) return { status: 'fail', used, note: '메인 요청인데 새 어휘를 하나도 쓰지 않았다 (목록 어휘로만 답했다)' }
    if (heroCount > 1) return { status: 'fail', used, note: `히어로가 ${heroCount}개다 (한 화면에 1개)` }
    if (!used.includes('stat-strip') && !used.includes('card-grid')) return { status: 'fail', used, note: '히어로만 쓰고 KPI·카드가 없다' }
  } else if (used.length > 0) {
    return { status: 'fail', used, note: `목록·상세 요청인데 ${used.join('·')} 를 썼다 (어휘 남용)` }
  }

  const base = { artifact_hash: 'p'.repeat(64), validation_run_id: `probe-${p.id}` }
  const dummy: Record<string, unknown[]> = {}
  for (const s of spec.states) dummy[s.fixture_id] = []
  const rendered = renderScreen({
    spec,
    profile: S2B_LEARNED_PROFILE,
    dummy,
    meta: { screen_title: p.title, requirements: [], revision_label: 'probe', generated_by: '어휘 점검' },
  })
  const results = [...runV1(spec, { required_cases: ['normal', 'empty', 'error'], ...base }), ...runV2(rendered.html, spec, S2B_LEARNED_PROFILE, base)]
  const failed = results.filter((r) => r.required && r.status !== 'pass')
  if (failed.length > 0) return { status: 'fail', used, note: `필수 검사 실패: ${failed.map((r) => r.check_id).join(', ')}` }
  return { status: 'pass', used, note: p.main ? '메인 어휘를 썼고 검사도 통과' : '목록 어휘만 썼고 검사도 통과' }
}

async function main(): Promise<void> {
  const env = process.env
  const adapter = createAdapter(env)
  const rows: Row[] = []

  const selfCheck = adapter.kind !== 'anthropic' && env.PROBE_ALLOW_FIXTURE === '1'
  if (adapter.kind !== 'anthropic' && !selfCheck) {
    // 자격 증명이 없으면 «확인하지 않음» 이다. 돌지 않은 검사를 통과로 적지 않는다 (CLAUDE.md).
    for (const p of PROBES) rows.push({ id: p.id, status: 'not_run', used: [], note: `어댑터가 ${adapter.kind} 다. MODEL_ADAPTER=anthropic 과 ANTHROPIC_API_KEY 또는 ANTHROPIC_AUTH_TOKEN 이 필요하다` })
  } else {
    for (const p of PROBES) {
      const ctx = contextOf(p)
      const req = requestOf(p)
      try {
        const result = await adapter.generateSpec({ prompt: assemblePrompt(req, ctx), ctx, req })
        const parsed = ScreenSpec.safeParse((result.output as { screen_spec: unknown }).screen_spec)
        if (!parsed.success) {
          rows.push({ id: p.id, status: 'error', used: [], note: `스키마 위반: ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join(' | ')}` })
          continue
        }
        rows.push({ id: p.id, ...judge(p, parsed.data) })
      } catch (e) {
        rows.push({ id: p.id, status: 'error', used: [], note: e instanceof Error ? e.message.slice(0, 300) : String(e) })
      }
    }
  }

  const pad = (s: string, n: number) => s + ' '.repeat(Math.max(0, n - [...s].length))
  console.log(`어휘 점검 — 모델 ${adapter.model} (${adapter.kind}) · 문장 ${PROBES.length}건`)
  if (selfCheck) console.log('※ 자기 점검(PROBE_ALLOW_FIXTURE=1) — 더미 어댑터로 판정 로직만 밟았다. **모델을 부르지 않았으므로 어휘 점검의 답이 아니다.**')
  console.log(`${pad('요청', 16)}${pad('기대', 6)}${pad('판정', 9)}${pad('쓴 어휘', 26)}비고`)
  for (const r of rows) {
    const p = PROBES.find((x) => x.id === r.id)
    console.log(`${pad(r.id, 16)}${pad(p?.main === true ? '메인' : '목록', 6)}${pad(r.status, 9)}${pad(r.used.join(',') || '-', 26)}${r.note}`)
  }
  const count = (s: Status) => rows.filter((r) => r.status === s).length
  console.log(`\n요약: pass ${count('pass')} · fail ${count('fail')} · error ${count('error')} · not_run ${count('not_run')}`)
  if (count('not_run') === rows.length) console.log('실제 모델을 부르지 않았다 — 이 결과를 «통과» 로 적지 않는다.')
  if (selfCheck) console.log('자기 점검 결과다. 실제 모델의 어휘 사용은 여전히 not_run 이다.')
  // not_run 은 실패가 아니다 (자격 증명이 없는 환경에서도 스크립트는 정상 종료한다).
  process.exitCode = count('fail') + count('error') > 0 ? 1 : 0
}

await main()
