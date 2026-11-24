'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth.js';
import { getApiError } from '../../lib/api.js';
import OrigamiLogo from '../../components/ui/OrigamiLogo.js';
import { FunnelIcon, DocumentTextIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import PasswordInput from '../../components/forms/PasswordInput.js';
import { safeNextPath, shouldSkipLoginNext } from '../../lib/safeRedirect.js';
import { normalizeLoginEmail, isInactiveUserError, INACTIVE_ACCOUNT_MESSAGE } from '../../lib/authHelpers.js';
import { useToast } from '../../components/ui/Toast.js';

const HIGHLIGHTS = [
  { icon: FunnelIcon, title: 'Every lead, one pipeline', text: 'Follow each lead from first contact to closed deal.' },
  { icon: DocumentTextIcon, title: 'Proposals that move', text: 'Won deals become accounts; lost ones are kept for later.' },
  { icon: ChartBarIcon, title: 'Targets you can see', text: 'Pipeline and revenue targets against real results.' },
];

/** Paper-fold shapes behind the brand panel (decoration only). */
function FoldPattern() {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <polygon points="380,0 600,0 600,220" fill="#FFFFFF" fillOpacity="0.07" />
      <polygon points="600,220 470,90 600,0" fill="#000000" fillOpacity="0.06" />
      <polygon points="0,560 0,800 240,800" fill="#FFFFFF" fillOpacity="0.06" />
      <polygon points="0,560 140,800 0,800" fill="#000000" fillOpacity="0.05" />
      <polygon points="520,520 600,440 600,600" fill="#FFFFFF" fillOpacity="0.05" />
    </svg>
  );
}

function getNextPath() {
  if (typeof window === 'undefined') return '/dashboard';
  if (shouldSkipLoginNext()) return '/dashboard';
  const next = new URLSearchParams(window.location.search).get('next');
  return safeNextPath(next);
}

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const { clearToasts } = useToast();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    clearToasts?.();
  }, [clearToasts]);

  useEffect(() => {
    if (!loading && user) router.replace(getNextPath());
  }, [user, loading, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(form.email, form.password);
      // Keep spinner until navigation leaves /login — do not clear submitting on success.
    } catch (err) {
      const message = getApiError(err) || 'Invalid email or password.';
      setError(isInactiveUserError(message) ? INACTIVE_ACCOUNT_MESSAGE : message);
      setSubmitting(false);
    }
  };

  // Avoid flashing the login form after a successful sign-in while router.replace is in flight.
  if (loading || submitting || user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4">
        <OrigamiLogo className="text-2xl" />
        <div className="w-8 h-8 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin" />
        {(submitting || user) && <p className="text-sm text-zoho-muted">Signing in…</p>}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-2">
      {/* Brand panel: full height on large screens, a short band on top on phones */}
      <aside className="relative overflow-hidden bg-brand-gradient text-white px-6 py-8 sm:px-10 lg:px-14 lg:py-12 flex flex-col">
        <FoldPattern />
        <div className="relative">
          <OrigamiLogo variant="light" className="text-2xl lg:text-3xl" />
        </div>

        <div className="relative mt-6 lg:mt-auto lg:mb-auto max-w-md">
          <h2 className="text-2xl lg:text-4xl font-bold leading-tight">Your whole sales pipeline, in one place.</h2>
          <p className="mt-3 text-sm lg:text-base text-white/85">
            Track leads, send proposals and hit your targets with Origami CRM.
          </p>
          <ul className="hidden lg:block mt-10 space-y-5">
            {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="w-10 h-10 shrink-0 rounded-xl bg-white/15 flex items-center justify-center">
                  <Icon className="w-5 h-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-semibold">{title}</span>
                  <span className="block text-sm text-white/80">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative hidden lg:block text-xs text-white/70">© {new Date().getFullYear()} Origami. All rights reserved.</p>
      </aside>

      {/* Sign-in form */}
      <main className="flex items-center justify-center px-6 py-10 sm:px-10 lg:min-h-screen">
        <div className="w-full max-w-sm animate-fadeIn">
          <h1 className="text-2xl font-bold text-black">Welcome back</h1>
          <p className="mt-1 mb-8 text-sm text-zoho-muted">Sign in to your Origami CRM account</p>

          {error && <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm animate-fadeIn">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="login-email">Email</label>
              <input id="login-email" className="input" type="email" value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                onBlur={e => setForm(p => ({ ...p, email: normalizeLoginEmail(e.target.value) }))}
                autoComplete="email"
                placeholder="you@company.com"
                required />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="label" htmlFor="login-password">Password</label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-brand-600 hover:text-brand-700 hover:underline font-medium"
                >
                  Forgot password?
                </Link>
              </div>
              <PasswordInput
                id="login-password"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                required
                autoComplete="current-password"
              />
            </div>
            <button type="submit" disabled={submitting} className="btn-primary w-full py-2.5 mt-2">
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-zoho-muted">
            Use the email and password from your Origami CRM account.
          </p>
        </div>
      </main>
    </div>
  );
}
