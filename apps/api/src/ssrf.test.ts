/**
 * SSRF 차단 (ssrf.ts, docs/plan/배포.md §7) 테스트.
 *
 * (a) isBlockedIp — 대역별 표(차단·허용 양쪽), IPv4-mapped IPv6, 잘못된 입력은 fail closed.
 * (b) parsePolicy / hostMatches — 환경변수 해석과 목록 일치 규칙.
 * (c) checkUrl — 공개 허용·사설 거부·DNS 로 사설이 나오는 호스트 거부·allowlist 우회·blocklist 우선·
 *     ASIS_ALLOW_PRIVATE 허용·스킴 거부·자기 자신(/asis-sample) 예외.
 * (d) cacheResolve — 호스트 단위로 한 번만 해석한다.
 */
import { describe, expect, it, vi } from 'vitest'
import {
  BLOCKED_IPV4_RANGES,
  DEFAULT_SELF_PORT,
  SELF_ORIGIN_HOSTS,
  SELF_ORIGIN_PATHS,
  cacheResolve,
  checkUrl,
  hostMatches,
  isBlockedIp,
  parsePolicy,
  type SsrfPolicy,
  type SsrfResolve,
} from './ssrf.js'

/** 기본 정책(전부 차단) 위에 필요한 것만 바꾼다. */
function policy(overrides: Partial<SsrfPolicy> = {}): SsrfPolicy {
  return { ...parsePolicy({}), ...overrides }
}

/** 호스트 → IP 를 표로 주는 가짜 해석기. 표에 없으면 실패한다(NXDOMAIN 처럼). */
function fakeResolve(table: Readonly<Record<string, string[]>>): SsrfResolve {
  return async (host) => {
    const ips = table[host]
    if (ips === undefined) throw new Error(`getaddrinfo ENOTFOUND ${host}`)
    return ips
  }
}

/** checkUrl 이 해석기를 부르면 테스트가 실패한다 (allowlist·리터럴 경로 확인용). */
const neverResolve: SsrfResolve = async (host) => {
  throw new Error(`해석하면 안 된다: ${host}`)
}

// ---------- (a) isBlockedIp ----------

