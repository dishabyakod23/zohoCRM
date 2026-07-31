import api from '../api.js';
import { parseAuthUserResponse, readStoredAuthUser } from '../authHelpers.js';
import {
  clearLocalProfileImage,
  mergeStoredProfileImage,
  notifyProfileImageUpdated,
  readFileAsDataUrl,
  saveLocalProfileImage,
  validateProfileImageFile,
  verifyImageFile,
} from '../profileImageHelpers.js';
import { invalidateLookup } from '../lookupCache.js';

function shouldUseLocalFallback(err) {
  const status = err?.response?.status;
  return status === 404 || status === 405 || status === 501;
}

function unwrapUserResponse(data) {
  const user = parseAuthUserResponse(data);
  if (!user?.id) throw new Error('Invalid response from server.');
  return mergeStoredProfileImage(user);
}

function publishProfileImageChange(user) {
  if (!user?.id) return user;
  invalidateLookup('users');
  notifyProfileImageUpdated(user.id);
  return user;
}

export async function uploadMyProfileImage(file) {
  const validationError = validateProfileImageFile(file);
  if (validationError) throw new Error(validationError);
  await verifyImageFile(file);

  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post('/auth/me/profile-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const user = publishProfileImageChange(unwrapUserResponse(res.data));
    if (user.profile_image_url) saveLocalProfileImage(user.id, user.profile_image_url);
    return user;
  } catch (err) {
    if (!shouldUseLocalFallback(err)) throw err;
  }

  const current = readStoredAuthUser();
  if (!current?.id) throw new Error('You must be signed in to upload a profile image.');
  const dataUrl = await readFileAsDataUrl(file);
  saveLocalProfileImage(current.id, dataUrl);
  const user = publishProfileImageChange({ ...current, profile_image_url: dataUrl });
  return user;
}

export async function deleteMyProfileImage() {
  const current = readStoredAuthUser();

  try {
    const res = await api.delete('/auth/me/profile-image');
    const user = publishProfileImageChange(unwrapUserResponse(res.data));
    if (user?.id) clearLocalProfileImage(user.id);
    return { ...user, profile_image_url: null };
  } catch (err) {
    if (!shouldUseLocalFallback(err)) throw err;
  }

  if (!current?.id) throw new Error('You must be signed in to delete your profile image.');
  clearLocalProfileImage(current.id);
  publishProfileImageChange(current);
  return { ...current, profile_image_url: null };
}

export async function uploadUserProfileImage(userId, file) {
  const validationError = validateProfileImageFile(file);
  if (validationError) throw new Error(validationError);
  await verifyImageFile(file);

  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post(`/admin/users/${userId}/profile-image`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  const user = publishProfileImageChange(unwrapUserResponse(res.data));
  if (user.profile_image_url) saveLocalProfileImage(user.id, user.profile_image_url);
  return user;
}

export async function deleteUserProfileImage(userId) {
  const res = await api.delete(`/admin/users/${userId}/profile-image`);
  const user = publishProfileImageChange(unwrapUserResponse(res.data));
  clearLocalProfileImage(userId);
  return { ...user, profile_image_url: null };
}
