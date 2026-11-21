/** SQLite Store 테스트 — revision 충돌 거부, 목록 순서, HTML 저장, 파일 DB 디렉터리 생성. */
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { StoreConflictError } from '@con-ai/worker-generation'
import { SqliteStore, openStore, resolveDbPath } from './store.js'

const tempDirs: string[] = []
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

let tick = 0
const now = (): string => new Date(Date.UTC(2026, 8, 5, 0, 0, ++tick)).toISOString()

describe('SqliteStore — 문서 저장', () => {
  it('새 문서는 expectedRevision 0 으로 넣고 revision 1 이 된다', () => {
    const store = new SqliteStore(':memory:', { now })
    const doc = store.put('project', 'p1', { name: '샘플' }, 0)
    expect(doc.revision).toBe(1)
    expect(doc.created_at).toBe(doc.updated_at)
    expect(store.get<{ name: string }>('project', 'p1')?.data.name).toBe('샘플')
    expect(store.get('project', '없음')).toBeUndefined()
    store.close()
  })

  it('갱신은 현재 revision 을 넘겨야 하고, 오래된 revision 은 stale_revision 으로 거부한다', () => {
    const store = new SqliteStore(':memory:', { now })
    store.put('screen', 's1', { title: 'v1' }, 0)
    const second = store.put('screen', 's1', { title: 'v2' }, 1)
    expect(second.revision).toBe(2)
    expect(second.updated_at).not.toBe(second.created_at)

    let caught: unknown
    try {
      store.put('screen', 's1', { title: '오래된 화면에서 저장' }, 1)
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(StoreConflictError)
    expect((caught as StoreConflictError).code).toBe('stale_revision')
    expect((caught as StoreConflictError).expected).toBe(1)
    expect((caught as StoreConflictError).current).toBe(2)
    // 거부된 저장은 반영되지 않는다.
    expect(store.get<{ title: string }>('screen', 's1')?.data.title).toBe('v2')
    // 새 문서를 0 이 아닌 revision 으로 넣는 것도 거부한다.
    expect(() => store.put('screen', 's2', {}, 1)).toThrow(StoreConflictError)
    store.close()
  })

  it('list 는 kind 별로 생성 순서대로 돌려주고 filter 를 적용한다', () => {
    const store = new SqliteStore(':memory:', { now })
    store.put('comment', 'c1', { status: 'open' }, 0)
    store.put('comment', 'c2', { status: 'resolved' }, 0)
    store.put('comment', 'c3', { status: 'open' }, 0)
    store.put('screen', 's1', {}, 0)
    expect(store.list('comment').map((d) => d.id)).toEqual(['c1', 'c2', 'c3'])
    expect(store.list<{ status: string }>('comment', (d) => d.data.status === 'open').map((d) => d.id)).toEqual(['c1', 'c3'])
    expect(store.list('screen')).toHaveLength(1)
    expect(store.count()).toBe(4)
    expect(store.count('comment')).toBe(3)
    store.close()
  })

  it('delete 는 문서를 지우고 없는 문서는 무시한다', () => {
    const store = new SqliteStore(':memory:', { now })
    store.put('validation_result', 'v1', {}, 0)
    store.delete('validation_result', 'v1')
    store.delete('validation_result', '없음')
    expect(store.get('validation_result', 'v1')).toBeUndefined()
    // 지운 뒤에는 다시 새 문서(0)로 넣을 수 있다.
    expect(store.put('validation_result', 'v1', {}, 0).revision).toBe(1)
    store.close()
  })

  it('HTML 은 artifact_id 로 저장·조회하고 다시 넣으면 덮어쓴다', () => {
    const store = new SqliteStore(':memory:', { now })
    expect(store.getHtml('a1')).toBeUndefined()
    store.putHtml('a1', '<p>하나</p>')
    store.putHtml('a1', '<p>둘</p>')
    expect(store.getHtml('a1')).toBe('<p>둘</p>')
    store.close()
  })

  it('파일 경로면 디렉터리를 만들고, 다시 열어도 문서가 남아 있다', () => {
    const dir = mkdtempSync(join(tmpdir(), 'con-ai-store-'))
    tempDirs.push(dir)
    const path = join(dir, 'nested', 'deeper', 'con-ai.db')
    const first = openStore(path, { now })
    first.put('project', 'p1', { name: '지속' }, 0)
    first.putHtml('a1', '<p>html</p>')
    first.close()
    expect(existsSync(path)).toBe(true)
    const second = openStore(path, { now })
    expect(second.get<{ name: string }>('project', 'p1')?.data.name).toBe('지속')
    expect(second.getHtml('a1')).toBe('<p>html</p>')
    second.close()
  })

  it('resolveDbPath 는 CON_AI_DB 가 있으면 그 값을, 없거나 비어 있으면 기본값을 쓴다', () => {
    expect(resolveDbPath({ CON_AI_DB: '/tmp/x.db' }, '.local/con-ai.db')).toBe('/tmp/x.db')
    expect(resolveDbPath({ CON_AI_DB: '   ' }, '.local/con-ai.db')).toBe('.local/con-ai.db')
    expect(resolveDbPath({}, '.local/con-ai.db')).toBe('.local/con-ai.db')
  })
})