describe('isBlockedIp — 차단 대역 표', () => {
  const BLOCKED: ReadonlyArray<[string, string]> = [
    ['0.0.0.0', '0.0.0.0/8 이 네트워크'],
    ['0.255.255.255', '0.0.0.0/8 끝'],
    ['10.0.0.1', '10/8 사설'],
    ['10.255.255.255', '10/8 끝'],
    ['100.64.0.1', '100.64/10 CGNAT'],
    ['100.127.255.255', '100.64/10 끝'],
    ['127.0.0.1', '127/8 루프백'],
    ['127.255.255.254', '127/8 끝'],
    ['169.254.0.1', '169.254/16 링크로컬'],
    ['169.254.169.254', '클라우드 메타데이터'],
    ['172.16.0.1', '172.16/12 사설'],
    ['172.31.255.255', '172.16/12 끝'],
    ['192.0.0.1', '192.0.0/24 IETF 할당'],
    ['192.0.2.1', '192.0.2/24 문서용'],
    ['192.168.0.1', '192.168/16 사설'],
    ['192.168.255.255', '192.168/16 끝'],
    ['198.51.100.1', '198.51.100/24 문서용'],
    ['203.0.113.1', '203.0.113/24 문서용'],
    ['224.0.0.1', '224/4 멀티캐스트'],
    ['239.255.255.255', '224/4 끝'],
    ['240.0.0.1', '240/4 예약'],
    ['255.255.255.255', '브로드캐스트'],
  ]
  it.each(BLOCKED)('차단한다: %s (%s)', (ip) => {
    expect(isBlockedIp(ip)).toBe(true)
  })

  const ALLOWED: ReadonlyArray<[string, string]> = [
    ['1.1.1.1', '공개 DNS'],
    ['8.8.8.8', '공개 DNS'],
    ['93.184.216.34', '공개 웹'],
    ['9.255.255.255', '10/8 바로 앞'],
    ['11.0.0.1', '10/8 바로 뒤'],
    ['100.63.255.255', 'CGNAT 바로 앞'],
    ['100.128.0.1', 'CGNAT 바로 뒤'],
    ['126.255.255.255', '127/8 바로 앞'],
    ['128.0.0.1', '127/8 바로 뒤'],
    ['169.253.255.255', '169.254/16 바로 앞'],
    ['169.255.0.1', '169.254/16 바로 뒤'],
    ['172.15.255.255', '172.16/12 바로 앞'],
    ['172.32.0.1', '172.16/12 바로 뒤'],
    ['192.0.1.1', '192.0.0/24 와 192.0.2/24 사이'],
    ['192.0.3.1', '192.0.2/24 바로 뒤'],
    ['192.167.255.255', '192.168/16 바로 앞'],
    ['192.169.0.1', '192.168/16 바로 뒤'],
    ['198.51.99.255', '문서용 바로 앞'],
    ['203.0.114.1', '문서용 바로 뒤'],
    ['223.255.255.255', '224/4 바로 앞'],
  ]
  it.each(ALLOWED)('허용한다: %s (%s)', (ip) => {
    expect(isBlockedIp(ip)).toBe(false)
  })

  it('표에 적은 13개 IPv4 대역을 모두 검사한다 (표가 곧 문서다)', () => {
    expect(BLOCKED_IPV4_RANGES.map((r) => r.cidr)).toEqual([
      '0.0.0.0/8',
      '10.0.0.0/8',
      '100.64.0.0/10',
      '127.0.0.0/8',
      '169.254.0.0/16',
      '172.16.0.0/12',
      '192.0.0.0/24',
      '192.0.2.0/24',
      '192.168.0.0/16',
      '198.51.100.0/24',
      '203.0.113.0/24',
      '224.0.0.0/4',
      '240.0.0.0/4',
    ])
  })

  const BLOCKED_V6: ReadonlyArray<[string, string]> = [
    ['::1', '루프백'],
    ['::', '미지정'],
    ['fe80::1', 'fe80::/10 링크로컬'],
    ['febf:ffff::1', 'fe80::/10 끝'],
    ['fc00::1', 'fc00::/7 ULA'],
    ['fd12:3456::1', 'fc00::/7 ULA'],
    ['ff02::1', 'ff00::/8 멀티캐스트'],
    ['2001:db8::1', '2001:db8::/32 문서용'],
    ['::ffff:10.0.0.1', 'IPv4-mapped 사설'],
    ['::ffff:127.0.0.1', 'IPv4-mapped 루프백'],
    ['::ffff:169.254.169.254', 'IPv4-mapped 메타데이터'],
    ['::ffff:a00:1', 'IPv4-mapped 16진 표기(= 10.0.0.1)'],
    ['64:ff9b::10.0.0.1', 'NAT64 로 감싼 사설'],
    ['::10.0.0.1', 'IPv4 호환 표기(::/96)'],
    ['[::1]', '대괄호가 붙은 형태'],
    ['fe80::1%eth0', '존 인덱스가 붙은 링크로컬'],
  ]
  it.each(BLOCKED_V6)('IPv6 차단: %s (%s)', (ip) => {
    expect(isBlockedIp(ip)).toBe(true)
  })

  const ALLOWED_V6: ReadonlyArray<[string, string]> = [
    ['2606:4700:4700::1111', '공개 DNS'],
    ['2001:4860:4860::8888', '공개 DNS'],
    ['::ffff:8.8.8.8', 'IPv4-mapped 공개'],
    ['64:ff9b::8.8.8.8', 'NAT64 로 감싼 공개'],
    ['fbff::1', 'fc00::/7 바로 앞'],
    ['fec0::1', 'fe80::/10 바로 뒤'],
    ['2001:db9::1', '문서용 바로 뒤'],
  ]
  it.each(ALLOWED_V6)('IPv6 허용: %s (%s)', (ip) => {
    expect(isBlockedIp(ip)).toBe(false)
  })

  const INVALID = ['', '   ', 'not-an-ip', 'localhost', '10.0.0', '10.0.0.1.2', '999.0.0.1', '010.0.0.1', '0x7f.0.0.1', '10.0.0.1:80', '::gggg', 'http://10.0.0.1/']
  it.each(INVALID)('IP 로 읽을 수 없으면 차단한다 (fail closed): %s', (value) => {
    expect(isBlockedIp(value)).toBe(true)
  })
})

