import { extractProfileImageUrl } from './profileImageHelpers.js';

export function userDisplayName(user) {
  if (!user) return '';
  if (user.name) return user.name;
  const full = `${user.first_name || ''} ${user.last_name || ''}`.trim();
  return full || user.email || '';
}

export function userInitials(userOrName) {
  const name = typeof userOrName === 'string' ? userOrName : userDisplayName(userOrName);
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'U';
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || 'U';
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
}

export function userInitial(user) {
  return userInitials(user);
}

export function userProfileImageUrl(user) {
  return extractProfileImageUrl(user);
}

const USER_CREATED_AT_CACHE_KEY = 'crm:userCreatedAtById';

function readUserCreatedAtCache() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(USER_CREATED_AT_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeUserCreatedAtCache(cache) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(USER_CREATED_AT_CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* ignore quota / private mode */
  }
}

/** Persist created_at across hard refresh when GET /admin/users omits it. */
export function rememberUserCreatedAt(user) {
  if (!user?.id) return;
  const created_at = user.created_at || user.createdAt || user.inserted_at;
  if (!created_at) return;
  const cache = readUserCreatedAtCache();
  const id = String(user.id);
  if (cache[id]) return;
  cache[id] = created_at;
  writeUserCreatedAtCache(cache);
}

function userCreatedAtFromSources(user, cache = readUserCreatedAtCache()) {
  return user?.created_at || user?.createdAt || user?.inserted_at || cache[String(user?.id)] || null;
}

function userCreatedAtMs(user) {
  const raw = userCreatedAtFromSources(user);
  const ms = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(ms) ? ms : 0;
}

function userSortKey(user) {
  const ms = userCreatedAtMs(user);
  if (ms) return ms;
  const idNum = Number(user?.id);
  if (Number.isFinite(idNum) && idNum > 0) return idNum;
  return 0;
}

/** Ensure a freshly created user has a timestamp for client-side sorting. */
export function enrichCreatedUser(user) {
  if (!user) return user;
  const created_at = userCreatedAtFromSources(user) || new Date().toISOString();
  const enriched = { ...user, created_at };
  rememberUserCreatedAt(enriched);
  return enriched;
}

/** Keep local created_at when the admin users API omits it after reload. */
export function mergeAdminUserLists(previous = [], incoming = []) {
  const previousById = new Map(previous.map((u) => [String(u.id), u]));
  const cache = readUserCreatedAtCache();
  const merged = incoming.map((u) => {
    const prev = previousById.get(String(u.id));
    const created_at = userCreatedAtFromSources(u, cache)
      || userCreatedAtFromSources(prev, cache);
    return created_at ? { ...u, created_at } : u;
  });
  return sortUsersNewestFirst(merged);
}

/** Newest users first so a just-created account appears at the top of Users & Roles. */
export function sortUsersNewestFirst(users = []) {
  return [...users].sort((a, b) => {
    const byDate = userSortKey(b) - userSortKey(a);
    if (byDate) return byDate;
    return String(b?.id || '').localeCompare(String(a?.id || ''));
  });
}
