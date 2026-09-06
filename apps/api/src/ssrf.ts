/**
 * AS-IS 분석 대상 URL 의 SSRF(Server-Side Request Forgery) 차단 — docs/plan/배포.md §7 보안 점검표.
 *
 * AS-IS 분석은 서버가 **사용자가 준 URL 을 그대로 방문**한다. 사내망에 배포하면 그대로
 * 내부 관리자 페이지·내부 API·클라우드 메타데이터(169.254.169.254)를 대신 열게 만들 수 있다.
 * 그래서 기본 동작은 **차단**이고, 사내 스테이징 분석이 필요하면 `ASIS_ALLOW_PRIVATE=1` 또는
 * `ASIS_ALLOWED_HOSTS` 로 명시적으로 연다.
 *
 * 구성 — 순수 판정과 해석기를 분리해 테스트할 수 있게 한다.
 *  - `isBlockedIp(ip)`                차단 대역 판정 (순수 함수, 표 기반 테스트).
 *  - `parsePolicy(env)`               환경변수 → 정책.
 *  - `checkUrl(url, policy, resolve)` 스킴·호스트·IP 판정. `resolve` 를 주입할 수 있다.
 *  - `cacheResolve(resolve)`          호스트 단위 캐시 (러너가 하위 리소스마다 DNS 를 치지 않도록).
 *
 * 남은 한계(정직하게 적는다): 우리가 해석한 IP 와 chromium 이 실제로 접속하며 해석하는 IP 는 **다른 조회**다.
 * 그 사이에 DNS 응답이 바뀌면(DNS 리바인딩) 통과할 수 있다. 리다이렉트 각 단계·최종 URL·하위 리소스를
 * 요청 시점에 다시 검사해 창을 좁히지만, 소켓 연결 단계에서 막지 않는 한 완전히 없애지는 못한다.
 */
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

// ---------- IP 판정 ----------

/** 차단할 IPv4 대역 (CIDR). 표 자체가 문서다 — 테스트도 이 표를 근거로 쓴다. */
export const BLOCKED_IPV4_RANGES: ReadonlyArray<{ cidr: string; why: string }> = [
  { cidr: '0.0.0.0/8', why: '이 네트워크(0.0.0.0 포함)' },
  { cidr: '10.0.0.0/8', why: '사설' },
  { cidr: '100.64.0.0/10', why: 'CGNAT' },
  { cidr: '127.0.0.0/8', why: '루프백' },
  { cidr: '169.254.0.0/16', why: '링크로컬 — 169.254.169.254 클라우드 메타데이터 포함' },
  { cidr: '172.16.0.0/12', why: '사설' },
  { cidr: '192.0.0.0/24', why: 'IETF 프로토콜 할당' },
  { cidr: '192.0.2.0/24', why: '문서용(TEST-NET-1)' },
  { cidr: '192.168.0.0/16', why: '사설' },
  { cidr: '198.51.100.0/24', why: '문서용(TEST-NET-2)' },
  { cidr: '203.0.113.0/24', why: '문서용(TEST-NET-3)' },
  { cidr: '224.0.0.0/4', why: '멀티캐스트' },
  { cidr: '240.0.0.0/4', why: '예약(255.255.255.255 브로드캐스트 포함)' },
]

/** 차단할 IPv6 대역. IPv4 를 감싼 형태(::ffff:…, 64:ff9b::…, ::x.x.x.x)는 풀어서 IPv4 표로 다시 본다. */
export const BLOCKED_IPV6_RANGES: ReadonlyArray<{ cidr: string; why: string }> = [
  { cidr: '::/96', why: '미지정(::)·루프백(::1)·IPv4 호환 표기 — 라우팅되지 않는다' },
  { cidr: 'fc00::/7', why: 'ULA(사설)' },
  { cidr: 'fe80::/10', why: '링크로컬' },
  { cidr: 'ff00::/8', why: '멀티캐스트' },
  { cidr: '2001:db8::/32', why: '문서용' },
]

interface Range4 {
  readonly network: number
  readonly mask: number
}

/** `10.0.0.0/8` 같은 표기를 32비트 네트워크·마스크로 바꾼다 (모듈 로드 때 한 번). */
function parseCidr4(cidr: string): Range4 {
  const [address = '', bitsText = ''] = cidr.split('/')
  const bits = Number.parseInt(bitsText, 10)
  const octets = parseIpv4(address)
  if (octets === undefined || !Number.isInteger(bits) || bits < 0 || bits > 32) throw new Error(`잘못된 CIDR: ${cidr}`)
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
  return { network: (toU32(octets) & mask) >>> 0, mask }
}

