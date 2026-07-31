'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchUsers } from '../lib/services/lookups.js';
import { mergeStoredProfileImage, PROFILE_IMAGE_EVENT } from '../lib/profileImageHelpers.js';

const UserAvatarsContext = createContext({
  users: [],
  getUser: () => null,
  loading: false,
});

export function UserAvatarsProvider({ children }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchUsers();
      setUsers((list || []).map(mergeStoredProfileImage));
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
    const onProfileImageUpdated = () => loadUsers();
    window.addEventListener(PROFILE_IMAGE_EVENT, onProfileImageUpdated);
    return () => window.removeEventListener(PROFILE_IMAGE_EVENT, onProfileImageUpdated);
  }, [loadUsers]);

  const getUser = useCallback(
    (userId) => users.find((user) => String(user.id) === String(userId)) || null,
    [users],
  );

  const value = useMemo(() => ({ users, getUser, loading }), [users, getUser, loading]);

  return (
    <UserAvatarsContext.Provider value={value}>
      {children}
    </UserAvatarsContext.Provider>
  );
}

export function useUserAvatars() {
  return useContext(UserAvatarsContext);
}
