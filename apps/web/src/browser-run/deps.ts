/**
 * 브라우저(정적 배포)에서 쓰는 워크스페이스 모듈 모음 (한 곳에 모아 브라우저 안전성을 눈으로 확인한다).
 *
 * - apps/web 은 이 패키지들을 package.json 의존성으로 선언하지 않고 워크스페이스 소스를 상대 경로로 직접 읽는다
 *   (`pnpm install` 없이 동작해야 하므로 잠금 파일을 바꾸지 않는다). 긴 상대 경로는 이 파일에만 둔다.
 * - 브라우저에서 못 쓰는 모듈은 가져오지 않는다:
 *   `@con-ai/validators` 의 index.ts 는 `node:crypto`, v3.ts 는 playwright 를 쓰므로 v1·v2·result·types 만 가져온다.
 *   renderer·prompt-templates·schemas·domain 은 node: 의존이 없다 (renderer 의 node: 사용은 test-helpers·테스트 파일뿐이며 index 로 내보내지 않는다).
 * - **규칙을 다시 쓰지 않는다.** 정적 데모의 추적 체인·ID 발번은 서버와 **같은** `@con-ai/domain` 함수를 부른다
 *   (계산이 서버와 갈라지면 배포 주소의 숫자가 거짓이 된다).
 */
export { assemblePrompt, assembleRevisionPrompt } from '../../../../packages/prompt-templates/src/index.js'
export type { AssembledPrompt, GenerationContext, SliceGenerationRequest as PromptSliceRequest } from '../../../../packages/prompt-templates/src/types.js'

export { renderScreen, RENDERER_VERSION, S2B_LEARNED_PROFILE } from '../../../../packages/renderer/src/index.js'
export type { RenderOutput, RenderProfile } from '../../../../packages/renderer/src/types.js'

export { ActionType, CaseKind, ColumnFormat, ElementType, MessageKind, ScreenSpecShape, SortDirection, UnresolvedKind, ValidationRule, checkScreenSpecReferences } from '../../../../packages/schemas/src/screen-spec.js'
export type { ScreenSpecShape as ScreenSpecShapeType } from '../../../../packages/schemas/src/screen-spec.js'
export { DeviceProfile } from '../../../../packages/schemas/src/screen.js'

export { runV1 } from '../../../../packages/validators/src/v1.js'
export { runV2 } from '../../../../packages/validators/src/v2.js'
export { CHECKER_VERSION, makeResult, newRunId } from '../../../../packages/validators/src/result.js'
export type { CheckResult } from '../../../../packages/validators/src/types.js'

export {
  DomainRuleError,
  assertAllowed,
  canIssueIaExternalId,
  computeRtm,
  issueFnExternalId,
  issueIaExternalId,
  proposeFnExternalId,
  proposeIaExternalId,
  relabelFnExternalId,
  relabelIaExternalId,
} from '../../../../packages/domain/src/index.js'
export type { RtmInput, RtmSpecIndex, RtmReport as DomainRtmReport } from '../../../../packages/domain/src/rtm.js'

export { IANode as IANodeSchema } from '../../../../packages/schemas/src/screen.js'
export type { IANode as IANodeShape } from '../../../../packages/schemas/src/screen.js'
