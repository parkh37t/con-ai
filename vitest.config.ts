import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['apps/*/src/**/*.test.ts', 'workers/*/src/**/*.test.ts', 'packages/*/src/**/*.test.ts', 'fixtures/**/*.test.ts'],
    exclude: ['**/node_modules/**'],
    environment: 'node',
    // 검사가 실행되지 않았는데 통과로 표시되는 일을 막는다: 테스트 파일이 하나도 없으면 실패한다.
    passWithNoTests: false,
  },
})
