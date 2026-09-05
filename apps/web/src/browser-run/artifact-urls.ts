/**
 * 브라우저에서 만든 산출물 HTML → 격리 iframe 이 읽을 Blob URL.
 *
 * 이 파일은 의존성이 없다 (api.ts 가 정적으로 import 하므로 일반 빌드에 브라우저 모드 코드가 딸려 오지 않게 한다).
 */
const objectUrls = new Map<string, string>()

/** 등록된 Blob URL (없으면 null → 호출부가 스냅샷/서버 URL 을 쓴다). */
export function browserArtifactUrl(artifactId: string): string | null {
  return objectUrls.get(artifactId) ?? null
}

/** HTML 을 Blob URL 로 등록한다. URL API 가 없는 환경(테스트)에서는 null. */
export function registerArtifactHtml(artifactId: string, html: string): string | null {
  const existing = objectUrls.get(artifactId)
  if (existing) return existing
  try {
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
    objectUrls.set(artifactId, url)
    return url
  } catch {
    return null
  }
}

/** 등록된 Blob URL 을 모두 해제한다 (저장 데이터 지우기와 함께 쓴다). */
export function releaseArtifactUrls(): void {
  for (const url of objectUrls.values()) {
    try {
      URL.revokeObjectURL(url)
    } catch {
      /* 무시 */
    }
  }
  objectUrls.clear()
}
