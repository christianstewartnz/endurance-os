'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { signupAction } from '@/app/auth/actions'

const initialState = { error: null }

export default function SignupPage() {
  const [state, formAction, isPending] = useActionState(signupAction, initialState)

  return (
    <div style={styles.root}>
      <div style={styles.card}>
        <div style={styles.wordmark}>Endurance.OS</div>

        <h1 style={styles.heading}>Create account</h1>
        <p style={styles.subheading}>Start building your context brain.</p>

        <form action={formAction} style={styles.form}>
          <div style={styles.field}>
            <label htmlFor="email" style={styles.label}>
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              disabled={isPending}
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label htmlFor="password" style={styles.label}>
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              disabled={isPending}
              style={styles.input}
            />
            <span style={styles.hint}>Minimum 8 characters</span>
          </div>

          {state.error && (
            <p style={styles.error}>{state.error}</p>
          )}

          <button
            type="submit"
            disabled={isPending}
            style={{
              ...styles.button,
              opacity: isPending ? 0.6 : 1,
              cursor: isPending ? 'not-allowed' : 'pointer',
            }}
          >
            {isPending ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p style={styles.footer}>
          Already have an account?{' '}
          <Link href="/login" style={styles.link}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-0)',
    padding: '24px',
  },
  card: {
    width: '100%',
    maxWidth: '400px',
    background: 'var(--bg-1)',
    border: '1px solid var(--border)',
    padding: '48px 40px',
  },
  wordmark: {
    fontFamily: 'var(--font-mono)',
    fontSize: '13px',
    letterSpacing: '0.08em',
    color: 'var(--text-muted)',
    marginBottom: '40px',
    textTransform: 'uppercase',
  },
  heading: {
    fontSize: '22px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '6px',
    letterSpacing: '-0.02em',
  },
  subheading: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    marginBottom: '32px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '11px',
    fontWeight: 500,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--text-secondary)',
  },
  input: {
    width: '100%',
    background: 'var(--bg-2)',
    border: '1px solid var(--border-strong)',
    color: 'var(--text-primary)',
    padding: '10px 12px',
    fontSize: '14px',
    outline: 'none',
    borderRadius: '2px',
    transition: 'border-color 120ms ease',
  },
  hint: {
    fontSize: '11px',
    color: 'var(--text-muted)',
  },
  error: {
    fontSize: '13px',
    color: 'var(--danger)',
    marginTop: '-8px',
  },
  button: {
    width: '100%',
    background: 'var(--accent)',
    color: '#08090a',
    border: 'none',
    padding: '11px 16px',
    fontSize: '14px',
    fontWeight: 600,
    borderRadius: '2px',
    marginTop: '4px',
    letterSpacing: '-0.01em',
    transition: 'opacity 120ms ease',
  },
  footer: {
    marginTop: '28px',
    fontSize: '13px',
    color: 'var(--text-secondary)',
    textAlign: 'center',
  },
  link: {
    color: 'var(--text-primary)',
    textDecoration: 'underline',
    textUnderlineOffset: '3px',
    textDecorationColor: 'var(--border-strong)',
  },
}
