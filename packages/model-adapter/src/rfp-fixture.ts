/**
 * RFP 추출의 **더미(규칙) 구현** — 모델을 부르지 않고 원문에서 규칙으로 뽑는다.
 *
 * 왜 규칙 구현이 필요한가: 자격 증명이 없어도 전 경로가 돌아야 한다(이 저장소의 기본 규율).
 * 그리고 이 구현은 **인용을 지어낼 수 없다** — 원문에서 자른 문장을 그대로 쓰기 때문에
 * `checkRfpExtraction` 의 인용 검사를 언제나 통과한다. 모델 경로의 결과를 비교할 기준선이 된다.
 *
 * 규칙(사내 BA 표준 Step 1 의 패턴):
 * - 「~해야 한다」 「~할 수 있어야 한다」 「~지원해야 한다」 「~제공해야 한다」 가 들어간 문장을 요구사항 후보로 본다.
 * - 분류는 낱말로 가른다 (성능·보안·감리… → NFR/CR, 아키텍처·DB → TR, 운영·모니터링 → OR, 그 밖 → FR).
 * - 우선순위는 **원문 표현**으로만 정한다: 「필수」·「반드시」·법규 인용 → M, 「권장」 → S, 「선택」·「향후」 → C.
 *   그 밖은 S 로 두고 근거에 「원문에 등급 표현이 없어 기본값」이라고 **적는다** (임의 판단을 숨기지 않는다).
 * - 추측하지 않는다: 발주처·기간·예산은 머리글 패턴이 보일 때만 채우고 없으면 빈 문자열이다.
 *
 * 화면에는 언제나 **더미 어댑터**로 표시된다 (CLAUDE.md: 더미와 실제를 구분한다).
 */
import type { WireRfpExtraction, WireRfpRequirement } from './wire-schema.js'
import type { RfpExtractInput } from './prompts.js'

