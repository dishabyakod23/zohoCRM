'use client';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthShell from '../../components/auth/AuthShell.js';
import PasswordInput from '../../components/forms/PasswordInput.js';
import { getApiError } from '../../lib/api.js';
import * as authApi from '../../lib/services/auth.js';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({ email: '', otp: '', new_password: '', confirm_password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const email = searchParams.get('email');
    if (email) setForm((prev) => ({ ...prev, email }));
  }, [searchParams]);

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const otp = form.otp.trim();
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    if (form.new_password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (form.new_password !== form.confirm_password) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const message = await authApi.resetPassword({
        email: form.email.trim(),
        otp,
        new_password: form.new_password,
      });
      setSuccess(message);
      setTimeout(() => router.push('/login'), 2000);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Reset password"
      subtitle="Enter the 6-digit code from your email and choose a new password."
      footer={(
        <p className="mt-6 text-center text-sm text-gray-500">
          <Link
            href={form.email ? `/forgot-password?email=${encodeURIComponent(form.email)}` : '/forgot-password'}
            className="text-brand-600 hover:underline font-medium"
          >
            Resend code
          </Link>
          {' · '}
          <Link href="/login" className="text-brand-600 hover:underline font-medium">Back to sign in</Link>
        </p>
      )}
    >
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm animate-fadeIn">{error}</div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded-xl text-sm animate-fadeIn">
          {success} Redirecting to sign in…
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={form.email} onChange={set('email')} required autoComplete="email" />
        </div>
        <div>
          <label className="label">Reset code</label>
          <input
            className="input tracking-[0.35em] font-mono text-center"
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            value={form.otp}
            onChange={(e) => setForm((prev) => ({ ...prev, otp: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
            placeholder="000000"
            required
            autoComplete="one-time-code"
          />
          <p className="text-xs text-gray-400 mt-1">6-digit code from your email</p>
        </div>
        <div>
          <label className="label">New password</label>
          <PasswordInput
            value={form.new_password}
            onChange={set('new_password')}
            minLength={8}
            required
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="label">Confirm password</label>
          <PasswordInput
            value={form.confirm_password}
            onChange={set('confirm_password')}
            minLength={8}
            required
            autoComplete="new-password"
          />
        </div>
        <button type="submit" disabled={submitting || !!success} className="btn-primary w-full py-2.5 mt-2">
          {submitting ? 'Resetting…' : 'Reset password'}
        </button>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={(
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-10 h-10 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )}
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
