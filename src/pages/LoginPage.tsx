// ============================================================
// LoginPage — Full-screen login with TT branding
// ============================================================

import { useState, type FormEvent } from 'react';
import TTWordmark from '../components/TTWordmark';

interface LoginPageProps {
  onLogin: (username: string, password: string) => Promise<void>;
  error: string | null;
}

export default function LoginPage({ onLogin, error }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    try {
      await onLogin(username.trim(), password);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.logoRow}>
          <TTWordmark height={22} />
        </div>
        <div style={styles.eyebrow}>Causal Loop Dynamics</div>
        <h1 style={styles.heading}>Sign in</h1>
        <p style={styles.subtitle}>
          Enter your credentials to access the system.
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label} htmlFor="login-username">
              Username
            </label>
            <input
              id="login-username"
              style={styles.input}
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your username"
              autoComplete="username"
              autoFocus
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label} htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              style={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div style={styles.error}>
              {error}
            </div>
          )}

          <button
            style={{
              ...styles.button,
              ...(loading || !username.trim() || !password ? styles.buttonDisabled : {}),
            }}
            type="submit"
            disabled={loading || !username.trim() || !password}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    background: 'linear-gradient(180deg, rgba(22,23,23,0.85), rgba(19,20,20,0.85))',
    backdropFilter: 'blur(20px) saturate(160%)',
    WebkitBackdropFilter: 'blur(20px) saturate(160%)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 'var(--radius-lg)',
    padding: '40px 36px',
    boxShadow: '0 8px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(111, 212, 160, 0.06)',
  },
  logoRow: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 20,
  },
  eyebrow: {
    fontFamily: 'var(--mono)',
    fontSize: 10,
    letterSpacing: '0.2em',
    textTransform: 'uppercase' as const,
    color: 'var(--accent)',
    textAlign: 'center' as const,
    marginBottom: 8,
  },
  heading: {
    fontFamily: 'var(--serif)',
    fontWeight: 400,
    fontSize: 34,
    lineHeight: 1.12,
    color: 'var(--text-primary)',
    textShadow: 'var(--glow)',
    margin: 0,
    textAlign: 'center' as const,
  },
  subtitle: {
    fontSize: 13,
    color: 'var(--n700)',
    textAlign: 'center' as const,
    margin: '8px 0 28px',
    lineHeight: 1.5,
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 18,
  },
  field: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
  },
  label: {
    fontFamily: 'var(--mono)',
    fontSize: 10,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: 'var(--n800)',
  },
  input: {
    padding: '10px 14px',
    background: 'var(--n100)',
    border: '1px solid var(--n300)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-body)',
    fontFamily: 'var(--sans)',
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
  },
  error: {
    background: 'var(--r100)',
    border: '1px solid var(--r300)',
    borderRadius: 'var(--radius-sm)',
    padding: '10px 14px',
    color: 'var(--r600)',
    fontFamily: 'var(--mono)',
    fontSize: 12,
    lineHeight: 1.4,
  },
  button: {
    padding: '12px 20px',
    background: 'var(--accent)',
    color: 'var(--n100)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--sans)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'filter 0.15s ease, transform 0.15s ease',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
};