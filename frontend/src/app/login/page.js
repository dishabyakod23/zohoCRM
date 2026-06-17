'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth.js';
import { getApiError } from '../../lib/api.js';
import { setAuthSessionCookie } from '../../lib/authCookie.js';
import api from '../../lib/api.js';

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
      <div className="min-h-screen flex items-center justify-center bg-brand-gradient">
        <div className="w-10 h-10 border-[3px] border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-gradient flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-32 -right-16 w-[28rem] h-[28rem] bg-white/10 rounded-full blur-3xl" />

      <div className="relative bg-white/95 backdrop-blur rounded-2xl shadow-card-hover w-full max-w-md p-8 animate-scaleIn">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-9 h-9 bg-brand-gradient rounded-xl flex items-center justify-center text-white font-bold shadow-glow">C</div>
          <span className="text-xl font-bold text-gray-900">CRM</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h1>
        <p className="text-gray-500 text-sm mb-6">Sign in to your CRM account</p>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm animate-fadeIn">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required />
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

        <p className="mt-4 text-center text-xs text-gray-400">
          Sign in with your Sales CRM account credentials
        </p>
      </div>
    </div>
  );
}
