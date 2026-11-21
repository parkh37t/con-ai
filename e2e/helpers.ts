/**
 * e2e 보조 — 작업 상태 대기, 시드 화면 id 조회, 내보내기 폴더 확인. 단언을 약화하지 않는다(실패 작업은 즉시 실패로 보고).
 */
import { readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, type APIRequestContext, type Page } from '@playwright/test'

/** 저장소 루트 (e2e/ 의 부모). */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
/** playwright.config.ts 의 EXPORT_DIR 과 같아야 한다. */
export const E2E_EXPORT_DIR = resolve(REPO_ROOT, '.local', 'e2e-exports')

export interface SeedScreen {
  id: string
  external_id: string
  title: string
  status: string
  version: string | null
  current_revision_id: string | null
  revision_count: number
  open_comments: number
}

export interface SeedProject {
  id: string
  name: string
  screens: SeedScreen[]
}

/** API 에서 첫 프로젝트와 화면 목록을 읽는다 (웹이 보는 것과 같은 계약 §7 응답). */
export async function loadSeedProject(request: APIRequestContext): Promise<SeedProject> {
  const projectsRes = await request.get('/api/projects')
  expect(projectsRes.ok(), `GET /api/projects → ${projectsRes.status()}`).toBe(true)
  const projects = (await projectsRes.json()) as Array<{ id: string; name: string }>
  const first = projects[0]
  if (!first) throw new Error('시드 프로젝트가 없다')
  const detailRes = await request.get(`/api/projects/${first.id}`)
  expect(detailRes.ok(), `GET /api/projects/:id → ${detailRes.status()}`).toBe(true)
  const detail = (await detailRes.json()) as { project: { id: string; name: string }; screens: SeedScreen[] }
  return { id: detail.project.id, name: detail.project.name, screens: detail.screens }
}

export function screenByExternalId(project: SeedProject, externalId: string): SeedScreen {
  const s = project.screens.find((x) => x.external_id === externalId)
  if (!s) throw new Error(`시드 화면이 없다: ${externalId}`)
  return s
}

/**
 * 작업 상태 패널이 종료 상태가 될 때까지 기다린 뒤 succeeded 를 단언한다.
 * 실패·취소면 기다리지 않고 실패 원인(패널의 오류 상자)을 메시지에 담아 바로 실패한다.
 */
export async function expectJobSucceeded(page: Page, timeoutMs: number): Promise<void> {
  const status = page.getByTestId('job-status')
  await expect(status).toBeVisible({ timeout: 30_000 })
  await expect
    .poll(async () => (await status.getAttribute('data-status')) ?? '', { timeout: timeoutMs, intervals: [1000], message: `작업이 ${timeoutMs / 1000}초 안에 끝나지 않았다` })
    .toMatch(/^(succeeded|failed|cancelled)$/)
  const final = await status.getAttribute('data-status')
  if (final !== 'succeeded') {
    const failure = await page.getByTestId('job-failure').textContent().catch(() => null)
    throw new Error(`작업이 ${final} 로 끝났다: ${failure ?? '(실패 원인 없음)'}`)
  }
  await expect(status).toHaveText('성공')
}

/** URL 의 해시 쿼리 값. */
export function hashQuery(url: string, key: string): string | null {
  const hash = new URL(url).hash
  const q = hash.indexOf('?')
  if (q === -1) return null
  return new URLSearchParams(hash.slice(q + 1)).get(key)
}

/** 내보내기 폴더의 파일 이름 목록(정렬). 폴더가 없으면 빈 배열이 아니라 오류. */
export function listExportFiles(exportPath: string): string[] {
  return readdirSync(resolve(E2E_EXPORT_DIR, exportPath)).sort()
}
