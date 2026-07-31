'use client';
import UserAvatar from './UserAvatar.js';
import { useUserAvatars } from '../../hooks/useUserAvatars.js';

export default function UserAvatarById({ userId, name, size = 'sm', className = '' }) {
  const { getUser } = useUserAvatars();
  const user = userId ? getUser(userId) : null;
  return <UserAvatar user={user} name={name} size={size} className={className} />;
}
