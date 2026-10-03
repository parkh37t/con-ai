#!/usr/bin/env node
// 학습 문서(md)와 skill 을 한 묶음으로 모아 zip 으로 만든다.
//   node scripts/bundle-knowledge.mjs [출력폴더]
// 기본 출력: .bundle/  (gitignore 됨)
//
// 원본 입력자료(docs/reference/, data/review/*.csv)는 **담지 않는다.**
// 저장소 규칙: 원본은 수정·복사하지 않고 제자리에서 읽는다(CLAUDE.md 원본 불변·공개 저장소).

import { mkdirSync, rmSync, copyFileSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

const repo = resolve(dirname(new URL(import.meta.url).pathname), '..')
const outRoot = resolve(process.argv[2] ?? join(repo, '.bundle'))
const stamp = new Date().toISOString().slice(0, 10)
const bundleName = `con-ai-지식과스킬-${stamp}`
const stage = join(outRoot, bundleName)

/** @type {{ title: string, note: string, files: { from: string, to: string, what: string }[] }[]} */
const groups = [
  {
    title: 'skills — Claude Code 가 읽는 반복 작업 지침',
    note: '이 저장소에서 개발할 때 쓴다. 저장소의 `.claude/skills/` 에 폴더째 두면 Claude Code 가 이름·설명을 보고 필요할 때 읽는다. 개인용으로 쓰려면 `~/.claude/skills/` 에 둔다.',
    files: [
      { from: '.claude/skills/명세-어휘-추가/SKILL.md', to: 'skills/명세-어휘-추가/SKILL.md', what: 'ScreenSpec 어휘(컴포넌트·동작)를 넓힐 때 밟아야 하는 10단계 사슬과 실제로 데인 함정' },
      { from: '.claude/skills/배포-전-점검/SKILL.md', to: 'skills/배포-전-점검/SKILL.md', what: '푸시·배포 전 검사 순서, 데모 스냅샷을 다시 떠야 하는 때, pass/fail/error/not_run 규율' },
      { from: '.claude/skills/ID와-추적체인/SKILL.md', to: 'skills/ID와-추적체인/SKILL.md', what: '내부 UUID 와 외부 ID, IA·FN 발번, 메뉴↔화면 연결, REQ→IA→FN→SCR 추적' },
    ],
  },
  {
    title: '프롬프트 — 세션 전체를 한 장으로',
    note: '`---` 사이만 복사해 새 세션에 붙이면 같은 범위의 작업이 선다.',
    files: [
      { from: 'docs/plan/세션_통합프롬프트.md', to: '프롬프트/통합프롬프트.md', what: '2026-10-03 세션의 모든 요청을 합친 단일 개발 프롬프트 + 어떤 요청이 어디로 갔는지 추적표' },
    ],
  },
  {
    title: '개발 지침 — 이 저장소의 규칙 본문',
    note: '`CLAUDE.md` 가 규칙 본문이다. skill 보다 이것이 먼저다.',
    files: [
      { from: 'CLAUDE.md', to: '개발지침/CLAUDE.md', what: '제품 목적·저장소 구조·반드시 지킬 규칙·원칙·허용 수정 범위' },
      { from: '.claude/README.md', to: '개발지침/.claude-폴더-안내.md', what: '`.claude/` 폴더가 무엇이고 skill 을 어디에 두는가' },
      { from: 'README.md', to: '개발지침/저장소-README.md', what: '제품 소개·온라인 데모·빠른 시작·무엇이 실제이고 무엇이 더미인가' },
    ],
  },
  {
    title: '지식 — 제품·데이터·원본 범위·역할',
    note: '제품을 이해하려면 이 4개부터 읽는다.',
    files: [
      { from: 'docs/knowledge/README.md', to: '지식/README.md', what: '지식 문서 4개의 역할과 읽는 순서' },
      { from: 'docs/knowledge/01_제품정의_사용흐름.md', to: '지식/01_제품정의_사용흐름.md', what: '무엇을 만드는가, 4단계 사용 흐름, 사용자가 보는 것' },
      { from: 'docs/knowledge/02_데이터모델_ID_버전.md', to: '지식/02_데이터모델_ID_버전.md', what: '문서·화면·revision·ID·버전·추적 링크의 데이터 모델' },
      { from: 'docs/knowledge/09_원본자료_검토범위_한계.md', to: '지식/09_원본자료_검토범위_한계.md', what: '제공 원본을 어디까지 믿을 수 있는가, 확인된 것과 아닌 것' },
      { from: 'docs/knowledge/10_사용자역할_두축_제품역할과_업무역할.md', to: '지식/10_사용자역할_두축.md', what: '제품 역할(권한)과 업무 역할(직무)을 섞지 않는 이유' },
    ],
  },
  {
    title: '결정 기록 — 왜 그렇게 했는가',
    note: '',
    files: [
      { from: 'docs/decisions/README.md', to: '결정/README.md', what: '결정 기록을 쓰는 규칙' },
      { from: 'docs/decisions/0014-사용자별-클로드-계정-인증.md', to: '결정/0014-사용자별-클로드-계정-인증.md', what: '모델 인증을 사용자별로 둘 때의 선택과 대가' },
      { from: 'docs/decisions/0015-FN-계층-배치와-강제-지점.md', to: '결정/0015-FN-계층-배치와-강제-지점.md', what: 'FN(기능)을 어느 계층에 두고 어디서 강제하는가' },
    ],
  },
  {
    title: '계획과 기록 — 무엇을 했고 무엇이 남았는가',
    note: '`진행기록.md` 가 가장 두껍다. 날짜별로 완료 기능 / 실행 방법 / 검증 결과 / 남은 제한이 적혀 있다.',
    files: [
      { from: 'docs/plan/진행기록.md', to: '계획과기록/진행기록.md', what: '단계별 완료 기능·실행 방법·검증 결과(pass/fail/error/not_run)·남은 제한' },
      { from: 'docs/plan/구현계획.md', to: '계획과기록/구현계획.md', what: '세로 조각 순서와 다음 단계' },
      { from: 'docs/plan/세로조각_계약.md', to: '계획과기록/세로조각_계약.md', what: '첫 세로 조각의 수용조건과 계약' },
      { from: 'docs/plan/미확정목록.md', to: '계획과기록/미확정목록.md', what: '원본에서 확정되지 않아 합성 데이터로 진행한 사실들' },
      { from: 'docs/plan/브라우저모드.md', to: '계획과기록/브라우저모드.md', what: '서버 없이 브라우저에서 파이프라인을 돌리는 구조' },
      { from: 'docs/plan/배포.md', to: '계획과기록/배포.md', what: 'GitHub Pages 배포, 데모 스냅샷, 로컬·사내 서버 실행' },
      { from: 'docs/plan/프로토타입_가이드.md', to: '계획과기록/프로토타입_가이드.md', what: '기획자·검토자용. 배포 주소에서 4단계를 끝까지 돌려보는 방법과 화면 링크 지도' },
    ],
  },
  {
    title: '패키지 안내 — 코드 경계와 책임',
    note: '각 패키지가 무엇을 하고 무엇을 하지 않는지. 코드를 고치기 전에 해당 패키지 README 를 읽는다.',
    files: [
      { from: 'apps/api/README.md', to: '패키지안내/apps-api.md', what: 'API·작업 실행·저장소' },
      { from: 'apps/web/README.md', to: '패키지안내/apps-web.md', what: '브라우저 작업대' },
      { from: 'packages/schemas/README.md', to: '패키지안내/schemas.md', what: 'ScreenSpec·추적·검증·작업 스키마' },
      { from: 'packages/domain/README.md', to: '패키지안내/domain.md', what: 'ID·별칭·커버리지·상태 전이·승인 판정·메뉴 규칙' },
      { from: 'packages/prompt-templates/README.md', to: '패키지안내/prompt-templates.md', what: '버전 관리된 프롬프트 템플릿과 문맥 조립' },
      { from: 'packages/model-adapter/README.md', to: '패키지안내/model-adapter.md', what: '모델 호출 어댑터(anthropic 실제 / fixture 더미)와 구조화 출력' },
      { from: 'packages/renderer/README.md', to: '패키지안내/renderer.md', what: 'ScreenSpec → HTML 목업 + 우측 설명' },
      { from: 'packages/validators/README.md', to: '패키지안내/validators.md', what: 'V1 명세 · V2 렌더 · V3 실행 검사' },
      { from: 'fixtures/README.md', to: '패키지안내/fixtures.md', what: '합성 데이터와 실패 예제' },
      { from: 'data/review/README.md', to: '패키지안내/data-review.md', what: '검토 데이터를 어디에 두는가(원본 CSV 는 커밋하지 않는다)' },
    ],
  },
]

function lines(p) {
  return readFileSync(p, 'utf8').split('\n').length
}

rmSync(stage, { recursive: true, force: true })
mkdirSync(stage, { recursive: true })

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
    const dst = join(stage, f.to)
    mkdirSync(dirname(dst), { recursive: true })
    copyFileSync(src, dst)
    f.lines = lines(src)
    totalLines += f.lines
    copied += 1
  }
}