const BLOCKED_V4: readonly Range4[] = BLOCKED_IPV4_RANGES.map((r) => parseCidr4(r.cidr))

/** 점 표기 IPv4 → 옥텟 4개. `isIP` 가 통과시키는 형태(십진수·앞자리 0 없음)만 받는다. */
function parseIpv4(text: string): [number, number, number, number] | undefined {
  if (isIP(text) !== 4) return undefined
  const [a = 0, b = 0, c = 0, d = 0] = text.split('.').map((p) => Number.parseInt(p, 10))
  return [a, b, c, d]
}

function toU32(octets: readonly [number, number, number, number]): number {
  return ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0
}

/** IPv6 문자열 → 16비트 그룹 8개. `isIP` 로 형식을 이미 확인한 값만 들어온다. */
function expandIpv6(text: string): number[] | undefined {
  let body = text
  // 끝에 IPv4 표기가 붙은 형태(::ffff:192.0.2.1)는 마지막 두 그룹으로 바꾼다.
  const tailV4 = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(body)
  if (tailV4 !== null) {
    const octets = parseIpv4(tailV4[1] ?? '')
    if (octets === undefined) return undefined
    const hex = (n: number): string => n.toString(16)
    body = `${body.slice(0, tailV4.index)}${hex((octets[0] << 8) | octets[1])}:${hex((octets[2] << 8) | octets[3])}`
  }
  const halves = body.split('::')
  if (halves.length > 2) return undefined
  const split = (part: string): number[] => (part === '' ? [] : part.split(':').map((g) => Number.parseInt(g, 16)))
  const head = split(halves[0] ?? '')
  const tail = halves.length === 2 ? split(halves[1] ?? '') : []
  const groups = halves.length === 2 ? [...head, ...new Array<number>(Math.max(0, 8 - head.length - tail.length)).fill(0), ...tail] : head
  if (groups.length !== 8 || groups.some((g) => !Number.isInteger(g) || g < 0 || g > 0xffff)) return undefined
  return groups
}

function groupsAreZero(groups: readonly number[], count: number): boolean {
  for (let i = 0; i < count; i += 1) if ((groups[i] ?? -1) !== 0) return false
  return true
}

/** 감싼 IPv4 를 꺼낸다: `::ffff:a.b.c.d`(IPv4-mapped), `64:ff9b::a.b.c.d`(NAT64), `::a.b.c.d`(IPv4 호환). */
function embeddedIpv4(groups: readonly number[]): [number, number, number, number] | undefined {
  const mapped = groupsAreZero(groups, 5) && groups[5] === 0xffff
  const nat64 = groups[0] === 0x0064 && groups[1] === 0xff9b && groups[2] === 0 && groups[3] === 0 && groups[4] === 0 && groups[5] === 0
  const compatible = groupsAreZero(groups, 6)
  if (!mapped && !nat64 && !compatible) return undefined
  const high = groups[6] ?? 0
  const low = groups[7] ?? 0
  return [(high >> 8) & 0xff, high & 0xff, (low >> 8) & 0xff, low & 0xff]
}

/**
 * 이 IP 가 차단 대역인가. **판별할 수 없는 값은 차단**한다(fail closed).
 * IPv4-mapped IPv6(`::ffff:10.0.0.1`)·NAT64·IPv4 호환 표기는 풀어서 IPv4 표로 검사한다.
 */
export function isBlockedIp(ip: string): boolean {
  const bare = ip.trim().replace(/^\[|\]$/g, '').split('%')[0] ?? '' // 대괄호와 존 인덱스(%eth0) 제거
  const family = isIP(bare)
  if (family === 4) {
    const octets = parseIpv4(bare)
    if (octets === undefined) return true
    const value = toU32(octets)
    return BLOCKED_V4.some((r) => ((value & r.mask) >>> 0) === r.network)
  }
  if (family !== 6) return true // IP 가 아니다 — 부르는 쪽이 잘못 썼거나 알 수 없는 형식
  const groups = expandIpv6(bare)
  if (groups === undefined) return true
  const inner = embeddedIpv4(groups)
  if (inner !== undefined) {
    // IPv4 호환(::a.b.c.d)·미지정·루프백은 ::/96 이라 어차피 아래에서도 막히지만, 감싼 사설 주소를
    // 놓치지 않으려면 먼저 IPv4 표로 본다. 예: ::ffff:10.0.0.1 → 10.0.0.1(사설).
    if (BLOCKED_V4.some((r) => ((toU32(inner) & r.mask) >>> 0) === r.network)) return true
  }
  const first = groups[0] ?? 0
  if (groupsAreZero(groups, 6)) return true // ::/96 — 미지정·루프백·IPv4 호환
  if ((first & 0xfe00) === 0xfc00) return true // fc00::/7 ULA
  if ((first & 0xffc0) === 0xfe80) return true // fe80::/10 링크로컬
  if ((first & 0xff00) === 0xff00) return true // ff00::/8 멀티캐스트
  if (first === 0x2001 && groups[1] === 0x0db8) return true // 2001:db8::/32 문서용
  return false
}

