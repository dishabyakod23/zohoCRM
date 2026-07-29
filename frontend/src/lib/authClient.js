import axios from 'axios';
import { API_BASE_URL } from './api.js';
import { normalizeLoginEmail, normalizeLoginPassword } from './authHelpers.js';

const AUTH_TIMEOUT_MS = 60000;
const HEALTH_TIMEOUT_MS = 15000;
const MAX_LOGIN_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1200;

function apiOrigin() {
  return API_BASE_URL.replace(/\/api\/v1\/?$/, '');
}

function isRetryableAuthError(err) {
  if (!err) return false;
  if (err.code === 'ECONNABORTED' || String(err.message || '').includes('timeout')) return true;
  if (!err.response) return true;
  return false;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Ping API health — warms cold backends before login. */
export async function wakeAuthApi() {
  try {
    await axios.get(`${apiOrigin()}/health`, { timeout: HEALTH_TIMEOUT_MS });
    return true;
  } catch {
    return false;
  }
}

/** Login with wake-up + retries for cold/slow API responses. */
export async function postLogin(email, password) {
  await wakeAuthApi();

  let lastError;
  for (let attempt = 0; attempt < MAX_LOGIN_ATTEMPTS; attempt += 1) {
    try {
      return await axios.post(
        `${API_BASE_URL}/auth/login`,
        {
          email: normalizeLoginEmail(email),
          password: normalizeLoginPassword(password),
        },
        {
          timeout: AUTH_TIMEOUT_MS,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    } catch (err) {
      lastError = err;
      if (!isRetryableAuthError(err) || attempt >= MAX_LOGIN_ATTEMPTS - 1) throw err;
      await sleep(RETRY_BASE_DELAY_MS * (attempt + 1));
    }
  }
  throw lastError;
}
