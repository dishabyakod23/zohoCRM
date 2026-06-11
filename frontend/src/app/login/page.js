'use client';
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth.js';

export default function LoginPage() {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: 'disha@demo.com', password: 'demo1234' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await login(form.email, form.password);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-gradient flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-32 -right-16 w-[28rem] h-[28rem] bg-white/10 rounded-full blur-3xl" />

      <div className="relative bg-white/95 backdrop-blur rounded-2xl shadow-card-hover w-full max-w-md p-8 animate-scaleIn">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-9 h-9 bg-brand-gradient rounded-xl flex items-center justify-center text-white font-bold shadow-glow">Z</div>
          <span className="text-xl font-bold text-gray-900">Zoho CRM</span>
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
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 mt-2">
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-gray-400">
          Demo: disha@demo.com / demo1234
        </p>
      </div>
    </div>
  );
}