// ---------- 정책 ----------

/** 자기 자신(데모 대상) 예외에서 "자기 서버" 로 인정하는 호스트. */
export const SELF_ORIGIN_HOSTS: readonly string[] = ['localhost', '127.0.0.1', '::1']
/**
 * 자기 자신 예외로 열어 주는 경로 목록 — 이 서버가 직접 주는 합성 레거시 데모 페이지뿐이다 (계약 §12).
 * 목록에 정확히 있는 경로만 연다. 접두사·와일드카드를 쓰지 않는다 (`/asis-sample/../admin` 같은 우회를 막는다).
 */
export const SELF_ORIGIN_PATHS: readonly string[] = ['/asis-sample', '/asis-sample-2']
/** PORT 가 없을 때의 기본 포트 (server.ts readConfig 와 같은 값). */
export const DEFAULT_SELF_PORT = 8787

export interface SsrfPolicy {
  /** `ASIS_ALLOW_PRIVATE` — 사설·루프백 등 차단 대역을 허용한다(사내망 분석). 기본 false. */
  allow_private: boolean
  /** `ASIS_ALLOWED_HOSTS` — IP 검사를 건너뛰는 호스트. `.example.com` 은 접미사(자기 자신 포함). */
  allowed_hosts: readonly string[]
  /** `ASIS_BLOCKED_HOSTS` — 언제나 차단. allow 보다 우선한다. */
  blocked_hosts: readonly string[]
  /**
   * 자기 자신(데모 대상) 예외. `/asis-sample*` 은 이 서버가 직접 주는 합성 데모 페이지라 루프백이다.
   * **호스트·포트가 자기 서버이고 경로가 목록에 정확히 있을 때만** 연다 — 임의의 localhost 경로
   * (내부 API·관리자 페이지)를 여는 것은 막는다. 포트까지 보는 이유: 포트를 보지 않으면 루프백의
   * 어떤 포트가 응답하는지(성공/실패 차이)로 포트 스캔을 할 수 있다.
   */
  self_origin_hosts: readonly string[]
  self_origin_port: number
  self_origin_paths: readonly string[]
}

function parseHostList(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((h) => normalizeHost(h))
    .filter((h) => h !== '')
}

/** 비교용 호스트 정규화: 소문자 + 대괄호 제거 + 끝점(`example.com.`) 제거. */
function normalizeHost(host: string): string {
  return host
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '')
}

const TRUE_VALUES = new Set(['1', 'true', 'yes'])

export function parsePolicy(env: NodeJS.ProcessEnv): SsrfPolicy {
  const port = Number.parseInt(env.PORT ?? '', 10)
  return {
    allow_private: TRUE_VALUES.has((env.ASIS_ALLOW_PRIVATE ?? '').trim().toLowerCase()),
    allowed_hosts: parseHostList(env.ASIS_ALLOWED_HOSTS),
    blocked_hosts: parseHostList(env.ASIS_BLOCKED_HOSTS),
    self_origin_hosts: SELF_ORIGIN_HOSTS,
    self_origin_port: Number.isFinite(port) && port > 0 ? port : DEFAULT_SELF_PORT,
    self_origin_paths: SELF_ORIGIN_PATHS,
  }
}

/** 목록 일치: 정확히 같거나, `.example.com` 형태 항목의 접미사(그 도메인 자신도 포함). */
export function hostMatches(host: string, patterns: readonly string[]): boolean {
  const target = normalizeHost(host)
  return patterns.some((pattern) => (pattern.startsWith('.') ? target === pattern.slice(1) || target.endsWith(pattern) : target === pattern))
}

// ---------- 판정 ----------

export type SsrfBlockCode = 'invalid_url' | 'scheme' | 'empty_host' | 'host_blocked' | 'dns_failed' | 'blocked_ip'

export type SsrfVerdict = { allowed: true; ips: string[] } | { allowed: false; code: SsrfBlockCode; reason: string }

