'use client';
import { useRef, useState } from 'react';
import UserAvatar from './UserAvatar.js';
import ConfirmDialog from '../ui/ConfirmDialog.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useToast } from '../ui/Toast.js';
import { getApiError } from '../../lib/api.js';
import { userDisplayName } from '../../lib/userHelpers.js';
import { PROFILE_IMAGE_ACCEPT } from '../../lib/profileImageHelpers.js';
import { deleteMyProfileImage, uploadMyProfileImage } from '../../lib/services/profileImage.js';

export default function ProfileImageManager({ roleLabel }) {
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const hasImage = Boolean(user?.profile_image_url);

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      showToast('Please select an image file.');
      return;
    }

    setUploading(true);
    try {
      const updated = await uploadMyProfileImage(file);
      updateUser(updated);
      showToast(hasImage ? 'Profile image updated successfully.' : 'Profile image uploaded successfully.', 'success');
    } catch (err) {
      showToast(err.message || getApiError(err));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const updated = await deleteMyProfileImage();
      updateUser(updated);
      setDeleteConfirm(false);
      showToast('Profile image deleted successfully.', 'success');
    } catch (err) {
      showToast(err.message || getApiError(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="card p-5">
        <h2 className="text-sm font-semibold mb-4">My Profile</h2>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <UserAvatar user={user} size="xl" />
            <dl className="min-w-0 text-sm space-y-2">
              <div>
                <dt className="text-zoho-muted text-xs">Name</dt>
                <dd className="font-medium truncate">{userDisplayName(user)}</dd>
              </div>
              <div>
                <dt className="text-zoho-muted text-xs">Email</dt>
                <dd className="truncate">{user?.email}</dd>
              </div>
              <div>
                <dt className="text-zoho-muted text-xs">Role</dt>
                <dd className="text-brand-600">{roleLabel}</dd>
              </div>
            </dl>
          </div>

          <div className="flex flex-wrap gap-2 sm:justify-end">
            <button
              type="button"
              onClick={openFilePicker}
              disabled={uploading || deleting}
              className="btn-secondary text-xs"
            >
              {uploading ? 'Uploading…' : hasImage ? 'Change Profile Image' : 'Upload Profile Image'}
            </button>
            {hasImage && (
              <button
                type="button"
                onClick={() => setDeleteConfirm(true)}
                disabled={uploading || deleting}
                className="btn-danger text-xs"
              >
                Delete Profile Image
              </button>
            )}
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={PROFILE_IMAGE_ACCEPT}
        className="hidden"
        onChange={handleFileChange}
      />

      <ConfirmDialog
        open={deleteConfirm}
        title="Delete profile image"
        message="Are you sure you want to delete your profile image?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        confirming={deleting}
        onConfirm={handleDelete}
        onCancel={() => !deleting && setDeleteConfirm(false)}
      />
    </>
  );
}
