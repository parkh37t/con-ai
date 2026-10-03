---
name: 배포-전-점검
description: 푸시·배포 전에 무엇을 어떤 순서로 돌리고, 데모 스냅샷을 언제 다시 떠야 하는지. 검사 결과를 pass/fail/error/not_run 으로 구분해 적는 규율과, 정적 데모가 404 나는 흔한 원인이 들어 있다.
---

# 푸시·배포 전에

## 순서

```bash
pnpm check        # typecheck + vitest. 테스트 파일이 없으면 실패한다
pnpm e2e          # 서버 e2e (API + 웹을 띄운다)
pnpm demo:snapshot # ← 시드·파이프라인·렌더러를 고쳤으면 **반드시**
pnpm e2e:demo     # 정적 데모 e2e (API 서버도 자격증명도 없이 돈다)
```

`pnpm check` 통과는 푸시의 **필수 조건**이다 (CLAUDE.md).

## 데모 스냅샷을 다시 떠야 하는 때

`apps/web/public/demo/snapshot.json` 은 **서버를 한 번 돌려 받은 응답을 녹화한 것**이다. 아래를 고쳤으면 다시 뜬다:

- 시드 (`apps/api/src/seed.ts`, `seed-domains.ts`) — 프로젝트·요구사항·IA·화면·레퍼런스·더미데이터
- 파이프라인·렌더러·검증 — 녹화된 산출물 HTML 과 검증 결과가 낡는다
- API 응답 모양

**스냅샷에 없는 경로는 정적 데모에서 404 다.** 실제로 겪은 것:

| 증상 | 원인 |
|---|---|
| 뱅킹·커머스 화면을 열 수도 만들 수도 없다 | `/api/screens/:id` 를 견적 프로젝트 것만 녹화했다 |
| AS-IS 목록의 두 번째 행이 죽는다 | 분석 문서를 하나만 녹화했다 |
| 표가 0행이고 «미확정(근거 없음)» 이 쌓인다 | 참고 골든을 못 골라 더미데이터가 안 붙었다 |

스냅샷 스크립트는 **모든 프로젝트**에 대해 detail·references·asis-analyses·화면 상세를 돈다. 프로젝트나 화면을 더하면 그 루프에 들어가는지 확인한다.

## 검사 결과를 적는 규율

`pass / fail / error / not_run` 을 **구분해서** 적는다.

- 실행하지 않은 검사를 통과로 표시하지 않는다.
- 자격 증명이 없어 못 돌린 것은 `not_run` 이다. 「아마 될 것」이 아니다.
- 테스트를 skip 하거나 단언을 약화시켜 통과시키지 않는다.
- 조건 분기 안의 단언은 **그 분기가 돌았는지 세어** 0이면 실패시킨다. 안 그러면 조용히 건너뛴다.

## 배포

`main` 에 푸시하면 `.github/workflows/pages.yml` 이 GitHub Pages 로 배포한다. 배포 성공을 확인하고 끝낸다:

```bash
gh api 'repos/{owner}/{repo}/actions/runs?branch=main&per_page=1' --jq '.workflow_runs[0] | "\(.head_sha[0:7]) \(.status) \(.conclusion)"'
```

이 컨테이너에서는 `parkh37t.github.io` 를 열 수 없다(프록시 차단). **배포된 주소를 직접 확인했다고 말하지 않는다** — 똑같은 빌드를 로컬에서 띄워(`pnpm demo:build && pnpm demo:serve`) 확인하고 그렇게 적는다.

## 자격 증명

이 저장소의 데모·프로토타입은 **키 없이** 끝까지 돈다 (브라우저 안 더미 어댑터). 실제 모델 경로는 선택이다:

```bash
set -a; source .env; set +a
MODEL_ADAPTER=anthropic pnpm probe:vocab   # 모델이 새 어휘를 실제로 쓰는지
```

키·토큰은 환경변수에서만 읽고 로그·응답·커밋에 넣지 않는다.
