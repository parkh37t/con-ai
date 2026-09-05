# con-ai 운영 이미지 — 한 컨테이너에서 UI(웹 빌드) + API + Chromium(V3 실행 검사·AS-IS 분석)을 돌린다.
#
# 베이스 선택 근거 (docs/plan/배포.md 에 같은 내용을 적어 뒀다):
#   mcr.microsoft.com/playwright:v1.63.0-noble 은 레지스트리 이미지 config 를 확인한 결과 **Node 24** 로 만들어진다
#   (빌드 이력에 `ARG NODE_VERSION=24`). 이 저장소는 Node 22 로 고정돼 있고(package.json engines, .node-version,
#   CLAUDE.md), 저장소가 쓰는 node:sqlite 는 Node 22 에서 실험 기능이라 런타임 메이저를 바꾸면 동작이 달라질 수 있다.
#   그래서 node:22-bookworm 위에 Chromium 만 직접 설치한다(Playwright 이미지는 firefox·webkit 까지 들어 있어 필요 없는 용량도 크다).
#
# **이 저장소에서 이미지 빌드를 검증하지 않았다** — 개발 컨테이너에 Docker 데몬이 없다.
# 사용자 환경에서 `docker compose build` 로 최초 1회 확인이 필요하다.

# syntax=docker/dockerfile:1

# ---------------------------------------------------------------- 1) 의존성
FROM node:22-bookworm AS deps
RUN npm install -g pnpm@10.33.0
WORKDIR /app

# 매니페스트와 lockfile 만 먼저 복사한다 — 소스가 바뀌어도 설치 계층은 캐시된다.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/domain/package.json packages/domain/
COPY packages/importers/package.json packages/importers/
COPY packages/model-adapter/package.json packages/model-adapter/
COPY packages/prompt-templates/package.json packages/prompt-templates/
COPY packages/renderer/package.json packages/renderer/
COPY packages/schemas/package.json packages/schemas/
COPY packages/validators/package.json packages/validators/
COPY workers/generation/package.json workers/generation/
# devDependencies 도 설치한다: 웹 빌드에 vite 가, 실행에 tsx 가 필요하다
# (워크스페이스 패키지가 TypeScript 소스를 그대로 내보내므로 빌드 산출물 대신 tsx 로 실행한다 — 루트 package.json 의 start 와 같다).
RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------- 2) 웹 빌드
FROM deps AS build
WORKDIR /app
# .dockerignore 가 node_modules 를 빼므로 위 계층의 설치 결과는 그대로 남는다.
COPY . .
# 일반 빌드(데모 아님): base `/`, VITE_DEMO 없음 → 브라우저가 같은 오리진의 `/api` 를 호출한다.
RUN pnpm build:web

# ---------------------------------------------------------------- 3) 런타임
FROM node:22-bookworm AS runtime
RUN npm install -g pnpm@10.33.0

# Chromium (V3 실행 검사·AS-IS 분석). 소스보다 먼저 설치해 계층 캐시를 살린다.
# 버전은 apps/api/package.json 의 playwright 와 **같아야 한다** — 올릴 때 두 곳을 함께 고친다.
ARG PLAYWRIGHT_VERSION=1.63.0
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx --yes playwright@${PLAYWRIGHT_VERSION} install --with-deps chromium \
  && chmod -R a+rX /ms-playwright \
  && rm -rf /root/.npm

WORKDIR /app
# 빌드 단계의 /app 전체(소스 + node_modules + apps/web/dist)를 옮긴다.
# 워크스페이스 패키지는 node_modules 안에서 상대 심볼릭 링크로 연결되므로 통째로 복사해야 링크가 유지된다.
COPY --from=build --chown=node:node /app /app

# 영속 데이터(SQLite DB·내보내기 산출물)는 /data 볼륨에 둔다. 컨테이너를 지워도 남는다.
RUN mkdir -p /data/exports && chown -R node:node /data
VOLUME ["/data"]

ENV NODE_ENV=production \
    PORT=8787 \
    HOST=0.0.0.0 \
    CON_AI_DB=/data/con-ai.db \
    EXPORT_DIR=/data/exports \
    WEB_DIST=/app/apps/web/dist \
    MODEL_ADAPTER=fixture

USER node
EXPOSE 8787

# /healthz 는 DB 접근까지 확인한다(실패하면 503). curl 을 설치하지 않으려고 Node 의 fetch 를 쓴다.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# 루트 package.json 의 `start`(tsx apps/api/src/server.ts)와 같은 실행을 프로세스 하나로 한다
# (셸·pnpm 을 거치지 않아 docker stop 의 SIGTERM 이 서버에 바로 간다).
CMD ["node", "--import", "tsx", "--enable-source-maps", "apps/api/src/server.ts"]
