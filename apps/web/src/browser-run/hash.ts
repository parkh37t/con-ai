/**
 * artifact·파일 hash — HTML 본문의 SHA-256 소문자 hex (서버 hashHtml 과 같은 값).
 * 의존성이 없다 (내보내기 패널이 무거운 모듈을 끌어오지 않도록 분리).
 */
export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
