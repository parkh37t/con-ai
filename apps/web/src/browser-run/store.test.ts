/**
 * 브라우저 저장소 — 누적 저장, 용량 초과 안내, 깨진 데이터 무시, 지우기.
 * 자격 증명 값은 여기에 들어가지 않는다 (credential.ts 가 따로 보관한다).
 */
import { describe, expect, it } from 'vitest'
import { BROWSER_STORE_KEY, BROWSER_STORE_PREFIX, BrowserStore, QUOTA_MESSAGE, emptyStoreData, parseStoreData, type BrowserRevisionRecord } from './store.js'
import { MemoryStorage } from './test-helpers.js'

function record(id: string): BrowserRevisionRecord {
  return {
    screen_id: 'S1',
    screen_external_id: 'SAMPLE-quote-list',
    project_id: 'P1',
    revision: { id, screen_id: 'S1', revision_no: 1, spec_hash: 'a'.repeat(64), artifact_id: `art-${id}`, job_id: 'J1', created_at: '2026-09-05T00:00:00.000Z' },
    spec: { sections: [] },
    artifact: { id: `art-${id}`, kind: 'html', content_hash: 'b'.repeat(64), status: 'validation_pending' },
    validation_results: [],
    element_index: [],
    html: '<html>목업</html>',
    generated_by: 'anthropic:claude-opus-5',
  }
}

describe('저장·읽기', () => {
  it('키 접두사는 con-ai:browser: 이고 revision 을 누적한다', () => {
    const storage = new MemoryStorage()
    const store = new BrowserStore(() => storage)
    expect(BROWSER_STORE_KEY.startsWith(BROWSER_STORE_PREFIX)).toBe(true)
    expect(store.isEmpty()).toBe(true)
    expect(store.addRevision(record('r1'))).toBe(true)
    expect(store.addRevision(record('r2'))).toBe(true)
    expect(store.load().revisions.map((r) => r.revision.id)).toEqual(['r1', 'r2'])

    // 다른 인스턴스(새로고침)에서도 그대로 읽힌다.
    expect(new BrowserStore(() => storage).load().revisions).toHaveLength(2)
  })

  it('같은 revision 을 다시 넣으면 덮어쓴다', () => {
    const store = new BrowserStore(() => new MemoryStorage())
    store.addRevision(record('r1'))
    store.addRevision({ ...record('r1'), html: '<html>새 목업</html>' })
    expect(store.load().revisions).toHaveLength(1)
    expect(store.load().revisions[0]?.html).toContain('새 목업')
  })

  it('코멘트·승인도 누적한다', () => {
    const store = new BrowserStore(() => new MemoryStorage())
    store.setComments('r1', [{ id: 'c1', screen_id: 'S1', revision_id: 'r1', artifact_hash: 'h', target: 'screen', author: '기획자', role: 'planner', text: '수정', blocking: false, status: 'open', created_at: 'now' }])
    store.setApproval({ screen_id: 'S1', revision_id: 'r1', artifact_hash: 'h', approved_by: '기획자', approved_at: 'now', version: '1.0' })
    const data = store.load()
    expect(data.comments['r1']).toHaveLength(1)
    expect(data.approvals['S1']?.version).toBe('1.0')
    expect(store.isEmpty()).toBe(false)
  })

  it('용량이 초과되면 안내를 남기고 false 를 돌려준다 (현재 화면은 계속 동작)', () => {
    const storage = new MemoryStorage()
    const store = new BrowserStore(() => storage)
    storage.quotaFull = true
    expect(store.addRevision(record('r1'))).toBe(false)
    expect(store.lastError).toBe(QUOTA_MESSAGE)
    // 저장에 실패해도 메모리에는 남아 지금 보는 화면이 유지된다.
    expect(store.load().revisions).toHaveLength(1)
  })

  it('저장소를 못 쓰면 안내만 남기고 죽지 않는다', () => {
    const store = new BrowserStore(() => null)
    expect(store.addRevision(record('r1'))).toBe(false)
    expect(store.lastError).toContain('저장소')
  })

  it('지우면 빈 상태로 돌아간다', () => {
    const storage = new MemoryStorage()
    const store = new BrowserStore(() => storage)
    store.addRevision(record('r1'))
    store.reset()
    expect(store.isEmpty()).toBe(true)
    expect(storage.getItem(BROWSER_STORE_KEY)).toBeNull()
  })
})

describe('parseStoreData — 깨진 데이터는 새 결과처럼 쓰지 않는다', () => {
  it('없음·JSON 아님·버전 불일치는 빈 상태', () => {
    expect(parseStoreData(null)).toEqual(emptyStoreData())
    expect(parseStoreData('{')).toEqual(emptyStoreData())
    expect(parseStoreData(JSON.stringify({ version: 99, revisions: [{}] }))).toEqual(emptyStoreData())
  })
  it('형태가 다른 revision 은 버린다', () => {
    const raw = JSON.stringify({ version: 1, revisions: [{ nope: true }], comments: {}, approvals: {} })
    expect(parseStoreData(raw).revisions).toEqual([])
  })
})
