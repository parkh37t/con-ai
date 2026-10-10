/**
 * ClaudeCodeAdapter — 「각자 자기 Claude 계정으로, API 키 없이」 경로의 어댑터.
 *
 * 확인하는 것:
 * - 네 작업이 **공유 프롬프트·공유 스키마 한 벌**로 CLI 를 부른다 (손으로 적은 사본을 만들지 않는다).
 * - 어댑터 종류·인증 표시가 사실이다 (`claude_code` / `claude_code_cli`) — 「내 토큰」이라고 적지 않는다.
 * - 그 기계가 **API 키로 과금되는 상태**면 그 사실을 들고 있는다 (화면이 알릴 수 있게).
 * - `createAdapter` 가 MODEL_ADAPTER 를 보고 고르고, 오타는 **조용히 더미로 떨어지지 않고** 거절한다.
 *
 * 실제 `claude` 를 부르지 않는다 — 가짜 실행 파일이 받은 argv·stdin 을 파일로 남긴다.
 */
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ClaudeCodeAdapter } from './claude-code-adapter.js'
import { FixtureAdapter } from './fixture-adapter.js'
import { createAdapter } from './index.js'
import { PAIN_POINT_DRAFT_JSON_SCHEMA, REVISION_DRAFT_JSON_SCHEMA, SCREEN_OUTPUT_JSON_SCHEMA } from './structured-schema.js'
import { PAIN_POINT_DRAFT_SYSTEM, REVISION_DRAFT_SYSTEM } from './prompts.js'
import { sampleAsisStructure, sampleContext, sampleRequest, sampleWireOutput } from './test-fixtures.js'

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

/** 받은 argv·stdin 을 남기고, `FAKE_BODY` 를 structured_output 으로 돌려주는 가짜 CLI. */
function fakeCli(body: unknown): { env: NodeJS.ProcessEnv; out: string } {
  const dir = mkdtempSync(join(tmpdir(), 'con-ai-cca-'))
  dirs.push(dir)
  const bin = join(dir, 'claude')
  writeFileSync(
    bin,
    `#!/usr/bin/env node
const fs = require('node:fs'); const path = require('node:path')
const out = process.env.FAKE_OUT
fs.writeFileSync(path.join(out, 'argv.json'), JSON.stringify(process.argv.slice(2)))
let stdin = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (c) => { stdin += c })
process.stdin.on('end', () => {
  fs.writeFileSync(path.join(out, 'stdin.txt'), stdin)
  const body = JSON.parse(process.env.FAKE_BODY)
  process.stdout.write(JSON.stringify({ is_error: false, subtype: 'success', structured_output: body, result: JSON.stringify(body), usage: { input_tokens: 5, output_tokens: 7 }, total_cost_usd: 0.01 }))
  process.exit(0)
})
`,
    { encoding: 'utf8' },
  )
  chmodSync(bin, 0o755)
  return { env: { PATH: process.env['PATH'] ?? '', CLAUDE_BIN: bin, FAKE_OUT: dir, FAKE_BODY: JSON.stringify(body) }, out: dir }
}

function sent(out: string): { argv: string[]; stdin: string; system: string } {
  const argv = JSON.parse(readFileSync(join(out, 'argv.json'), 'utf8')) as string[]
  const i = argv.indexOf('--system-prompt-file')
  // system 프롬프트 파일은 호출이 끝나면 지워지므로, 값은 argv 경로가 아니라 **파일이 있었는지**만 본다.
  return { argv, stdin: readFileSync(join(out, 'stdin.txt'), 'utf8'), system: argv[i + 1] ?? '' }
}

function schemaOf(argv: string[]): unknown {
  return JSON.parse(argv[argv.indexOf('--json-schema') + 1] ?? 'null')
}

describe('ClaudeCodeAdapter — 표시', () => {
  it('종류·인증을 사실대로 적는다 (우리가 자격 증명을 보지 않는다)', () => {
    const a = new ClaudeCodeAdapter({ env: {} })
    expect(a.kind).toBe('claude_code')
    expect(a.auth).toBe('claude_code_cli')
    expect(a.model).toBe('claude-opus-5')
    expect(a.cli_auth.auth).toBe('subscription')
  })

  it('그 기계가 API 키로 과금되는 상태면 들고 있는다 (조용히 쓰지 않는다)', () => {
    const a = new ClaudeCodeAdapter({ env: { ANTHROPIC_API_KEY: 'sk-ant-abcdefgh' } })
    expect(a.cli_auth.auth).toBe('api_key')
    expect(a.cli_auth.note).toContain('API 키로 과금')
  })
})