// ---------- (b) parsePolicy / hostMatches ----------

describe('parsePolicy — 환경변수 해석', () => {
  it('기본은 전부 차단이다: 사설 불허, 목록 비어 있음, 자기 포트는 8787(server.ts 기본과 같다)', () => {
    const p = parsePolicy({})
    expect(p.allow_private).toBe(false)
    expect(p.allowed_hosts).toEqual([])
    expect(p.blocked_hosts).toEqual([])
    expect(p.self_origin_hosts).toEqual(SELF_ORIGIN_HOSTS)
    expect(p.self_origin_port).toBe(DEFAULT_SELF_PORT)
    expect(p.self_origin_paths).toEqual(SELF_ORIGIN_PATHS)
  })

  it.each(['1', 'true', 'TRUE', ' yes ', 'Yes'])('ASIS_ALLOW_PRIVATE=%s 는 허용으로 읽는다', (value) => {
    expect(parsePolicy({ ASIS_ALLOW_PRIVATE: value }).allow_private).toBe(true)
  })

  it.each(['', '0', 'false', 'no', 'off', 'y'])('ASIS_ALLOW_PRIVATE=%s 는 차단 유지다', (value) => {
    expect(parsePolicy({ ASIS_ALLOW_PRIVATE: value }).allow_private).toBe(false)
  })

  it('호스트 목록은 쉼표로 나누고 소문자·공백·끝점을 정리한다', () => {
    const p = parsePolicy({ ASIS_ALLOWED_HOSTS: ' Staging.Corp. , .internal.corp ,, ', ASIS_BLOCKED_HOSTS: 'metadata.google.internal' })
    expect(p.allowed_hosts).toEqual(['staging.corp', '.internal.corp'])
    expect(p.blocked_hosts).toEqual(['metadata.google.internal'])
  })

  it('PORT 를 자기 서버 포트로 쓴다 (없거나 잘못되면 8787)', () => {
    expect(parsePolicy({ PORT: '3000' }).self_origin_port).toBe(3000)
    expect(parsePolicy({ PORT: 'abc' }).self_origin_port).toBe(DEFAULT_SELF_PORT)
    expect(parsePolicy({ PORT: '0' }).self_origin_port).toBe(DEFAULT_SELF_PORT)
  })
})

describe('hostMatches — 정확히 일치 또는 .example.com 접미사', () => {
  it('정확히 일치만 허용한다 (부분 문자열은 아니다)', () => {
    expect(hostMatches('example.com', ['example.com'])).toBe(true)
    expect(hostMatches('EXAMPLE.com.', ['example.com'])).toBe(true)
    expect(hostMatches('notexample.com', ['example.com'])).toBe(false)
    expect(hostMatches('a.example.com', ['example.com'])).toBe(false)
  })

  it('.example.com 은 하위 도메인과 그 도메인 자신에 맞는다', () => {
    expect(hostMatches('a.example.com', ['.example.com'])).toBe(true)
    expect(hostMatches('a.b.example.com', ['.example.com'])).toBe(true)
    expect(hostMatches('example.com', ['.example.com'])).toBe(true)
    expect(hostMatches('evil-example.com', ['.example.com'])).toBe(false)
    expect(hostMatches('example.com.evil.net', ['.example.com'])).toBe(false)
  })
})

// ---------- (c) checkUrl ----------