// skill 폴더가 더 생겼는지 확인한다. 매니페스트에 없으면 조용히 빠지므로 알린다.
const skillDir = join(repo, '.claude/skills')
const listed = new Set(groups[0].files.map((f) => f.from.split('/')[2]))
const onDisk = existsSync(skillDir) ? readdirSync(skillDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : []
const unlisted = onDisk.filter((n) => !listed.has(n))

const index = []
index.push(`# con-ai — 학습 문서와 skill 묶음 (${stamp})`)
index.push('')
index.push('`parkh37t/con-ai` 저장소에서 개발하며 쌓인 **지침·지식·기록·skill** 을 한 묶음으로 모은 것이다.')
index.push(`문서 ${copied}개 / 약 ${totalLines.toLocaleString('ko-KR')}줄. 원본은 저장소에 그대로 있고 이 묶음은 **읽기용 복사본**이다.`)
index.push('')
index.push('## 어디서부터 읽나')
index.push('')
index.push('| 하려는 일 | 읽을 것 |')
index.push('|---|---|')
index.push('| 제품이 무엇인지 알고 싶다 | `개발지침/저장소-README.md` → `지식/01_제품정의_사용흐름.md` |')
index.push('| 이 저장소에서 개발을 시작한다 | `개발지침/CLAUDE.md` → `계획과기록/진행기록.md`(맨 아래부터) |')
index.push('| 같은 작업을 새 세션에 다시 시킨다 | `프롬프트/통합프롬프트.md` 의 `---` 사이를 복사 |')
index.push('| Claude Code 에 지침을 심는다 | `skills/` 세 폴더를 저장소 `.claude/skills/` 에 복사 |')
index.push('| 화면 컴포넌트를 추가한다 | `skills/명세-어휘-추가/SKILL.md` |')
index.push('| 푸시·배포한다 | `skills/배포-전-점검/SKILL.md` |')
index.push('| ID·추적이 헷갈린다 | `skills/ID와-추적체인/SKILL.md` |')
index.push('| 기획자에게 데모를 보여 준다 | `계획과기록/프로토타입_가이드.md` |')
index.push('')
index.push('## 담은 것')
index.push('')
for (const g of groups) {
  index.push(`### ${g.title}`)
  index.push('')
  if (g.note !== '') {
    index.push(g.note)
    index.push('')
  }
  index.push('| 파일 | 줄 | 무엇이 들었나 |')
  index.push('|---|---|---|')
  for (const f of g.files) {
    if (f.lines === undefined) continue
    index.push(`| \`${f.to}\` | ${f.lines} | ${f.what} |`)
  }
  index.push('')
}
index.push('## 담지 않은 것 (일부러)')
index.push('')
index.push('| 무엇 | 왜 |')
index.push('|---|---|')
index.push('| `docs/reference/` 원본 3종 (개발시작 프롬프트 · 구현설계 · 첨부자료 검토보고서) | **원본 입력자료**다. 이 묶음은 「학습된 것」이고 원본은 제자리에서 읽는다. 복사본을 만들면 어느 쪽이 원본인지 흐려진다 (CLAUDE.md 원본 불변) |')
index.push('| `data/review/*.csv` (요구사항 원문·INDEX·추적후보) | 고객 자료다. 공개 저장소에도 묶음에도 담지 않는다. 두는 방법은 `패키지안내/data-review.md` |')
index.push('| 코드 · 테스트 · fixture | 문서 묶음이다. 코드는 저장소에서 본다 |')
index.push('| 생성된 설계서 HTML · 검증 결과 | 실행하면 만들어진다. 데모는 설치 없이 열린다 — `계획과기록/프로토타입_가이드.md` |')
index.push('')
index.push('## 다시 뜨는 방법')
index.push('')
index.push('```bash')
index.push('node scripts/bundle-knowledge.mjs      # → .bundle/ 에 폴더와 zip')
index.push('```')
index.push('')
index.push('매니페스트는 `scripts/bundle-knowledge.mjs` 안에 있다. 문서를 더하면 거기에 한 줄 적는다.')
if (unlisted.length > 0) {
  index.push('')
  index.push(`> 참고: \`.claude/skills/\` 에 매니페스트에 없는 skill 이 있다 — ${unlisted.join(', ')}. 스크립트에 추가해야 묶음에 들어간다.`)
}
index.push('')
writeFileSync(join(stage, 'INDEX.md'), index.join('\n'), 'utf8')

execFileSync('zip', ['-q', '-r', '-X', `${bundleName}.zip`, bundleName], { cwd: outRoot })

console.log(`묶음: ${join(outRoot, bundleName)}`)
console.log(`zip  : ${join(outRoot, `${bundleName}.zip`)}`)
console.log(`문서 ${copied}개 / ${totalLines}줄`)
if (missing.length > 0) console.log(`없어서 빠진 파일: ${missing.join(', ')}`)
if (unlisted.length > 0) console.log(`매니페스트에 없는 skill: ${unlisted.join(', ')}`)
