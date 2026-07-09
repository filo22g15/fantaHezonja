'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Login con password (utente già creato/invitato)
  async function onPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
    else {
      router.push('/');
      router.refresh();
    }
  }

  // Magic link via email (invito-only)
  async function onMagicLink() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: false,
      },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <main style={{ maxWidth: 380, margin: '15vh auto', padding: 24, fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>FantaHezonja Champions</h1>
      <p style={{ color: '#888', marginBottom: 24 }}>Accedi</p>

      {sent ? (
        <p>
          📧 Ti abbiamo inviato un link di accesso a <b>{email}</b>. Aprilo su questo
          dispositivo per entrare.
        </p>
      ) : (
        <form onSubmit={onPassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="email"
            required
            placeholder="tua@email.it"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: 10, borderRadius: 8, border: '1px solid #ccc' }}
          />
          <input
            type="password"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: 10, borderRadius: 8, border: '1px solid #ccc' }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{ padding: 10, borderRadius: 8, border: 0, background: '#c8102e', color: '#fff', cursor: 'pointer' }}
          >
            {loading ? 'Accesso…' : 'Accedi'}
          </button>
          <button
            type="button"
            onClick={onMagicLink}
            disabled={loading || !email}
            style={{ padding: 8, borderRadius: 8, border: '1px solid #ccc', background: 'transparent', cursor: 'pointer', fontSize: 13 }}
          >
            oppure inviami un link via email
          </button>
          {error && <p style={{ color: '#c8102e' }}>{error}</p>}
        </form>
      )}
    </main>
  );
}