describe('checkUrl — 기본은 차단, 열려면 명시적으로 연다', () => {
  it('공개 IP 리터럴은 허용하고 해석기를 부르지 않는다', async () => {
    const verdict = await checkUrl('http://93.184.216.34/보고서', policy(), neverResolve)
    expect(verdict).toEqual({ allowed: true, ips: ['93.184.216.34'] })
  })

  it.each([
    ['http://10.0.0.5/admin', '사설'],
    ['https://192.168.0.1/', '사설'],
    ['http://127.0.0.1:9000/internal', '루프백'],
    ['http://169.254.169.254/latest/meta-data/', '클라우드 메타데이터'],
    ['http://[::1]:9000/internal', 'IPv6 루프백'],
    ['http://[::ffff:10.0.0.1]/', 'IPv4-mapped 사설'],
    ['http://2130706433/', '10진수로 감춘 127.0.0.1 (URL 파서가 정규화한다)'],
  ])('사설·내부 주소는 거부한다: %s (%s)', async (url) => {
    const verdict = await checkUrl(url, policy(), neverResolve)
    expect(verdict.allowed).toBe(false)
    if (verdict.allowed) throw new Error('허용되면 안 된다')
    expect(verdict.code).toBe('blocked_ip')
    expect(verdict.reason).toContain('ASIS_ALLOW_PRIVATE')
  })

  it('DNS 가 사설로 해석되는 호스트를 거부하고 사유에 호스트와 IP 를 적는다', async () => {
    const verdict = await checkUrl('http://intra.example.com/보드', policy(), fakeResolve({ 'intra.example.com': ['10.1.2.3'] }))
    expect(verdict.allowed).toBe(false)
    if (verdict.allowed) throw new Error('허용되면 안 된다')
    expect(verdict.code).toBe('blocked_ip')
    expect(verdict.reason).toContain('intra.example.com')
    expect(verdict.reason).toContain('10.1.2.3')
  })

  it('A/AAAA 중 하나라도 차단 대역이면 거부한다', async () => {
    const verdict = await checkUrl('http://mixed.example.com/', policy(), fakeResolve({ 'mixed.example.com': ['93.184.216.34', '10.0.0.7'] }))
    expect(verdict.allowed).toBe(false)
    if (verdict.allowed) throw new Error('허용되면 안 된다')
    expect(verdict.reason).toContain('10.0.0.7')
  })

  it('전부 공개로 해석되면 허용하고 해석한 IP 를 돌려준다', async () => {
    const verdict = await checkUrl('https://www.example.com/', policy(), fakeResolve({ 'www.example.com': ['93.184.216.34', '2606:4700::1'] }))
    expect(verdict).toEqual({ allowed: true, ips: ['93.184.216.34', '2606:4700::1'] })
  })

  it('해석에 실패하면 거부한다 (fail closed)', async () => {
    const verdict = await checkUrl('http://없는호스트.example/', policy(), fakeResolve({}))
    expect(verdict.allowed).toBe(false)
    if (verdict.allowed) throw new Error('허용되면 안 된다')
    expect(verdict.code).toBe('dns_failed')
  })

  it('IP 가 하나도 없으면 거부한다', async () => {
    const verdict = await checkUrl('http://빈응답.example/', policy(), fakeResolve({ '빈응답.example': [] }))
    expect(verdict.allowed).toBe(false)
    if (verdict.allowed) throw new Error('허용되면 안 된다')
    expect(verdict.code).toBe('dns_failed')
  })

  it('allowlist 에 있으면 IP 검사를 건너뛴다 (사내 스테이징 분석)', async () => {
    const p = policy({ allowed_hosts: ['.internal.corp'] })
    expect(await checkUrl('http://app.internal.corp/plan', p, neverResolve)).toEqual({ allowed: true, ips: [] })
    // 접미사에 걸리지 않는 이웃 호스트는 그대로 막힌다.
    const other = await checkUrl('http://internal.corp.evil.net/', p, fakeResolve({ 'internal.corp.evil.net': ['10.0.0.9'] }))
    expect(other.allowed).toBe(false)
  })

  it('blocklist 는 allowlist 보다 우선한다', async () => {
    const p = policy({ allowed_hosts: ['metadata.internal'], blocked_hosts: ['metadata.internal'] })
    const verdict = await checkUrl('http://metadata.internal/', p, neverResolve)
    expect(verdict.allowed).toBe(false)
    if (verdict.allowed) throw new Error('허용되면 안 된다')
    expect(verdict.code).toBe('host_blocked')
  })

  it('blocklist 는 ASIS_ALLOW_PRIVATE 로 열어도 그대로 막는다', async () => {
    const p = policy({ ...parsePolicy({ ASIS_ALLOW_PRIVATE: '1' }), blocked_hosts: ['metadata.internal'] })
    expect(p.allow_private).toBe(true)
    const verdict = await checkUrl('http://metadata.internal/', p, neverResolve)
    expect(verdict.allowed).toBe(false)
  })

  it('ASIS_ALLOW_PRIVATE=1 이면 사설 대역을 허용한다 (사내 분석)', async () => {
    const p = parsePolicy({ ASIS_ALLOW_PRIVATE: '1' })
    expect((await checkUrl('http://10.0.0.5/admin', p, neverResolve)).allowed).toBe(true)
    expect((await checkUrl('http://127.0.0.1:9000/internal', p, neverResolve)).allowed).toBe(true)
  })

  it.each(['ftp://example.com/x', 'file:///etc/passwd', 'javascript:alert(1)', 'data:text/html,<b>x</b>', 'gopher://example.com/'])(
    'http/https 가 아닌 스킴은 거부한다: %s',
    async (url) => {
      const verdict = await checkUrl(url, policy(), neverResolve)
      expect(verdict.allowed).toBe(false)
      if (verdict.allowed) throw new Error('허용되면 안 된다')
      expect(verdict.code).toBe('scheme')
    },
  )

  it.each(['상대/경로', '', 'http://', '://example.com'])('URL 로 읽을 수 없으면 거부한다: %s', async (url) => {
    const verdict = await checkUrl(url, policy(), neverResolve)
    expect(verdict.allowed).toBe(false)
    if (verdict.allowed) throw new Error('허용되면 안 된다')
    expect(verdict.code).toBe('invalid_url')
  })
})