/** 호스트 → IP 목록. 기본은 node:dns 의 lookup(A/AAAA 모두). 테스트·캐시에서 주입한다. */
export type SsrfResolve = (host: string) => Promise<string[]>

export const lookupResolve: SsrfResolve = async (host) => {
  const results = await lookup(host, { all: true })
  return results.map((r) => r.address)
}

/** 호스트 단위 캐시를 씌운 해석기 — 한 번의 분석에서 하위 리소스마다 DNS 를 다시 치지 않게 한다. */
export function cacheResolve(resolve: SsrfResolve): SsrfResolve {
  const cache = new Map<string, Promise<string[]>>()
  return (host) => {
    const key = normalizeHost(host)
    const hit = cache.get(key)
    if (hit !== undefined) return hit
    const pending = resolve(host)
    cache.set(key, pending)
    return pending
  }
}

/** 사설 대역을 열 수 있는 방법을 알려 주는 꼬리말 — 차단 사유에 붙인다. */
const HOW_TO_ALLOW = '사내망 대상을 분석해야 하면 ASIS_ALLOW_PRIVATE=1 로 열거나 ASIS_ALLOWED_HOSTS 에 그 호스트를 추가한다'

/** URL 의 실제 포트 (생략되면 스킴 기본값). */
function effectivePort(url: URL): number {
  if (url.port !== '') return Number.parseInt(url.port, 10)
  return url.protocol === 'https:' ? 443 : 80
}

/**
 * 이 URL 을 분석해도 되는가.
 * 순서: 형식 → 스킴 → 호스트 → **blocklist(항상 우선)** → 자기 자신 데모 예외 → allowlist → 사설 허용 → IP 검사.
 * 호스트가 IP 리터럴이면 그대로 검사하고, 이름이면 `resolve` 로 A/AAAA 를 모두 얻어 **하나라도 차단 대역이면 거부**한다.
 */
export async function checkUrl(url: string, policy: SsrfPolicy, resolve: SsrfResolve): Promise<SsrfVerdict> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { allowed: false, code: 'invalid_url', reason: `URL 로 읽을 수 없다: ${url}` }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { allowed: false, code: 'scheme', reason: `http/https 만 분석할 수 있다 (받은 스킴: ${parsed.protocol})` }
  }
  const host = normalizeHost(parsed.hostname)
  if (host === '') return { allowed: false, code: 'empty_host', reason: '호스트가 없는 URL 은 분석할 수 없다' }

  if (hostMatches(host, policy.blocked_hosts)) {
    return { allowed: false, code: 'host_blocked', reason: `차단 목록(ASIS_BLOCKED_HOSTS)에 있는 호스트다: ${host}` }
  }
  // 자기 자신(데모 대상) — 호스트·포트가 이 서버이고 경로가 허용 목록에 정확히 있을 때만.
  if (hostMatches(host, policy.self_origin_hosts) && effectivePort(parsed) === policy.self_origin_port && policy.self_origin_paths.includes(parsed.pathname)) {
    return { allowed: true, ips: [] }
  }
  if (hostMatches(host, policy.allowed_hosts)) return { allowed: true, ips: [] } // 사내 스테이징 허용 — IP 검사를 건너뛴다
  if (policy.allow_private) return { allowed: true, ips: [] } // 모든 대역을 허용하므로 해석할 이유가 없다

  if (isIP(host) !== 0) {
    if (isBlockedIp(host)) return { allowed: false, code: 'blocked_ip', reason: blockedIpReason(host, [host]) }
    return { allowed: true, ips: [host] }
  }

  let ips: string[]
  try {
    ips = await resolve(host)
  } catch (e) {
    return { allowed: false, code: 'dns_failed', reason: `호스트를 해석하지 못했다 (${host}): ${e instanceof Error ? e.message : String(e)}` }
  }
  if (ips.length === 0) return { allowed: false, code: 'dns_failed', reason: `호스트를 해석했지만 IP 가 없다: ${host}` }
  const blocked = ips.filter((ip) => isBlockedIp(ip))
  if (blocked.length > 0) return { allowed: false, code: 'blocked_ip', reason: blockedIpReason(host, blocked) }
  return { allowed: true, ips }
}

function blockedIpReason(host: string, ips: readonly string[]): string {
  const shown = ips.slice(0, 4).join(', ')
  const where = isIP(host) !== 0 ? `${host} 은(는)` : `${host} 이(가) 가리키는 ${shown} 은(는)`
  return `${where} 내부·예약 대역이라 분석 대상이 될 수 없다(사설·루프백·링크로컬 등). ${HOW_TO_ALLOW}.`
}
