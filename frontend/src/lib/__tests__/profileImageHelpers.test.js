import {
  PROFILE_IMAGE_MAX_BYTES,
  PROFILE_IMAGE_STORAGE_KEY,
  clearLocalProfileImage,
  extractProfileImageUrl,
  getLocalProfileImage,
  mergeStoredProfileImage,
  resolveProfileImageUrl,
  saveLocalProfileImage,
  validateProfileImageFile,
} from '../profileImageHelpers.js';
import { userInitials } from '../userHelpers.js';

describe('userInitials', () => {
  it('returns two initials for multi-word names', () => {
    expect(userInitials('Vishwanath K')).toBe('VK');
  });

  it('returns one initial for single-word names', () => {
    expect(userInitials('Narayana')).toBe('N');
    expect(userInitials('Abhaya')).toBe('A');
  });
});

describe('validateProfileImageFile', () => {
  it('rejects unsupported file types', () => {
    const file = { name: 'doc.pdf', type: 'application/pdf', size: 1000 };
    expect(validateProfileImageFile(file)).toBe('Only JPG, JPEG, PNG, or WEBP image files are allowed.');
  });

  it('rejects files larger than 2 MB', () => {
    const file = { name: 'photo.jpg', type: 'image/jpeg', size: PROFILE_IMAGE_MAX_BYTES + 1 };
    expect(validateProfileImageFile(file)).toBe('File size should not exceed 2 MB.');
  });

  it('accepts valid image files', () => {
    const file = { name: 'photo.png', type: 'image/png', size: 1024 };
    expect(validateProfileImageFile(file)).toBeNull();
  });

  it('requires a file', () => {
    expect(validateProfileImageFile(null)).toBe('Please select an image file.');
  });
});

describe('profile image storage helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores and retrieves a local profile image by user id', () => {
    saveLocalProfileImage('user-1', 'data:image/png;base64,abc');
    expect(getLocalProfileImage('user-1')).toBe('data:image/png;base64,abc');
    clearLocalProfileImage('user-1');
    expect(getLocalProfileImage('user-1')).toBeNull();
  });

  it('merges stored profile images into user objects', () => {
    saveLocalProfileImage('user-2', 'data:image/png;base64,xyz');
    const merged = mergeStoredProfileImage({ id: 'user-2', email: 'a@example.com' });
    expect(merged.profile_image_url).toBe('data:image/png;base64,xyz');
  });

  it('prefers API profile image URLs over local storage', () => {
    saveLocalProfileImage('user-3', 'data:image/png;base64,local');
    const merged = mergeStoredProfileImage({
      id: 'user-3',
      profile_image_url: '/uploads/avatar.png',
    });
    expect(merged.profile_image_url).toContain('/uploads/avatar.png');
    expect(JSON.parse(localStorage.getItem(PROFILE_IMAGE_STORAGE_KEY))['user-3'].url).toContain('/uploads/avatar.png');
  });
});

describe('resolveProfileImageUrl', () => {
  it('returns absolute and data URLs unchanged', () => {
    expect(resolveProfileImageUrl('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png');
    expect(resolveProfileImageUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
  });

  it('prefixes relative API paths with the API origin', () => {
    expect(resolveProfileImageUrl('/uploads/avatar.png')).toContain('/uploads/avatar.png');
  });
});

describe('extractProfileImageUrl', () => {
  it('reads supported profile image fields', () => {
    expect(extractProfileImageUrl({ avatar_url: '/avatars/1.png' })).toContain('/avatars/1.png');
    expect(extractProfileImageUrl({ profile_image: 'https://cdn.example.com/a.webp' })).toBe('https://cdn.example.com/a.webp');
  });
});
