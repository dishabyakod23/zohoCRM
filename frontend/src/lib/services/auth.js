import api from '../api.js';

/** POST /auth/forgot-password — sends a 6-digit OTP to the user's email */
export async function forgotPassword(email) {
  const res = await api.post('/auth/forgot-password', { email });
  return res.data?.data?.message || res.data?.message || 'If an account exists, a reset code has been sent.';
}

/** POST /auth/reset-password — verify OTP and set a new password */
export async function resetPassword({ email, otp, new_password }) {
  const res = await api.post('/auth/reset-password', { email, otp, new_password });
  return res.data?.data?.message || res.data?.message || 'Password reset successfully.';
}
