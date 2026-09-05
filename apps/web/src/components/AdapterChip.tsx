/**
 * 자격 증명·어댑터 상태 칩 — 메인 화면과 만들기 화면의 상단 바에서 같은 문구를 쓴다.
 *
 * 지금 무엇이 화면을 만드는지 숨기지 않는다(CLAUDE.md: 더미 동작과 실제 모델 호출을 구분해 표시).
 *  - 정적 배포 + 자격 증명 없음 → 저장된 예시만 볼 수 있다
 *  - fixture 어댑터 → 모델 호출 없음(규칙으로 만드는 더미)
 *  - anthropic 어댑터 → 실제 모델 이름
 */
import { IS_DEMO } from '../demo-mode.js'
import type { Meta } from '../types.js'

export function AdapterChip({ meta, credential, testId }: { meta: Meta | null; credential: boolean; testId: string }) {
  if (!meta) return <span className="muted small">연결 확인 중…</span>
  if (IS_DEMO && !credential) {
    return (
      <span className="chip chip-amber" data-testid={testId} title="Claude API 키·토큰이 없어 저장된 예시만 열 수 있습니다">
        저장된 예시 보기 전용
      </span>
    )
  }
  if (meta.adapter === 'fixture') {
    return (
      <span className="chip chip-amber" data-testid={testId} title="모델을 호출하지 않고 규칙으로 만드는 더미 어댑터입니다">
        더미 어댑터 (모델 호출 없음)
      </span>
    )
  }
  return (
    <span className="chip chip-green" data-testid={testId} title={`어댑터 anthropic · 모델 ${meta.model}`}>
      AI {meta.model}
    </span>
  )
}
