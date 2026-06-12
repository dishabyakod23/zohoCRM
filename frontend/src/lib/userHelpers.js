export function userDisplayName(user) {
  if (!user) return '';
  if (user.name) return user.name;
  const full = `${user.first_name || ''} ${user.last_name || ''}`.trim();
  return full || user.email || '';
}

export function userInitial(user) {
  const name = userDisplayName(user);
  return name?.[0]?.toUpperCase() || 'U';
}
