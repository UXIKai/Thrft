import { useEffect, useState } from 'react'
import {
  signInWithPassword,
  signUpWithPassword,
  signInWithOAuthProvider,
} from '../auth.js'
import './GlassOverlay.css'
import './AuthScreen.css'

function GoogleLogo() {
  return (
    <svg className="auth-logo" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.6h5.1c-.2 1.2-.9 2.3-1.9 3l3.1 2.4c1.8-1.7 2.9-4.2 2.9-7.2 0-.7-.1-1.3-.2-1.8H12z"
      />
      <path
        fill="#34A853"
        d="M6.6 14.3 5.8 14.9l-2.7 2.1C4.7 20.1 8.1 22 12 22c2.7 0 5-.9 6.7-2.4l-3.1-2.4c-.9.6-2 1-3.6 1-2.8 0-5.1-1.8-6-4.3z"
      />
      <path
        fill="#FBBC05"
        d="M3.1 7.1C2.4 8.5 2 10.2 2 12s.4 3.5 1.1 4.9l3.5-2.7c-.3-.7-.4-1.4-.4-2.2s.2-1.5.4-2.2L3.1 7.1z"
      />
      <path
        fill="#4285F4"
        d="M12 5.8c1.5 0 2.8.5 3.8 1.5l2.8-2.8C16.9 2.7 14.7 2 12 2 8.1 2 4.7 3.9 3.1 7.1l3.5 2.7C7 7.6 9.3 5.8 12 5.8z"
      />
    </svg>
  )
}

function AppleLogo() {
  return (
    <svg className="auth-logo" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M16.7 12.6c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3.1-1.6-1.3-.1-2.5.8-3.2.8-.7 0-1.7-.7-2.8-.7-1.4 0-2.8.9-3.5 2.2-1.5 2.6-.4 6.5 1.1 8.6.7 1 1.6 2.1 2.7 2.1 1.1 0 1.5-.7 2.8-.7s1.7.7 2.8.7c1.2 0 1.9-1 2.6-2 .8-1.2 1.2-2.3 1.2-2.4-.1 0-2.3-.9-2.4-3.8zM14.7 6.3c.6-.7 1-1.7.9-2.7-0.9.1-1.9.6-2.5 1.3-.6.6-1.1 1.6-1 2.6 1 .1 1.9-.5 2.6-1.2z"
      />
    </svg>
  )
}

function BackIcon() {
  return (
    <svg className="auth-back-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 5.5 8.5 12 15 18.5"
      />
    </svg>
  )
}

/**
 * Sign in / Sign up — Supabase Auth (signInWithPassword / signUp).
 */
export default function AuthScreen({
  mode = 'login',
  onEnter,
  onBack,
  onSwitchMode,
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const isSignup = mode === 'signup'
  const ctaLabel = isSignup ? 'Sign up' : 'Sign in'
  const title = ctaLabel

  // Fresh email/password every time the screen or mode opens — no sticky identity.
  useEffect(() => {
    setEmail('')
    setPassword('')
    setError('')
    setBusy(false)
  }, [mode])

  async function finish(result) {
    if (result?.redirecting) return
    await onEnter?.(result)
  }

  async function submitEmail(event) {
    event?.preventDefault?.()
    if (busy) return
    setError('')
    const cleanEmail = email.trim()
    if (!cleanEmail.includes('@')) {
      setError('Enter a valid email')
      return
    }
    if (!password || password.length < 6) {
      setError('Enter your password')
      return
    }
    setBusy(true)
    try {
      const result = isSignup
        ? await signUpWithPassword({ email: cleanEmail, password })
        : await signInWithPassword({ email: cleanEmail, password })
      await finish(result)
    } catch (err) {
      setError(err?.message || 'Could not sign in')
    } finally {
      setBusy(false)
    }
  }

  async function submitOAuth(provider) {
    if (busy) return
    setError('')
    setBusy(true)
    try {
      const result = await signInWithOAuthProvider(provider)
      await finish(result)
    } catch (err) {
      const msg = String(err?.message || '')
      if (/cancelled/i.test(msg) && !/blocked/i.test(msg)) return
      setError(msg || 'Unavailable')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="auth-screen"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <header className={`auth-top${onBack ? '' : ' is-brand-only'}`}>
        {onBack ? (
          <button
            type="button"
            className="auth-back"
            aria-label="Back"
            onClick={onBack}
            disabled={busy}
          >
            <BackIcon />
          </button>
        ) : (
          <span className="auth-top-spacer" aria-hidden />
        )}
        <h1 className="auth-brand">
          Thrft<span aria-hidden>●</span>
        </h1>
        <span className="auth-top-spacer" aria-hidden />
      </header>

      <form className="auth-body" onSubmit={submitEmail} noValidate>
        <label className="auth-field">
          <span className="auth-field-label">Email</span>
          <input
            className="auth-field-input"
            type="email"
            name="email"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            inputMode="email"
            value={email}
            disabled={busy}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="Email"
            required
          />
        </label>

        <label className="auth-field">
          <span className="auth-field-label">Password</span>
          <input
            className="auth-field-input"
            type="password"
            name="password"
            autoComplete="new-password"
            value={password}
            disabled={busy}
            onChange={(e) => setPassword(e.target.value)}
            aria-label="Password"
            required
            minLength={6}
          />
        </label>

        <button type="submit" className="auth-cta" disabled={busy}>
          {busy ? '…' : ctaLabel}
        </button>

        <div className="auth-social" role="group" aria-label="Continue with">
          <button
            type="button"
            className="auth-social-btn"
            aria-label="Continue with Apple"
            disabled={busy}
            onClick={() => submitOAuth('apple')}
          >
            <AppleLogo />
          </button>
          <button
            type="button"
            className="auth-social-btn"
            aria-label="Continue with Google"
            disabled={busy}
            onClick={() => submitOAuth('google')}
          >
            <GoogleLogo />
          </button>
        </div>

        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}

        {onSwitchMode && (
          <button
            type="button"
            className="auth-switch-link"
            disabled={busy}
            onClick={onSwitchMode}
          >
            {isSignup ? 'Sign in' : 'Sign up'}
          </button>
        )}
      </form>
    </div>
  )
}

/**
 * Add Account chooser — Thrft at top, Sign in / Sign up actions.
 */
export function AddAccountChooser({ onPick, onBack }) {
  return (
    <div
      className="auth-screen auth-chooser"
      role="dialog"
      aria-modal="true"
      aria-label="Add Account"
    >
      <header className="auth-top">
        <button
          type="button"
          className="auth-back"
          aria-label="Back"
          onClick={onBack}
        >
          <BackIcon />
        </button>
        <h1 className="auth-brand">
          Thrft<span aria-hidden>●</span>
        </h1>
        <span className="auth-top-spacer" aria-hidden />
      </header>

      <div className="auth-body">
        <div className="auth-choice" role="group" aria-label="Account actions">
          <button
            type="button"
            className="auth-choice-btn"
            onClick={() => onPick?.('login')}
          >
            Sign in
          </button>
          <button
            type="button"
            className="auth-choice-btn"
            onClick={() => onPick?.('signup')}
          >
            Sign up
          </button>
        </div>
      </div>
    </div>
  )
}