/** 문장 분리 — 한국어 종결부호와 줄바꿈을 함께 본다. 번호 매김(3.2.1)은 끊지 않는다. */
export function splitSentences(text: string): string[] {
  return text
    .split(/\n+/u)
    .flatMap((line) => line.split(/(?<=[.!?。])\s+/u))
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

const REQUIREMENT_PATTERNS = [/해야\s*한다/u, /할\s*수\s*있어야/u, /지원해야/u, /제공해야/u, /하여야\s*한다/u, /되어야\s*한다/u]

const CLASS_RULES: ReadonlyArray<{ kind: WireRfpRequirement['kind']; axis?: WireRfpRequirement['nfr_axis']; words: readonly string[] }> = [
  { kind: 'NFR', axis: 'performance', words: ['응답시간', '동시접속', 'TPS', '처리량', '성능'] },
  { kind: 'NFR', axis: 'availability', words: ['가동률', '가용성', 'RTO', 'RPO', '무중단'] },
  { kind: 'CR', axis: 'security', words: ['망분리', '암호화', '전자금융', '개인정보', '보안', 'OWASP', '인증서'] },
  { kind: 'NFR', axis: 'accessibility', words: ['접근성', 'WA 인증', '웹콘텐츠 접근성', '스크린리더'] },
  { kind: 'NFR', axis: 'compatibility', words: ['브라우저', '호환성', 'OS 버전', '모바일 OS'] },
  { kind: 'CR', axis: 'audit', words: ['감리', '감독규정', '준수 여부 점검'] },
  { kind: 'TR', words: ['아키텍처', '프레임워크', 'DB', '데이터베이스', '연계 방식', 'API 연계', '인프라'] },
  { kind: 'OR', words: ['SLA', '모니터링', '백업', '이관', '운영 인력', '장애 대응'] },
]

function classify(sentence: string): { kind: WireRfpRequirement['kind']; axis?: WireRfpRequirement['nfr_axis'] } {
  for (const rule of CLASS_RULES) {
    if (rule.words.some((w) => sentence.includes(w))) {
      return rule.axis === undefined ? { kind: rule.kind } : { kind: rule.kind, axis: rule.axis }
    }
  }
  return { kind: 'FR' }
}

/** 우선순위는 **원문 표현으로만** 정한다. 표현이 없으면 기본값이라고 근거에 적는다. */
function priorityOf(sentence: string, label: string): { priority: WireRfpRequirement['priority']; reason: string } {
  if (/필수|반드시|의무/u.test(sentence)) return { priority: 'M', reason: `${label} 원문에 「필수·반드시」 표현이 있다` }
  if (/규정|법령|제\d+조/u.test(sentence)) return { priority: 'M', reason: `${label} 원문이 법규·규정을 인용한다` }
  if (/권장|가능하면/u.test(sentence)) return { priority: 'S', reason: `${label} 원문에 「권장」 표현이 있다` }
  if (/선택|향후|차기|추후/u.test(sentence)) return { priority: 'C', reason: `${label} 원문에 「선택·향후」 표현이 있다` }
  return { priority: 'S', reason: `${label} 원문에 등급 표현이 없어 기본값(S)으로 두었다 — 사람이 확인해야 한다` }
}

/** 「3.2.1」 같은 조번호가 줄 앞에 있으면 출처 표기에 쓴다. 없으면 문서 이름만 적는다. */
function labelOf(sentence: string, sourceName: string): string {
  const m = /^((?:\d+\.)+\d+|\d+\.)\s*/u.exec(sentence)
  return m === null ? sourceName : `${sourceName} ${m[1]?.replace(/\.$/u, '') ?? ''}`.trim()
}

/** 평가항목 — 「항목명(20점)」 또는 「항목명 20점」 패턴만 읽는다. 없으면 빈 배열이다. */
export function extractEvaluationItems(text: string, sourceName: string): WireRfpExtraction['evaluation_items'] {
  const out: WireRfpExtraction['evaluation_items'] = []
  const seen = new Set<string>()
  for (const sentence of splitSentences(text)) {
    if (!sentence.includes('점')) continue
    for (const m of sentence.matchAll(/([가-힣A-Za-z][가-힣A-Za-z0-9 ·/]{1,20}?)\s*[(（]?\s*(\d{1,3})\s*점/gu)) {
      // 「평가는 사업 이해도(20점)」처럼 앞말이 붙어 들어오므로 조사로 끝나는 선행어를 떼어낸다.
      const label = (m[1] ?? '')
        .trim()
        .replace(/^.*?(?:는|은|이|가|를|을|과|와)\s+/u, '')
        .trim()
      const weight = Number.parseInt(m[2] ?? '', 10)
      if (label.length === 0 || seen.has(label) || !Number.isFinite(weight) || weight > 100) continue
      seen.add(label)
      out.push({ label, weight, description: '', source: { label: labelOf(sentence, sourceName), quote: sentence } })
    }
  }
  return out
}

/** 머리글 패턴이 보일 때만 채운다 — 없는 값을 지어내지 않는다. */
function overviewOf(text: string): WireRfpExtraction['overview'] {
  const field = (names: readonly string[]): string => {
    for (const line of text.split(/\n+/u)) {
      for (const name of names) {
        const m = new RegExp(`^\\s*(?:[◦○·\\-*]\\s*)?${name}\\s*[:：]\\s*(.+)$`, 'u').exec(line)
        if (m !== null) return (m[1] ?? '').trim()
      }
    }
    return ''
  }
  return {
    org: field(['발주처', '발주기관', '수요기관']),
    project_name: field(['사업명', '과제명', '프로젝트명']),
    period: field(['사업기간', '사업 기간', '계약기간', '수행기간']),
    budget: field(['예산', '사업예산', '사업비']),
    deliverables: [],
    constraints: [],
  }
}

/**
 * 규칙으로 RFP 를 읽는다. 모델을 부르지 않는다.
 * 뽑지 못한 것은 `unresolved` 에 **적는다** — 「문제 없음」으로 두지 않는다.
 */
export function extractRfpByRules(input: RfpExtractInput): WireRfpExtraction {
  const sentences = splitSentences(input.text)
  const requirements: WireRfpRequirement[] = []
  for (const sentence of sentences) {
    if (!REQUIREMENT_PATTERNS.some((p) => p.test(sentence))) continue
    const label = labelOf(sentence, input.source_name)
    const { kind, axis } = classify(sentence)
    const { priority, reason } = priorityOf(sentence, label)
    // 제목은 조번호를 떼고 60자까지. 상세는 문장 전체. 인용은 **문장 그대로** 둔다.
    const title = sentence.replace(/^((?:\d+\.)+\d+|\d+\.)\s*/u, '').slice(0, 60)
    requirements.push({
      kind,
      title,
      detail: sentence,
      priority,
      priority_reason: reason,
      source: { label, quote: sentence },
      criteria: [],
      ...(axis === undefined ? {} : { nfr_axis: axis }),
    })
  }

  const unresolved: WireRfpExtraction['unresolved'] = [
    {
      kind: 'missing_evidence',
      text: `더미 어댑터(규칙)로 뽑았다 — 「~해야 한다」 꼴 문장 ${requirements.length}건만 집었고 문장 ${sentences.length}건 중 나머지는 판정하지 않았다. 수용조건(criteria)은 비어 있다. 내 Claude 계정으로 다시 분석하면 모델이 문맥을 읽는다.`,
    },
  ]
  if (requirements.length === 0) {
    unresolved.push({ kind: 'question', text: '요구사항 꼴의 문장을 찾지 못했다. 원문이 표·이미지 위주라면 텍스트로 붙여넣어야 한다.' })
  }

  return { overview: overviewOf(input.text), evaluation_items: extractEvaluationItems(input.text, input.source_name), requirements, unresolved }
}
