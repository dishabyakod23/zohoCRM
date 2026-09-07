'use client';
import { useEffect, useState } from 'react';
import { avatarInitialClass } from '../../lib/tableStyles.js';
import { userDisplayName, userInitials, userProfileImageUrl } from '../../lib/userHelpers.js';

const SIZE_CLASSES = {
  xs: 'w-6 h-6 rounded-md text-[10px]',
  sm: 'w-7 h-7 rounded-lg text-[11px]',
  md: 'w-9 h-9 rounded-xl text-xs',
  lg: 'w-12 h-12 rounded-xl text-base',
  xl: 'w-16 h-16 rounded-2xl text-lg',
};

function initialSize(size) {
  if (size === 'xs' || size === 'sm') return 'sm';
  if (size === 'lg' || size === 'xl') return 'lg';
  return 'md';
}

function avatarKey(src) {
  if (!src) return 'none';
  if (src.startsWith('data:') || src.startsWith('blob:')) return `local-${src.length}-${src.slice(-24)}`;
  return src;
}

export default function UserAvatar({
  user,
  name,
  imageUrl,
  size = 'md',
  className = '',
  title,
}) {
  const resolvedName = name || userDisplayName(user);
  const src = imageUrl || userProfileImageUrl(user);
  const [broken, setBroken] = useState(false);
  const showImage = Boolean(src) && !broken;
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  // Re-try the image whenever the URL changes (e.g. after upload/replace).
  useEffect(() => {
    setBroken(false);
  }, [src]);

  if (showImage) {
    return (
      <img
        key={avatarKey(src)}
        src={src}
        alt={resolvedName ? `${resolvedName} profile` : 'User profile'}
        title={title || resolvedName || undefined}
        className={`${sizeClass} object-cover shrink-0 bg-neutral-100 ${className}`}
        onError={() => setBroken(true)}
      />
    );
  }

  return (
    <span
      title={title || resolvedName || undefined}
      className={`${avatarInitialClass(resolvedName, initialSize(size))} ${sizeClass} ${className}`}
    >
      {userInitials(resolvedName)}
    </span>
  );
}
