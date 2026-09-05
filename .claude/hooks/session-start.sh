#!/bin/bash
# Claude Code 세션 시작 훅 — 어떤 환경(웹·로컬)에서든 저장소를 열면 곧바로 개발·검사가 가능하게 만든다.
# 동작: 의존성 설치(멱등) → .env 없으면 기본값(fixture 어댑터)으로 생성 → Playwright 실행 파일 경로를 세션 환경변수로 등록.
# 동기 실행(설치가 끝난 뒤 세션이 시작된다). 비밀값은 만들지도 출력하지도 않는다.
set -euo pipefail
cd "${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"

# 검사·브라우저 설치는 훅에서 생략(세션 시작 지연 방지). scripts/setup.sh 가 나머지를 맡는다.
bash scripts/setup.sh --yes --no-check --no-browser

# Playwright: 이미지에 Chromium 이 있으면 세션 환경변수로 알려 V3 검사·e2e 가 바로 돌게 한다.
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  if [ -x /opt/pw-browsers/chromium ]; then
    echo 'export PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium' >> "$CLAUDE_ENV_FILE"
  fi
  echo 'export MODEL_ADAPTER="${MODEL_ADAPTER:-fixture}"' >> "$CLAUDE_ENV_FILE"
fi
echo "[con-ai] 세션 준비 완료 (pnpm check 로 검사, pnpm dev 로 실행)"
