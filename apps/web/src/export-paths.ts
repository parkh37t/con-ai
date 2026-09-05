/**
 * 완료(v1.0) 내보내기 경로 → `/exports/...` 링크 (계약 §7 GET /exports/*, §8 폴더 구조).
 * API 가 export_path 를 절대 경로(`/srv/con-ai/exports/proj/SCR/v1.0`)로 주든 상대 경로(`exports/proj/SCR/v1.0`)로 주든
 * `exports/` 이후만 URL 로 쓴다. 파일 경로는 폴더 기준 상대(`index.html`)거나 exports 를 포함한 경로일 수 있다.
 */

const EXPORTS_MARKER = 'exports/'

function normalize(p: string): string {
  return p.replace(/\\/g, '/').trim()
}

function trimSlashes(p: string): string {
  return p.replace(/^\/+/, '').replace(/\/+$/, '')
}

/** `exports/` 이후의 경로만 남긴다. 없으면 전체를 exports 아래 상대 경로로 본다. */
export function exportRelativeDir(exportPath: string): string {
  const p = normalize(exportPath)
  const idx = p.lastIndexOf(EXPORTS_MARKER)
  const rel = idx === -1 ? p : p.slice(idx + EXPORTS_MARKER.length)
  return trimSlashes(rel)
}

/** 내보내기 폴더의 URL (`/exports/<project>/<screen>/v1.0`). */
export function exportDirUrl(exportPath: string): string {
  const rel = exportRelativeDir(exportPath)
  return rel ? `/exports/${rel}` : '/exports'
}

/** 파일 하나의 URL. */
export function exportFileUrl(exportPath: string, filePath: string): string {
  const file = normalize(filePath)
  const idx = file.lastIndexOf(EXPORTS_MARKER)
  if (idx !== -1) return `/exports/${trimSlashes(file.slice(idx + EXPORTS_MARKER.length))}`
  const rel = trimSlashes(file.replace(/^(\.\/)+/, ''))
  const dir = exportDirUrl(exportPath)
  if (!rel) return dir
  // 파일 경로가 이미 폴더 상대 경로를 포함하면(예: `SAMPLE/v1.0/index.html`) 중복하지 않는다.
  const dirRel = exportRelativeDir(exportPath)
  if (dirRel && rel.startsWith(`${dirRel}/`)) return `/exports/${rel}`
  return `${dir}/${rel}`
}

/** 파일 이름만 (표시용). */
export function fileBasename(filePath: string): string {
  const p = trimSlashes(normalize(filePath))
  const i = p.lastIndexOf('/')
  return i === -1 ? p : p.slice(i + 1)
}
