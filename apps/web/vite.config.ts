import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 개발 서버 5173. `/api` 와 `/exports` 는 API(8787)로 넘긴다 (세로 조각 계약 §7·§8).
const API_ORIGIN = process.env['CON_AI_API_ORIGIN'] ?? 'http://localhost:8787'
// 배포 기준 경로. GitHub Pages 하위 경로 배포는 `VITE_BASE=/con-ai/` (pnpm demo:build). 기본은 루트.
const BASE = process.env['VITE_BASE'] ?? '/'

export default defineConfig({
  base: BASE,
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: API_ORIGIN, changeOrigin: false },
      '/exports': { target: API_ORIGIN, changeOrigin: false },
    },
  },
  preview: {
    port: 5173,
    proxy: {
      '/api': { target: API_ORIGIN, changeOrigin: false },
      '/exports': { target: API_ORIGIN, changeOrigin: false },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
