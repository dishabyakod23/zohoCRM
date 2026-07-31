import { API_BASE_URL } from './api.js';

export const PROFILE_IMAGE_EVENT = 'crm:profile-image-updated';
export const PROFILE_IMAGE_STORAGE_KEY = 'crm_profile_images';
export const PROFILE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const PROFILE_IMAGE_ACCEPT = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';
const PROFILE_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PROFILE_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);
const PROFILE_IMAGE_FIELDS = ['profile_image_url', 'avatar_url', 'profile_image'];

export function extractProfileImageUrl(user) {
  if (!user) return null;
  for (const field of PROFILE_IMAGE_FIELDS) {
    const value = user[field];
    if (typeof value === 'string' && value.trim()) {
      return resolveProfileImageUrl(value.trim());
    }
  }
  return null;
}

export function resolveProfileImageUrl(url) {
  if (!url) return null;
  if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const origin = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
}

function readProfileImageStore() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(PROFILE_IMAGE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeProfileImageStore(store) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PROFILE_IMAGE_STORAGE_KEY, JSON.stringify(store));
}

export function getLocalProfileImage(userId) {
  if (!userId) return null;
  const entry = readProfileImageStore()[String(userId)];
  return entry?.url || null;
}

export function saveLocalProfileImage(userId, url) {
  if (!userId || !url) return;
  const store = readProfileImageStore();
  store[String(userId)] = { url, updatedAt: new Date().toISOString() };
  writeProfileImageStore(store);
}

export function clearLocalProfileImage(userId) {
  if (!userId) return;
  const store = readProfileImageStore();
  delete store[String(userId)];
  writeProfileImageStore(store);
}

export function mergeStoredProfileImage(user) {
  if (!user?.id) return user;
  const apiUrl = extractProfileImageUrl(user);
  if (apiUrl) {
    saveLocalProfileImage(user.id, apiUrl);
    return { ...user, profile_image_url: apiUrl };
  }
  const localUrl = getLocalProfileImage(user.id);
  if (localUrl) return { ...user, profile_image_url: localUrl };
  return user;
}

export function validateProfileImageFile(file) {
  if (!file) return 'Please select an image file.';
  const extension = String(file.name || '').split('.').pop()?.toLowerCase() || '';
  const mime = String(file.type || '').toLowerCase();
  const mimeOk = PROFILE_IMAGE_MIME_TYPES.has(mime);
  const extOk = PROFILE_IMAGE_EXTENSIONS.has(extension);
  if (!mimeOk && !extOk) {
    return 'Only JPG, JPEG, PNG, or WEBP image files are allowed.';
  }
  if (file.size > PROFILE_IMAGE_MAX_BYTES) {
    return 'File size should not exceed 2 MB.';
  }
  return null;
}

export function verifyImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('The selected image file appears to be corrupted.'));
    };
    image.src = url;
  });
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read the selected image.'));
    reader.readAsDataURL(file);
  });
}

export function notifyProfileImageUpdated(userId) {
  if (typeof window === 'undefined' || !userId) return;
  window.dispatchEvent(new CustomEvent(PROFILE_IMAGE_EVENT, { detail: { userId: String(userId) } }));
}
