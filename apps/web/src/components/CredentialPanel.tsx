/**
 * 자격 증명 패널 (정적 배포 전용) — 사용자가 자기 Claude API 키·토큰을 넣으면 이 브라우저가 직접 모델을 호출한다.
 *
 * - 값은 화면에 다시 표시하지 않는다. 저장 뒤에는 종류와 끝 4자리만 보여준다.
 * - 기본은 sessionStorage(탭을 닫으면 삭제), "이 브라우저에 저장" 을 켜면 localStorage.
 * - 브라우저에 쌓인 생성 결과(revision·코멘트·승인)를 지우는 버튼도 여기 둔다.
 */
import { useState } from 'react'
import { CREDENTIAL_KIND_LABELS, credentialStore, type CredentialInfo, type CredentialKind } from '../browser-run/credential.js'
import { releaseArtifactUrls } from '../browser-run/artifact-urls.js'
import { browserStore } from '../browser-run/store.js'
import { CREDENTIAL_EVENT } from '../hooks.js'
import { hrefTo } from '../router.js'
import { Badge } from './common.js'

export const CREDENTIAL_NOTICE = '토큰은 이 브라우저에만 저장되고 api.anthropic.com 으로만 전송됩니다. 이 페이지는 정적 파일이며 서버가 없습니다. 공용 PC 에서는 저장하지 마세요.'

/** 배지·안내 문구가 같이 갱신되도록 앱 전체에 알린다. */
function notifyChanged(onChanged: () => void): void {
  onChanged()
  try {
    window.dispatchEvent(new Event(CREDENTIAL_EVENT))
  } catch {
    /* 이벤트를 못 보내도 패널 자체는 갱신된다 */
  }
}

export function CredentialPanel({ onChanged }: { onChanged: () => void }) {
  const [info, setInfo] = useState<CredentialInfo | null>(() => credentialStore.describe())
  const [kind, setKind] = useState<CredentialKind>(() => credentialStore.describe()?.kind ?? 'token')
  const [value, setValue] = useState('')
  const [persist, setPersist] = useState<boolean>(() => credentialStore.describe()?.persist ?? false)
  const [open, setOpen] = useState<boolean>(() => credentialStore.describe() === null)
  const [error, setError] = useState<string | null>(null)
  const [storeError, setStoreError] = useState<string | null>(() => browserStore.lastError)

  const save = () => {
    setError(null)
    try {
      credentialStore.save(kind, value, persist)
      setValue('')
      setInfo(credentialStore.describe())
      setOpen(false)
      notifyChanged(onChanged)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const clear = () => {
    credentialStore.clear()
    setValue('')
    setInfo(null)
    setOpen(true)
    setError(null)
    notifyChanged(onChanged)
  }

  const resetStore = () => {
    browserStore.reset()
    releaseArtifactUrls()
    setStoreError(null)
    // 스냅샷 초기 상태로 되돌리려면 인메모리 상태를 다시 만들어야 한다.
    window.location.reload()
  }

  const bytes = browserStore.approximateBytes()
  return (
    <section className="cred-panel" data-testid="cred-panel" data-active={info !== null}>
      <div className="cred-head">
        <strong>내 Claude 자격 증명</strong>
        {info ? (
          <Badge tone="green" testId="cred-status">
            {CREDENTIAL_KIND_LABELS[info.kind]} ····{info.last4} · {info.persist ? '이 브라우저에 저장됨' : '이 탭에서만'}
          </Badge>
        ) : (
          <Badge tone="gray" testId="cred-status">
            없음 — 스냅샷 데모로 동작합니다
          </Badge>
        )}
        <button type="button" className="btn btn-small" data-testid="cred-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? '접기' : info ? '바꾸기' : '입력하기'}
        </button>
        {info && (
          <button type="button" className="btn btn-small" data-testid="cred-clear" onClick={clear}>
            삭제
          </button>
        )}
      </div>
      {open && (
        <div className="cred-body">
          <div className="cred-fields">
            <label className="inline">
              <input type="radio" name="cred-kind" data-testid="cred-kind-token" checked={kind === 'token'} onChange={() => setKind('token')} /> 토큰 (OAuth)
            </label>
            <label className="inline">
              <input type="radio" name="cred-kind" data-testid="cred-kind-api-key" checked={kind === 'api_key'} onChange={() => setKind('api_key')} /> API 키
            </label>
            <input
              type="password"
              className="cred-input"
              data-testid="cred-value"
              value={value}
              autoComplete="off"
              spellCheck={false}
              placeholder={kind === 'api_key' ? 'sk-ant-…' : 'OAuth 액세스 토큰'}
              aria-label="자격 증명 값"
              onChange={(e) => setValue(e.target.value)}
            />
            <label className="inline">
              <input type="checkbox" data-testid="cred-persist" checked={persist} onChange={(e) => setPersist(e.target.checked)} /> 이 브라우저에 저장
            </label>
            <button type="button" className="btn btn-primary btn-small" data-testid="cred-save" onClick={save} disabled={value.trim().length === 0}>
              저장
            </button>
          </div>
          {error && (
            <div className="error-box" role="alert" data-testid="cred-error">
              {error}
            </div>
          )}
          <p className="muted small cred-notice">
            {CREDENTIAL_NOTICE}{' '}
            <a data-testid="cred-key-help" href={hrefTo('main', { help: 'key' })}>
              Claude API 키 받는 법
            </a>
          </p>
        </div>
      )}
      {storeError && (
        <div className="notice notice-amber" data-testid="cred-store-error">
          {storeError}
        </div>
      )}
      {!browserStore.isEmpty() && (
        <div className="cred-foot muted small">
          이 브라우저에 저장된 생성 결과 약 {Math.round(bytes / 1024)}KB
          <button type="button" className="btn btn-small" data-testid="cred-reset-store" onClick={resetStore}>
            브라우저 저장 데이터 지우기
          </button>
        </div>
      )}
    </section>
  )
}
