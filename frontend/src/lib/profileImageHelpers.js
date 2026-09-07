import { API_BASE_URL } from './api.js';

export const PROFILE_IMAGE_EVENT = 'crm:profile-image-updated';
export const PROFILE_IMAGE_STORAGE_KEY = 'crm_profile_images';
export const PROFILE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const PROFILE_IMAGE_ACCEPT = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';
const PROFILE_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PROFILE_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);
const PROFILE_IMAGE_FIELDS = ['profile_image_url', 'avatar_url', 'profile_image'];
const LOCAL_AVATAR_MAX_PX = 256;
const LOCAL_AVATAR_QUALITY = 0.82;

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
  if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) {
    return url;
  }
  const origin = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
}

/** Never persist huge data-URL avatars inside crm_user (causes QuotaExceeded / app crash on replace). */
export function sanitizeUserForStorage(user) {
  if (!user || typeof user !== 'object') return user;
  const next = { ...user };
  delete next.__profileImageLocalOnly;
  const url = next.profile_image_url;
  if (typeof url === 'string' && (url.startsWith('data:') || url.startsWith('blob:'))) {
    delete next.profile_image_url;
  }
  return next;
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
  try {
    localStorage.setItem(PROFILE_IMAGE_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Quota exceeded — keep only forceLocal entries and retry once.
    const slim = {};
    for (const [id, entry] of Object.entries(store || {})) {
      if (entry?.forceLocal) slim[id] = entry;
    }
    try {
      localStorage.setItem(PROFILE_IMAGE_STORAGE_KEY, JSON.stringify(slim));
    } catch {
      throw new Error('Could not save the image in this browser (storage full). Try a smaller image, or ask admin to enable server upload.');
    }
  }
}

export function getLocalProfileImageEntry(userId) {
  if (!userId) return null;
  return readProfileImageStore()[String(userId)] || null;
}

export function getLocalProfileImage(userId) {
  return getLocalProfileImageEntry(userId)?.url || null;
}

export function saveLocalProfileImage(userId, url, { forceLocal = false } = {}) {
  if (!userId || !url) return;
  const store = readProfileImageStore();
  store[String(userId)] = {
    url,
    updatedAt: new Date().toISOString(),
    forceLocal: Boolean(forceLocal),
  };
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
  const local = getLocalProfileImageEntry(user.id);
  // Local override wins until a successful API upload clears forceLocal.
  if (local?.forceLocal && local.url) {
    return { ...user, profile_image_url: local.url };
  }

  const apiUrl = extractProfileImageUrl(user);
  if (apiUrl) {
    if (!String(apiUrl).startsWith('data:') && !String(apiUrl).startsWith('blob:')) {
      saveLocalProfileImage(user.id, apiUrl, { forceLocal: false });
    }
    return { ...user, profile_image_url: apiUrl };
  }
  if (local?.url) return { ...user, profile_image_url: local.url };
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

/** Shrink image for browser-local avatar cache (avoids quota crashes on replace). */
export async function compressImageForLocalAvatar(file) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to process the selected image.'));
      img.src = objectUrl;
    });
    const scale = Math.min(1, LOCAL_AVATAR_MAX_PX / Math.max(image.width || 1, image.height || 1));
    const width = Math.max(1, Math.round((image.width || 1) * scale));
    const height = Math.max(1, Math.round((image.height || 1) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return readFileAsDataUrl(file);
    ctx.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', LOCAL_AVATAR_QUALITY);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function notifyProfileImageUpdated(userId) {
  if (typeof window === 'undefined' || !userId) return;
  window.dispatchEvent(new CustomEvent(PROFILE_IMAGE_EVENT, { detail: { userId: String(userId) } }));
}
