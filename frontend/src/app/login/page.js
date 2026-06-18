'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth.js';
import { getApiError } from '../../lib/api.js';
import { setAuthSessionCookie } from '../../lib/authCookie.js';
import api from '../../lib/api.js';
import Logo from '../../components/ui/Logo.js';
import PasswordInput from '../../components/forms/PasswordInput.js';

function getNextPath() {
  if (typeof window === 'undefined') return '/dashboard';
  const next = new URLSearchParams(window.location.search).get('next');
  return next?.startsWith('/') ? next : '/dashboard';
}

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    const nextPath = getNextPath();
    const token = localStorage.getItem('crm_token');
    const storedUser = localStorage.getItem('crm_user');
    if (!token || !storedUser) {
      setRestoring(false);
      return;
    }
    setAuthSessionCookie();
    api.get('/auth/me')
      .then((r) => {
        localStorage.setItem('crm_user', JSON.stringify(r.data));
        setAuthSessionCookie();
        router.replace(nextPath);
      })
      .catch(() => {
        localStorage.removeItem('crm_token');
        localStorage.removeItem('crm_refresh_token');
        localStorage.removeItem('crm_user');
        setRestoring(false);
      });
  }, [router]);

  useEffect(() => {
    if (!loading && user) router.replace(getNextPath());
  }, [user, loading, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSubmitting(true);
    try {
      await login(form.email, form.password);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || user || restoring) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-10 h-10 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-32 -right-16 w-[28rem] h-[28rem] bg-brand-500/5 rounded-full blur-3xl" />

      <div className="relative bg-white rounded-2xl shadow-card-hover w-full max-w-md p-8 animate-scaleIn border border-zoho-border">
        <div className="flex items-center gap-3 mb-6">
          <Logo size="md" />
          <div>
            <h1 className="text-2xl font-bold text-black mb-1">Welcome back</h1>
            <p className="text-zoho-muted text-sm">Sign in to your CRM account</p>
          </div>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm animate-fadeIn">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Password</label>
            <PasswordInput
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              required
              autoComplete="current-password"
            />
            <div className="mt-2 flex justify-end">
              <Link
                href="/forgot-password"
                className="text-sm text-brand-600 hover:text-brand-700 hover:underline font-medium"
              >
                Forgot password?
              </Link>
            </div>
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full py-2.5 mt-2">
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-zoho-muted">
          Sign in with your Sales CRM account credentials
        </p>
      </div>
    </div>
  );
}
