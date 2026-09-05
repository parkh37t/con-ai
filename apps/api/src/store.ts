/**
 * 저장소 (계약 §1) — node:sqlite `DatabaseSync` 로 Store 인터페이스를 구현한다.
 *
 * - `documents(kind, id, revision, json, created_at, updated_at, PRIMARY KEY(kind, id))` 하나에 종류별 JSON 문서를 저장한다.
 * - `artifact_html(artifact_id PRIMARY KEY, html)` 는 생성 HTML 본문.
 * - `asis_asset(asset_id PRIMARY KEY, png BLOB)` 는 AS-IS 분석 스크린샷 PNG (계약 §12).
 * - put 은 revision 을 비교해 오래된 저장을 거부한다 (StoreConflictError, code 'stale_revision'; 설계 §11).
 * - 경로가 ':memory:' 면 메모리 DB (테스트용). 파일 경로면 디렉터리를 만든다.
 *
 * node:sqlite 는 Node 22 에서 실험 기능이라 시작 시 ExperimentalWarning 이 한 줄 나온다 — 동작에는 영향이 없다.
 */
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { StoreConflictError, type DocumentKind, type Store, type StoredDocument } from '@con-ai/worker-generation'

export interface SqliteStoreOptions {
  now?: (() => string) | undefined
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS documents (
  kind TEXT NOT NULL,
  id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (kind, id)
);
CREATE INDEX IF NOT EXISTS documents_kind_created ON documents (kind, created_at);
CREATE TABLE IF NOT EXISTS artifact_html (
  artifact_id TEXT PRIMARY KEY,
  html TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS asis_asset (
  asset_id TEXT PRIMARY KEY,
  png BLOB NOT NULL
);
`

/** AS-IS 스크린샷 PNG 저장소 (계약 §12 `asis_asset`). SqliteStore 가 구현하고 asis 라우트·러너가 쓴다. */
export interface AssetStore {
  putAsset(assetId: string, png: Uint8Array): void
  getAsset(assetId: string): Uint8Array | undefined
}

interface Row {
  kind: string
  id: string
  revision: number | bigint
  json: string
  created_at: string
  updated_at: string
}

export class SqliteStore implements Store, AssetStore {
  readonly path: string
  private readonly db: DatabaseSync
  private readonly now: () => string

  constructor(path: string, options: SqliteStoreOptions = {}) {
    this.path = path
    this.now = options.now ?? (() => new Date().toISOString())
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
    this.db = new DatabaseSync(path)
    this.db.exec('PRAGMA journal_mode = WAL')
    this.db.exec(SCHEMA_SQL)
  }

  get<T = unknown>(kind: DocumentKind, id: string): StoredDocument<T> | undefined {
    const row = this.db.prepare('SELECT kind, id, revision, json, created_at, updated_at FROM documents WHERE kind = ? AND id = ?').get(kind, id) as Row | undefined
    return row ? toDocument<T>(row) : undefined
  }

  list<T = unknown>(kind: DocumentKind, filter?: (doc: StoredDocument<T>) => boolean): StoredDocument<T>[] {
    const rows = this.db.prepare('SELECT kind, id, revision, json, created_at, updated_at FROM documents WHERE kind = ? ORDER BY created_at ASC, rowid ASC').all(kind) as unknown as Row[]
    const docs = rows.map((r) => toDocument<T>(r))
    return filter ? docs.filter(filter) : docs
  }

  put<T = unknown>(kind: DocumentKind, id: string, data: T, expectedRevision: number): StoredDocument<T> {
    const current = this.db.prepare('SELECT revision, created_at FROM documents WHERE kind = ? AND id = ?').get(kind, id) as { revision: number | bigint; created_at: string } | undefined
    const currentRevision = current ? Number(current.revision) : 0
    if (currentRevision !== expectedRevision) throw new StoreConflictError(kind, id, expectedRevision, currentRevision)
    const at = this.now()
    const json = JSON.stringify(data)
    const nextRevision = currentRevision + 1
    if (current) {
      this.db.prepare('UPDATE documents SET revision = ?, json = ?, updated_at = ? WHERE kind = ? AND id = ?').run(nextRevision, json, at, kind, id)
    } else {
      this.db.prepare('INSERT INTO documents (kind, id, revision, json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(kind, id, nextRevision, json, at, at)
    }
    return { kind, id, revision: nextRevision, data: JSON.parse(json) as T, created_at: current?.created_at ?? at, updated_at: at }
  }

  delete(kind: DocumentKind, id: string): void {
    this.db.prepare('DELETE FROM documents WHERE kind = ? AND id = ?').run(kind, id)
  }

  getHtml(artifactId: string): string | undefined {
    const row = this.db.prepare('SELECT html FROM artifact_html WHERE artifact_id = ?').get(artifactId) as { html: string } | undefined
    return row?.html
  }

  putHtml(artifactId: string, html: string): void {
    this.db.prepare('INSERT INTO artifact_html (artifact_id, html) VALUES (?, ?) ON CONFLICT(artifact_id) DO UPDATE SET html = excluded.html').run(artifactId, html)
  }

  /** AS-IS 스크린샷 PNG 저장 (계약 §12). 같은 id 면 덮어쓴다. */
  putAsset(assetId: string, png: Uint8Array): void {
    this.db.prepare('INSERT INTO asis_asset (asset_id, png) VALUES (?, ?) ON CONFLICT(asset_id) DO UPDATE SET png = excluded.png').run(assetId, png)
  }

  getAsset(assetId: string): Uint8Array | undefined {
    const row = this.db.prepare('SELECT png FROM asis_asset WHERE asset_id = ?').get(assetId) as { png: Uint8Array } | undefined
    return row?.png
  }

  /** 문서 수 (kind 별). 시드 여부 판단용. */
  count(kind?: DocumentKind): number {
    const row = (kind
      ? this.db.prepare('SELECT COUNT(*) AS n FROM documents WHERE kind = ?').get(kind)
      : this.db.prepare('SELECT COUNT(*) AS n FROM documents').get()) as { n: number | bigint }
    return Number(row.n)
  }

  close(): void {
    this.db.close()
  }
}

function toDocument<T>(row: Row): StoredDocument<T> {
  return { kind: row.kind as DocumentKind, id: row.id, revision: Number(row.revision), data: JSON.parse(row.json) as T, created_at: row.created_at, updated_at: row.updated_at }
}

/** DB 경로 결정: CON_AI_DB 환경변수, 없으면 기본값. */
export function resolveDbPath(env: NodeJS.ProcessEnv, defaultPath: string): string {
  const value = env.CON_AI_DB?.trim()
  return value && value.length > 0 ? value : defaultPath
}

export function openStore(path: string, options: SqliteStoreOptions = {}): SqliteStore {
  return new SqliteStore(path, options)
}
