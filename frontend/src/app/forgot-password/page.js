'use client';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthShell from '../../components/auth/AuthShell.js';
import { getApiError } from '../../lib/api.js';
import * as authApi from '../../lib/services/auth.js';

function ForgotPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const preset = searchParams.get('email');
    if (preset) setEmail(preset);
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      const message = await authApi.forgotPassword(email.trim());
      setSuccess(message);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const goToReset = () => {
    const params = new URLSearchParams({ email: email.trim() });
    router.push(`/reset-password?${params.toString()}`);
  };

  return (
    <AuthShell
      title="Forgot password"
      subtitle="Enter your email and we will send you a 6-digit reset code."
      footer={(
        <p className="mt-6 text-center text-sm text-gray-500">
          Remember your password?{' '}
          <Link href="/login" className="text-brand-600 hover:underline font-medium">Back to sign in</Link>
        </p>
      )}
    >
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm animate-fadeIn">{error}</div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded-xl text-sm animate-fadeIn">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Email</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
            autoComplete="email"
          />
        </div>
        <button type="submit" disabled={submitting} className="btn-primary w-full py-2.5 mt-2">
          {submitting ? 'Sending code…' : 'Send reset code'}
        </button>
      </form>

      {success && (
        <button type="button" onClick={goToReset} className="btn-secondary w-full py-2.5 mt-3">
          Enter reset code
        </button>
      )}
    </AuthShell>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={(
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-10 h-10 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )}
    >
      <ForgotPasswordForm />
    </Suspense>
  );
}