describe('checkUrl — 자기 자신(데모 대상) 예외는 합성 데모 페이지 경로 목록뿐이다', () => {
  const p = parsePolicy({ PORT: '8787' })

  it.each([
    ...SELF_ORIGIN_PATHS.map((path) => `http://localhost:8787${path}`),
    `http://127.0.0.1:8787${SELF_ORIGIN_PATHS[0]}`,
    `http://[::1]:8787${SELF_ORIGIN_PATHS[0]}`,
  ])(
    '자기 서버의 데모 페이지는 허용한다: %s',
    async (url) => {
      expect(await checkUrl(url, p, neverResolve)).toEqual({ allowed: true, ips: [] })
    },
  )

  it.each([
    ['http://localhost:8787/api/projects', '같은 서버라도 다른 경로'],
    ['http://localhost:8787/', '루트'],
    ['http://localhost:8787/asis-sample/../api/meta', '경로 조작(정규화되어 /api/meta 가 된다)'],
    ['http://localhost:9999/asis-sample', '다른 포트 — 루프백 포트 스캔을 막는다'],
    ['http://localhost/asis-sample', '포트 생략(80) 은 자기 서버가 아니다'],
    ['http://10.0.0.5:8787/asis-sample', '자기 호스트가 아니다'],
  ])('그 밖의 루프백 주소는 막는다: %s (%s)', async (url) => {
    const verdict = await checkUrl(url, p, neverResolve)
    expect(verdict.allowed).toBe(false)
  })

  it('PORT 를 바꾸면 그 포트가 자기 서버가 된다', async () => {
    const other = parsePolicy({ PORT: '3000' })
    expect((await checkUrl(`http://localhost:3000${SELF_ORIGIN_PATHS[0]}`, other, neverResolve)).allowed).toBe(true)
    expect((await checkUrl(`http://localhost:8787${SELF_ORIGIN_PATHS[0]}`, other, neverResolve)).allowed).toBe(false)
  })
})

// ---------- (d) cacheResolve ----------

describe('cacheResolve — 호스트 단위 캐시', () => {
  it('같은 호스트는 한 번만 해석한다 (하위 리소스마다 DNS 를 치지 않는다)', async () => {
    const inner = vi.fn(async (_host: string) => ['93.184.216.34'])
    const cached = cacheResolve(inner)
    const p = policy()
    await checkUrl('http://a.example.com/1', p, cached)
    await checkUrl('http://a.example.com/2', p, cached)
    await checkUrl('http://A.Example.com./3', p, cached)
    await checkUrl('http://b.example.com/1', p, cached)
    expect(inner).toHaveBeenCalledTimes(2)
    expect(inner.mock.calls.map((c) => c[0])).toEqual(['a.example.com', 'b.example.com'])
  })
})
