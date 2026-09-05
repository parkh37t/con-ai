/**
 * 자격 증명 (정적 배포 전용) — 사용자가 자기 Claude API 키·토큰을 넣으면 이 브라우저가 직접 모델을 호출한다.
 *
 * - 상단 바에는 **칩 하나만** 둔다(`CredentialChip`). 칩을 누를 때만 입력 패널이 열린다 —
 *   기본 펼침이던 예전 패널이 본문을 아래로 170px 넘게 밀어냈기 때문이다.
 * - 값은 화면에 다시 표시하지 않는다. 저장 뒤에는 종류와 끝 4자리만 보여준다.
 * - 기본은 sessionStorage(탭을 닫으면 삭제), "이 브라우저에 저장" 을 켜면 localStorage.
 * - 브라우저에 쌓인 생성 결과(revision·코멘트·승인)를 지우는 버튼도 여기 둔다.
 */
import { useEffect, useMemo, useState } from 'react'
import { CREDENTIAL_KIND_LABELS, credentialStore, type CredentialInfo, type CredentialKind } from '../browser-run/credential.js'
import { releaseArtifactUrls } from '../browser-run/artifact-urls.js'
import { browserStore } from '../browser-run/store.js'
import { CREDENTIAL_EVENT, useCredentialTick } from '../hooks.js'
import { hrefTo } from '../router.js'

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

/** 칩 문구 — 저장돼 있으면 종류와 끝 4자리, 없으면 스냅샷 데모임을 밝힌다 (순수 함수). */
export function credentialChipLabel(info: CredentialInfo | null): string {
  return info === null ? '키 없음 — 스냅샷 데모' : `내 ${CREDENTIAL_KIND_LABELS[info.kind]} ····${info.last4}`
}

/** 상단 바 오른쪽의 자격 증명 칩. 누르면 입력 패널이 열린다. */
export function CredentialChip({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const tick = useCredentialTick()
  const info = useMemo(() => credentialStore.describe(), [tick])
  return (
    <button
      type="button"
      className={`chip chip-button ${info ? 'chip-green' : 'chip-quiet'}`}
      data-testid="cred-toggle"
      aria-expanded={open}
      onClick={onToggle}
      title={info ? `${CREDENTIAL_KIND_LABELS[info.kind]} 저장됨 (${info.persist ? '이 브라우저' : '이 탭에서만'}) — 누르면 바꾸거나 삭제합니다` : '이 브라우저에 Claude 자격 증명이 없어 저장된 스냅샷만 봅니다 — 누르면 입력합니다'}
    >
      <span data-testid="cred-status">{credentialChipLabel(info)}</span>
    </button>
  )
}

export function CredentialPanel({ open, onClose, onChanged }: { open: boolean; onClose: () => void; onChanged: () => void }) {
  const [info, setInfo] = useState<CredentialInfo | null>(() => credentialStore.describe())
  const [kind, setKind] = useState<CredentialKind>(() => credentialStore.describe()?.kind ?? 'token')
  const [value, setValue] = useState('')
  const [persist, setPersist] = useState<boolean>(() => credentialStore.describe()?.persist ?? false)
  const [error, setError] = useState<string | null>(null)
  const [storeError, setStoreError] = useState<string | null>(() => browserStore.lastError)

  // 패널을 닫을 때 입력값을 남기지 않는다 (다음에 열었을 때 이전 입력이 보이지 않게).
  useEffect(() => {
    if (!open) setValue('')
  }, [open])

  const save = () => {
    setError(null)
    try {
      credentialStore.save(kind, value, persist)
      setValue('')
      setInfo(credentialStore.describe())
      notifyChanged(onChanged)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const clear = () => {
    credentialStore.clear()
    setValue('')
    setInfo(null)
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
    /* 닫혀 있을 때는 hidden — DOM 에는 남기되 자리를 차지하지 않는다. */
    <section className="cred-panel" data-testid="cred-panel" data-active={info !== null} data-open={open} hidden={!open} aria-label="내 Claude 자격 증명">
      <div className="cred-head">
        <strong>내 Claude 자격 증명</strong>
        <span className="muted small">{info ? `${CREDENTIAL_KIND_LABELS[info.kind]} ····${info.last4} · ${info.persist ? '이 브라우저에 저장됨' : '이 탭에서만'}` : '아직 없습니다 — 저장된 스냅샷만 볼 수 있습니다'}</span>
        <span className="cred-head-right">
          {info && (
            <button type="button" className="btn btn-small" data-testid="cred-clear" onClick={clear}>
              삭제
            </button>
          )}
          <button type="button" className="btn btn-small" data-testid="cred-close" onClick={onClose}>
            닫기
          </button>
        </span>
      </div>
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
