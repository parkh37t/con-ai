import { describe, expect, it } from 'vitest'
import { exportDirUrl, exportFileUrl, exportRelativeDir, fileBasename } from './export-paths.js'

describe('exportRelativeDir / exportDirUrl — 내보내기 폴더 URL', () => {
  it('절대 경로·상대 경로 모두 exports/ 이후만 쓴다', () => {
    expect(exportRelativeDir('/srv/con-ai/exports/sample/SAMPLE-quote-list/v1.0')).toBe('sample/SAMPLE-quote-list/v1.0')
    expect(exportRelativeDir('exports/sample/SAMPLE-quote-list/v1.0/')).toBe('sample/SAMPLE-quote-list/v1.0')
    expect(exportDirUrl('exports/sample/SCR/v1.0')).toBe('/exports/sample/SCR/v1.0')
  })

  it('exports/ 가 없으면 전체를 exports 아래 상대 경로로 본다; 윈도우 구분자도 처리', () => {
    expect(exportDirUrl('sample/SCR/v1.0')).toBe('/exports/sample/SCR/v1.0')
    expect(exportDirUrl('C:\\work\\exports\\sample\\SCR\\v1.0')).toBe('/exports/sample/SCR/v1.0')
    expect(exportDirUrl('')).toBe('/exports')
  })
})

describe('exportFileUrl — 파일 링크', () => {
  const dir = '/home/x/con-ai/exports/sample/SCR/v1.0'
  it('폴더 상대 파일명', () => {
    expect(exportFileUrl(dir, 'index.html')).toBe('/exports/sample/SCR/v1.0/index.html')
    expect(exportFileUrl(dir, './manifest.json')).toBe('/exports/sample/SCR/v1.0/manifest.json')
  })
  it('exports 를 포함한 절대·상대 파일 경로는 그 뒤만 쓴다', () => {
    expect(exportFileUrl(dir, '/home/x/con-ai/exports/sample/SCR/v1.0/spec.json')).toBe('/exports/sample/SCR/v1.0/spec.json')
    expect(exportFileUrl(dir, 'exports/sample/SCR/v1.0/trace.json')).toBe('/exports/sample/SCR/v1.0/trace.json')
  })
  it('폴더 상대 경로를 이미 포함한 파일 경로는 중복하지 않는다', () => {
    expect(exportFileUrl('exports/sample/SCR/v1.0', 'sample/SCR/v1.0/validation.json')).toBe('/exports/sample/SCR/v1.0/validation.json')
  })
  it('빈 파일 경로는 폴더 URL', () => {
    expect(exportFileUrl(dir, '')).toBe('/exports/sample/SCR/v1.0')
  })
})

describe('fileBasename', () => {
  it('마지막 경로 조각', () => {
    expect(fileBasename('/a/b/index.html')).toBe('index.html')
    expect(fileBasename('index.html')).toBe('index.html')
    expect(fileBasename('a\\b\\spec.json')).toBe('spec.json')
  })
})
