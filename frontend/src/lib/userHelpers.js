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
