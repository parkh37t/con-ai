/**
 * React 훅 — 해시 라우트, 비동기 로딩, 작업 폴링(2초). 순수 로직은 router.ts / job-progress.ts 에 있다.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api.js'
import { isTerminalJob } from './job-progress.js'
import { parseRoute, type Route } from './router.js'
import type { Job } from './types.js'

export const JOB_POLL_INTERVAL_MS = 2000

function readHash(): string {
  return typeof window === 'undefined' ? '' : window.location.hash
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(readHash()))
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(readHash()))
    window.addEventListener('hashchange', onChange)
    window.addEventListener('con-ai:navigate', onChange)
    return () => {
      window.removeEventListener('hashchange', onChange)
      window.removeEventListener('con-ai:navigate', onChange)
    }
  }, [])
  return route
}

/** 해시 이동. replace 면 history 를 쌓지 않는다 (작업 id 를 URL 에 붙일 때). */
export function navigate(hash: string, opts: { replace?: boolean } = {}): void {
  if (opts.replace) {
    window.history.replaceState(null, '', hash)
    window.dispatchEvent(new Event('con-ai:navigate'))
  } else {
    window.location.hash = hash
  }
}

export interface AsyncState<T> {
  data: T | null
  error: unknown
  loading: boolean
  reload: () => void
}

/** 의존값이 바뀌면 다시 불러온다. 늦게 도착한 이전 요청의 결과는 버린다. */
export function useAsync<T>(fn: () => Promise<T> | null, deps: readonly unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(false)
  const [tick, setTick] = useState(0)
  const seq = useRef(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    const p = fn()
    if (p === null) {
      setData(null)
      setError(null)
      setLoading(false)
      return
    }
    const my = ++seq.current
    setLoading(true)
    setError(null)
    p.then(
      (v) => {
        if (seq.current !== my) return
        setData(v)
        setLoading(false)
      },
      (e: unknown) => {
        if (seq.current !== my) return
        setError(e)
        setData(null)
        setLoading(false)
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  return { data, error, loading, reload }
}

export interface JobPollState {
  job: Job | null
  error: unknown
  polling: boolean
}

/** 작업 상태를 2초마다 읽는다. 종료 상태가 되면 멈춘다. jobId 가 null 이면 아무것도 하지 않는다. */
export function useJobPolling(jobId: string | null, onTerminal?: (job: Job) => void): JobPollState {
  const [job, setJob] = useState<Job | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [polling, setPolling] = useState(false)
  const onTerminalRef = useRef(onTerminal)
  onTerminalRef.current = onTerminal

  useEffect(() => {
    setJob(null)
    setError(null)
    if (!jobId) {
      setPolling(false)
      return
    }
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    setPolling(true)
    const tick = async () => {
      try {
        const j = await api.job(jobId)
        if (cancelled) return
        setJob(j)
        setError(null)
        if (isTerminalJob(j.status)) {
          setPolling(false)
          onTerminalRef.current?.(j)
          return
        }
      } catch (e) {
        if (cancelled) return
        setError(e)
        // 404 등 영구 오류도 폴링은 계속하지 않고 멈춘다; 일시 오류는 다음 주기에 다시 시도한다.
        if (e instanceof Error && 'status' in e && (e as { status: number }).status === 404) {
          setPolling(false)
          return
        }
      }
      timer = setTimeout(tick, JOB_POLL_INTERVAL_MS)
    }
    void tick()
    return () => {
      cancelled = true
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [jobId])

  return { job, error, polling }
}

/** localStorage 의 작은 편의값 (작성자 이름 등). 실패해도 화면은 동작한다. */
export function useStoredValue(key: string, initial: string): [string, (v: string) => void] {
  const [value, setValue] = useState<string>(() => {
    try {
      return window.localStorage.getItem(key) ?? initial
    } catch {
      return initial
    }
  })
  const set = useCallback(
    (v: string) => {
      setValue(v)
      try {
        window.localStorage.setItem(key, v)
      } catch {
        /* 저장 실패는 무시 */
      }
    },
    [key],
  )
  return [value, set]
}
