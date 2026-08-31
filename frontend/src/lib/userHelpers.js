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

function userCreatedAtMs(user) {
  const raw = user?.created_at || user?.createdAt || user?.inserted_at;
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
  const created_at = user.created_at || user.createdAt || user.inserted_at || new Date().toISOString();
  return { ...user, created_at };
}

/** Keep local created_at when the admin users API omits it after reload. */
export function mergeAdminUserLists(previous = [], incoming = []) {
  const previousById = new Map(previous.map((u) => [String(u.id), u]));
  const merged = incoming.map((u) => {
    const prev = previousById.get(String(u.id));
    const created_at = u.created_at || u.createdAt || u.inserted_at
      || prev?.created_at || prev?.createdAt || prev?.inserted_at;
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