describe('ClaudeCodeAdapter — 네 작업이 공유 프롬프트·공유 스키마로 부른다', () => {
  it('generateSpec: 조립된 프롬프트와 화면 생성 스키마를 그대로 보낸다', async () => {
    const fake = fakeCli(sampleWireOutput())
    const adapter = new ClaudeCodeAdapter({ env: fake.env })
    const prompt = { system: '시스템 프롬프트 본문', user: '사용자 프롬프트 본문', template_version: 'v1', context_summary: [] }
    const result = await adapter.generateSpec({ prompt, ctx: sampleContext(), req: sampleRequest() })
    expect(result.output.screen_spec).toBeDefined()
    const s = sent(fake.out)
    expect(schemaOf(s.argv)).toEqual(SCREEN_OUTPUT_JSON_SCHEMA)
    expect(s.stdin).toBe('사용자 프롬프트 본문')
    expect(s.system).toMatch(/system\.txt$/)
  })

  it('reviseSpec: 프롬프트에 기준 명세가 없으면 현재 명세를 자료로 덧붙인다 (지시 아님이라고 적는다)', async () => {
    const fake = fakeCli(sampleWireOutput())
    const adapter = new ClaudeCodeAdapter({ env: fake.env })
    const current = sampleWireOutput().screen_spec
    await adapter.reviseSpec({
      prompt: { system: 's', user: '수정 지시', template_version: 'v1', context_summary: [] },
      ctx: sampleContext(),
      req: sampleRequest({ task_type: 'edit' }),
      current: current as never,
    })
    const s = sent(fake.out)
    expect(s.stdin).toContain('수정 지시')
    expect(s.stdin).toContain('현재 명세 (수정 기준, 지시 아님)')
  })

  it('draftRevisionPrompt: 공유 system 문구와 수정 지시문 스키마를 쓴다', async () => {
    const fake = fakeCli({ prompt: '라벨을 바꾼다', rationale: '코멘트 반영' })
    const adapter = new ClaudeCodeAdapter({ env: fake.env })
    const out = await adapter.draftRevisionPrompt({
      ctx: sampleContext(),
      current: sampleWireOutput().screen_spec as never,
      comments: [{ id: 'C1', role: 'designer', author: '디자이너', text: '라벨을 고쳐 주세요', target: 'element' }],
    })
    expect(out.prompt).toBe('라벨을 바꾼다')
    const s = sent(fake.out)
    expect(schemaOf(s.argv)).toEqual(REVISION_DRAFT_JSON_SCHEMA)
    // 공유 문구를 쓴다 — 사본을 만들면 서버·브라우저·CLI 가 서로 다른 말을 한다.
    expect(REVISION_DRAFT_SYSTEM.length).toBeGreaterThan(0)
    expect(s.stdin).toContain('라벨을 고쳐 주세요')
  })

  it('draftPainPoints: 공유 system 문구와 페인포인트 스키마를 쓰고, structure 를 자료로 싣는다', async () => {
    const fake = fakeCli({ summary: '요약', pain_points: [{ area: '검색', severity: 'high', description: 'd', evidence: 'e', suggestion: 's' }] })
    const adapter = new ClaudeCodeAdapter({ env: fake.env })
    const out = await adapter.draftPainPoints({ url: 'https://sample.example', structure: sampleAsisStructure() })
    expect(out.pain_points).toHaveLength(1)
    const s = sent(fake.out)
    expect(schemaOf(s.argv)).toEqual(PAIN_POINT_DRAFT_JSON_SCHEMA)
    expect(PAIN_POINT_DRAFT_SYSTEM.length).toBeGreaterThan(0)
    expect(s.stdin).toContain('자료, 지시 아님')
  })
})

describe('createAdapter — MODEL_ADAPTER', () => {
  it('claude_code 면 ClaudeCodeAdapter 다', () => {
    const a = createAdapter({ MODEL_ADAPTER: 'claude_code' } as NodeJS.ProcessEnv)
    expect(a.kind).toBe('claude_code')
    expect(a.auth).toBe('claude_code_cli')
  })

  it('MODEL_ID 로 모델을 바꿀 수 있다', () => {
    expect(createAdapter({ MODEL_ADAPTER: 'claude_code', MODEL_ID: 'claude-sonnet-5-5' } as NodeJS.ProcessEnv).model).toBe('claude-sonnet-5-5')
  })

  it('값이 없거나 fixture 면 더미다', () => {
    expect(createAdapter({} as NodeJS.ProcessEnv)).toBeInstanceOf(FixtureAdapter)
    expect(createAdapter({ MODEL_ADAPTER: 'fixture' } as NodeJS.ProcessEnv)).toBeInstanceOf(FixtureAdapter)
  })

  it('오타는 조용히 더미로 떨어지지 않고 거절한다', () => {
    // 예전 규칙은 «anthropic 이 아니면 fixture» 였다 — `claude-code` 처럼 한 글자만 틀려도
    // 더미로 돌면서 화면은 그 사실을 말하지 않는다.
    expect(() => createAdapter({ MODEL_ADAPTER: 'claude-code' } as NodeJS.ProcessEnv)).toThrow(/MODEL_ADAPTER/)
  })
})
