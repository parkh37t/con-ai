#!/usr/bin/env node
// 학습 문서(md)와 skill 을 다운로드하기 쉬운 형태로 모은다.
//   node scripts/bundle-knowledge.mjs [출력폴더]
// 기본 출력: .bundle/  (gitignore 됨)
//
// 1) files/  — 평평한 폴더에 **ASCII 파일명**으로 한 벌. 필요한 것만 집어 간다.
// 2) con-ai-learning-bundle-<날짜>.md — 전부 이어 붙인 **단일 파일**. ChatGPT·Codex 에 올려 학습시킬 때 쓴다.
//
// zip 으로 묶지 않는다. 한국어 파일명을 zip 에 담으면 UTF-8 플래그가 꺼져
// 윈도·맥 기본 해제기가 목록을 못 읽는다(실제로 겪었다). 그래서 이름도 ASCII 로 둔다.
//
// 원본 입력자료(docs/reference/, data/review/*.csv)는 담지 않는다.
// 저장소 규칙: 원본은 수정·복사하지 않고 제자리에서 읽는다(CLAUDE.md 원본 불변·공개 저장소).

import { mkdirSync, rmSync, copyFileSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const repo = resolve(dirname(new URL(import.meta.url).pathname), '..')
const outRoot = resolve(process.argv[2] ?? join(repo, '.bundle'))
const stamp = new Date().toISOString().slice(0, 10)
const filesDir = join(outRoot, 'files')
const mergedPath = join(outRoot, `con-ai-learning-bundle-${stamp}.md`)

/**
 * as: 묶음 안의 ASCII 파일명. 번호가 읽는 순서다.
 * @type {{ title: string, note: string, files: { from: string, as: string, what: string, lines?: number }[] }[]}
 */
const groups = [
  {
    title: '지침 — 에이전트가 가장 먼저 읽는 것',
    note: 'Codex 등 `AGENTS.md` 를 읽는 에이전트는 `10-AGENTS.md`, Claude Code 는 `11-CLAUDE.md` 를 읽는다. **규칙 본문은 `CLAUDE.md`** 이고 `AGENTS.md` 는 그중 작업하다 데이는 것을 앞으로 끌어낸 것이다.',
    files: [
      { from: 'AGENTS.md', as: '10-AGENTS-codex-instructions.md', what: 'Codex용 지침. 먼저 읽을 것 · 제품 · 구조 · 실행·검사 · 반드시 지킬 것 · 작업별로 읽을 것 · 끝낼 때' },
      { from: 'CLAUDE.md', as: '11-CLAUDE-rules.md', what: '규칙 본문. 제품 목적·저장소 구조·반드시 지킬 규칙·원칙·허용 수정 범위' },
      { from: 'README.md', as: '12-repo-readme.md', what: '제품 소개·온라인 데모·빠른 시작·무엇이 실제이고 무엇이 더미인가' },
      { from: '.claude/README.md', as: '13-claude-folder.md', what: '`.claude/` 폴더가 무엇이고 skill 을 어디에 두는가' },
    ],
  },
  {
    title: 'skill — 반복 작업과 실제로 데인 함정',
    note: 'Claude Code 는 `.claude/skills/<이름>/SKILL.md` 로 두면 필요할 때 읽는다. Codex 는 `AGENTS.md` 의 「작업별로 읽을 것」 표에서 가리킨다.',
    files: [
      { from: '.claude/skills/명세-어휘-추가/SKILL.md', as: '20-skill-spec-vocabulary.md', what: 'ScreenSpec 어휘(컴포넌트·동작)를 넓힐 때 움직여야 하는 10군데와, 빠뜨리면 어떻게 조용히 통과하는지' },
      { from: '.claude/skills/배포-전-점검/SKILL.md', as: '21-skill-preflight.md', what: '푸시·배포 전 검사 순서, 데모 스냅샷을 다시 떠야 하는 때, pass/fail/error/not_run 규율' },
      { from: '.claude/skills/ID와-추적체인/SKILL.md', as: '22-skill-ids-traceability.md', what: '내부 UUID ↔ 외부 ID, IA·FN 발번, 메뉴↔화면 연결, REQ→IA→FN→SCR 추적' },
    ],
  },
  {
    title: '프롬프트 — 세션 전체를 한 장으로',
    note: '`---` 사이만 복사해 새 세션에 붙이면 같은 범위의 작업이 선다.',
    files: [
      { from: 'docs/plan/세션_통합프롬프트.md', as: '30-unified-prompt.md', what: '2026-10-03 세션의 요청 9건을 합친 단일 개발 프롬프트 + 어떤 요청이 어디로 갔는지 추적표' },
    ],
  },
  {
    title: '지식 — 제품·데이터·원본 범위·역할',
    note: '제품을 이해하려면 이 4개부터 읽는다.',
    files: [
      { from: 'docs/knowledge/README.md', as: '40-knowledge-readme.md', what: '지식 문서 4개의 역할과 읽는 순서' },
      { from: 'docs/knowledge/01_제품정의_사용흐름.md', as: '41-knowledge-product-and-flow.md', what: '무엇을 만드는가, 4단계 사용 흐름, 사용자가 보는 것' },
      { from: 'docs/knowledge/02_데이터모델_ID_버전.md', as: '42-knowledge-datamodel-id-version.md', what: '문서·화면·revision·ID·버전·추적 링크의 데이터 모델' },
      { from: 'docs/knowledge/09_원본자료_검토범위_한계.md', as: '43-knowledge-source-limits.md', what: '제공 원본을 어디까지 믿을 수 있는가, 확인된 것과 아닌 것' },
      { from: 'docs/knowledge/10_사용자역할_두축_제품역할과_업무역할.md', as: '44-knowledge-user-roles.md', what: '제품 역할(권한)과 업무 역할(직무)을 섞지 않는 이유' },
    ],
  },
  {
    title: '결정 기록 — 왜 그렇게 했는가',
    note: '',
    files: [
      { from: 'docs/decisions/README.md', as: '50-decisions-readme.md', what: '결정 기록을 쓰는 규칙' },
      { from: 'docs/decisions/0014-사용자별-클로드-계정-인증.md', as: '51-decision-0014-per-user-auth.md', what: '모델 인증을 사용자별로 둘 때의 선택과 대가' },
      { from: 'docs/decisions/0015-FN-계층-배치와-강제-지점.md', as: '52-decision-0015-fn-layer.md', what: 'FN(기능)을 어느 계층에 두고 어디서 강제하는가' },
    ],
  },
  {
    title: '계획과 기록 — 무엇을 했고 무엇이 남았는가',
    note: '`60-progress-log.md` 가 가장 두껍다. 날짜별로 완료 기능 / 실행 방법 / 검증 결과 / 남은 제한이 적혀 있다. **맨 아래부터** 읽는다.',
    files: [
      { from: 'docs/plan/진행기록.md', as: '60-progress-log.md', what: '단계별 완료 기능·실행 방법·검증 결과(pass/fail/error/not_run)·남은 제한' },
      { from: 'docs/plan/구현계획.md', as: '61-implementation-plan.md', what: '세로 조각 순서와 다음 단계' },
      { from: 'docs/plan/세로조각_계약.md', as: '62-vertical-slice-contract.md', what: '첫 세로 조각의 수용조건과 계약' },
      { from: 'docs/plan/미확정목록.md', as: '63-open-questions.md', what: '원본에서 확정되지 않아 합성 데이터로 진행한 사실들' },
      { from: 'docs/plan/브라우저모드.md', as: '64-browser-mode.md', what: '서버 없이 브라우저에서 파이프라인을 돌리는 구조' },
      { from: 'docs/plan/배포.md', as: '65-deployment.md', what: 'GitHub Pages 배포, 데모 스냅샷, 로컬·사내 서버 실행' },
      { from: 'docs/plan/프로토타입_가이드.md', as: '66-prototype-guide.md', what: '기획자·검토자용. 배포 주소에서 4단계를 끝까지 돌려보는 방법과 화면 링크 지도' },
    ],
  },
  {
    title: '패키지 안내 — 코드 경계와 책임',
    note: '각 패키지가 무엇을 하고 무엇을 하지 않는지. 코드를 고치기 전에 해당 패키지 안내를 읽는다.',
    files: [
      { from: 'apps/api/README.md', as: '70-pkg-apps-api.md', what: 'API·작업 실행·저장소' },
      { from: 'apps/web/README.md', as: '71-pkg-apps-web.md', what: '브라우저 작업대' },
      { from: 'packages/schemas/README.md', as: '72-pkg-schemas.md', what: 'ScreenSpec·추적·검증·작업 스키마' },
      { from: 'packages/domain/README.md', as: '73-pkg-domain.md', what: 'ID·별칭·커버리지·상태 전이·승인 판정·메뉴 규칙' },
      { from: 'packages/prompt-templates/README.md', as: '74-pkg-prompt-templates.md', what: '버전 관리된 프롬프트 템플릿과 문맥 조립' },
      { from: 'packages/model-adapter/README.md', as: '75-pkg-model-adapter.md', what: '모델 호출 어댑터(anthropic 실제 / fixture 더미)와 구조화 출력' },
      { from: 'packages/renderer/README.md', as: '76-pkg-renderer.md', what: 'ScreenSpec → HTML 목업 + 우측 설명' },
      { from: 'packages/validators/README.md', as: '77-pkg-validators.md', what: 'V1 명세 · V2 렌더 · V3 실행 검사' },
      { from: 'fixtures/README.md', as: '78-fixtures.md', what: '합성 데이터와 실패 예제' },
      { from: 'data/review/README.md', as: '79-data-review.md', what: '검토 데이터를 어디에 두는가(원본 CSV 는 커밋하지 않는다)' },
    ],
  },
]

/** SKILL.md 의 YAML 머리말을 떼어 낸다. 합본에서 `---` 가 구분선으로 보이지 않게. */
function splitFrontmatter(md) {
  if (!md.startsWith('---\n')) return { front: null, body: md }
  const end = md.indexOf('\n---', 4)
  if (end === -1) return { front: null, body: md }
  const front = md.slice(4, end)
  const name = /^name:\s*(.+)$/m.exec(front)
  const desc = /^description:\s*([\s\S]+?)(?=\n\w+:|$)/m.exec(front)
  return {
    front: { name: name === null ? '' : name[1].trim(), description: desc === null ? '' : desc[1].trim() },
    body: md.slice(end + 4).replace(/^\n+/, ''),
  }
}

/** 코드 펜스 안을 건드리지 않고 제목 단계를 2 내린다. 합본에서 구조가 겹치지 않게. */
function demoteHeadings(md) {
  const out = []
  let fence = ''
  for (const line of md.split('\n')) {
    const f = /^\s*(```+|~~~+)/.exec(line)
    if (f !== null) {
      if (fence === '') fence = f[1]
      else if (line.trimStart().startsWith(fence)) fence = ''
      out.push(line)
      continue
    }
    if (fence === '' && /^#{1,4} /.test(line)) out.push(`##${line}`)
    else out.push(line)
  }
  return out.join('\n')
}

rmSync(filesDir, { recursive: true, force: true })
mkdirSync(filesDir, { recursive: true })

const missing = []
let copied = 0
let totalLines = 0
for (const g of groups) {
  for (const f of g.files) {
    const src = join(repo, f.from)
    if (!existsSync(src)) {
      missing.push(f.from)
      continue
    }
    copyFileSync(src, join(filesDir, f.as))
    f.lines = readFileSync(src, 'utf8').split('\n').length
    totalLines += f.lines
    copied += 1
  }
}

// skill 폴더가 더 생겼는지 확인한다. 매니페스트에 없으면 조용히 빠지므로 알린다.
const skillDir = join(repo, '.claude/skills')
const listedSkills = new Set(groups[1].files.map((f) => f.from.split('/')[2]))
const onDisk = existsSync(skillDir)
  ? readdirSync(skillDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  : []
const unlisted = onDisk.filter((n) => !listedSkills.has(n))

const head = []
head.push(`# con-ai — 학습 문서와 skill (${stamp})`)
head.push('')
head.push('`parkh37t/con-ai` 저장소에서 개발하며 쌓인 **지침·skill·지식·기록**이다.')
head.push(`문서 ${copied}개 / 약 ${totalLines.toLocaleString('ko-KR')}줄. 원본은 저장소에 그대로 있고 이것은 **읽기용 한 벌**이다.`)
head.push('')
head.push('파일명이 영문인 것은 일부러다 — 한국어 파일명은 압축·업로드 과정에서 깨진다. **내용은 전부 한국어**이고 각 파일 첫 줄에 원래 제목이 있다.')
head.push('')
head.push('## 어떻게 쓰나')
head.push('')
head.push('| 하려는 일 | 이렇게 한다 |')
head.push('|---|---|')
head.push('| **ChatGPT·Codex 에 학습시킨다** | `con-ai-learning-bundle-<날짜>.md` **한 파일**을 올린다. 아래 전부가 순서대로 들어 있다 |')
head.push('| **Codex 가 저장소에서 작업한다** | 저장소를 연결만 하면 된다. 루트의 `AGENTS.md` 를 Codex 가 자동으로 읽는다 |')
head.push('| 필요한 것만 집어 간다 | `files/` 의 번호 순서대로. 번호가 읽는 순서다 |')
head.push('| 같은 작업을 새 세션에 다시 시킨다 | `30-unified-prompt.md` 의 `---` 사이를 복사해 붙인다 |')
head.push('| 제품이 무엇인지 알고 싶다 | `12-repo-readme.md` → `41-knowledge-product-and-flow.md` |')
head.push('| 개발을 시작한다 | `10-AGENTS-codex-instructions.md` 또는 `11-CLAUDE-rules.md` → `60-progress-log.md`(맨 아래부터) |')
head.push('')
head.push('## 들어 있는 것')
head.push('')
for (const g of groups) {
  head.push(`### ${g.title}`)
  head.push('')
  if (g.note !== '') {
    head.push(g.note)
    head.push('')
  }
  head.push('| 파일 | 줄 | 무엇이 들었나 | 저장소 경로 |')
  head.push('|---|---|---|---|')
  for (const f of g.files) {
    if (f.lines === undefined) continue
    head.push(`| \`${f.as}\` | ${f.lines} | ${f.what} | \`${f.from}\` |`)
  }
  head.push('')
}
head.push('## 담지 않은 것 (일부러)')
head.push('')
head.push('| 무엇 | 왜 |')
head.push('|---|---|')
head.push('| `docs/reference/` 원본 3종 (개발시작 프롬프트 · 구현설계 · 첨부자료 검토보고서) | **원본 입력자료**다. 이 묶음은 「학습된 것」이고 원본은 제자리에서 읽는다. 복사본을 만들면 어느 쪽이 원본인지 흐려진다 (CLAUDE.md 원본 불변) |')
head.push('| `data/review/*.csv` (요구사항 원문·INDEX·추적후보) | 고객 자료다. 공개 저장소에도 묶음에도 담지 않는다. 두는 방법은 `79-data-review.md` |')
head.push('| 코드 · 테스트 · fixture | 문서 묶음이다. 코드는 저장소에서 본다 |')
head.push('| 생성된 설계서 HTML · 검증 결과 | 실행하면 만들어진다. 설치 없이 보려면 `66-prototype-guide.md` |')
head.push('')
head.push('## 다시 뜨는 방법')
head.push('')
head.push('```bash')
head.push('pnpm bundle:knowledge     # → .bundle/files/ 와 .bundle/con-ai-learning-bundle-<날짜>.md')
head.push('```')
head.push('')
head.push('매니페스트는 `scripts/bundle-knowledge.mjs` 안에 있다. 문서를 더하면 거기에 한 줄 적는다. **zip 으로 묶지 않는다.**')
if (unlisted.length > 0) {
  head.push('')
  head.push(`> 참고: \`.claude/skills/\` 에 매니페스트에 없는 skill 이 있다 — ${unlisted.join(', ')}. 스크립트에 추가해야 들어간다.`)
}

const indexMd = `${head.join('\n')}\n`
writeFileSync(join(filesDir, '00-INDEX.md'), indexMd, 'utf8')

// 단일 합본
const merged = [indexMd, '', '---', '']
let n = 0
for (const g of groups) {
  for (const f of g.files) {
    if (f.lines === undefined) continue
    n += 1
    merged.push(`## ${f.as}`)
    merged.push('')
    merged.push(`> 저장소 경로 \`${f.from}\` · ${f.lines}줄 · ${f.what}`)
    merged.push('')
    const { front, body } = splitFrontmatter(readFileSync(join(repo, f.from), 'utf8').trimEnd())
    if (front !== null) {
      merged.push(`> skill 이름 \`${front.name}\` · 언제 읽히나: ${front.description}`)
      merged.push('')
    }
    merged.push(demoteHeadings(body))
    merged.push('')
    merged.push('---')
    merged.push('')
  }
}
merged.push(`<!-- 끝. 문서 ${n}개 / ${totalLines}줄 · ${stamp} -->`)
writeFileSync(mergedPath, merged.join('\n'), 'utf8')

console.log(`개별 파일: ${filesDir}  (${copied + 1}개, ASCII 이름)`)
console.log(`단일 합본: ${mergedPath}`)
console.log(`문서 ${copied}개 / ${totalLines}줄`)
if (missing.length > 0) console.log(`없어서 빠진 파일: ${missing.join(', ')}`)
if (unlisted.length > 0) console.log(`매니페스트에 없는 skill: ${unlisted.join(', ')}`)
