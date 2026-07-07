'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import CRMLayout from '../../components/layout/CRMLayout.js';
import Modal from '../../components/ui/Modal.js';
import FormField, { inputClass } from '../../components/forms/FormField.js';
import PasswordInput from '../../components/forms/PasswordInput.js';
import { useAuth } from '../../hooks/useAuth.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useToast } from '../../components/ui/Toast.js';
import { getApiError } from '../../lib/api.js';
import { userDisplayName } from '../../lib/userHelpers.js';
import { USER_ROLES, ROLE_LABELS, ROLE_ACCESS, roleLabel } from '../../lib/roles.js';
import * as adminApi from '../../lib/services/admin.js';
import { triggerWeeklyReport } from '../../lib/services/reports.js';
import * as authApi from '../../lib/services/auth.js';
import AnnouncementsPanel from '../../components/admin/AnnouncementsPanel.js';
import { slugifyStatusValue } from '../../lib/statusHelpers.js';

const EMPTY_USER = {
  email: '',
  password: '',
  first_name: '',
  last_name: '',
  role: 'sales_rep',
};

const TABS = [
  { id: 'profile', label: 'My Profile' },
  { id: 'users', label: 'Users & Roles', adminOnly: true },
  { id: 'statuses', label: 'Lead Statuses', adminOnly: true },
  { id: 'company', label: 'Company Settings', adminOnly: true },
  { id: 'announcements', label: 'Announcements', adminOnly: true },
];

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { canManageUsers, canManageSettings, roleAccess, roleLabel: myRoleLabel } = usePermissions();
  const { showToast } = useToast();

  const [tab, setTab] = useState('profile');
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userModal, setUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState(EMPTY_USER);
  const [userErrors, setUserErrors] = useState({});
  const [savingUser, setSavingUser] = useState(false);

  const [appSettings, setAppSettings] = useState({ company_name: '', timezone: 'UTC' });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const [leadStatuses, setLeadStatuses] = useState([]);
  const [statusesLoading, setStatusesLoading] = useState(false);
  const [statusLabel, setStatusLabel] = useState('');
  const [statusValue, setStatusValue] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [deletingStatus, setDeletingStatus] = useState('');
  const [editingStatus, setEditingStatus] = useState(null);
  const [editingStatusLabel, setEditingStatusLabel] = useState('');
  const [editingStatusSaving, setEditingStatusSaving] = useState(false);

  const [passwordForm, setPasswordForm] = useState({ otp: '', new_password: '', confirm_password: '' });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  const visibleTabs = TABS.filter(t => !t.adminOnly || canManageUsers);

  const loadUsers = useCallback(async () => {
    if (!canManageUsers) return;
    setUsersLoading(true);
    try {
      setUsers(await adminApi.listAdminUsers());
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setUsersLoading(false);
    }
  }, [canManageUsers, showToast]);

  const loadSettings = useCallback(async () => {
    if (!canManageSettings) return;
    setSettingsLoading(true);
    try {
      const data = await adminApi.getAdminSettings();
      setAppSettings(data || { company_name: '', timezone: 'UTC' });
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSettingsLoading(false);
    }
  }, [canManageSettings, showToast]);

  const loadLeadStatuses = useCallback(async () => {
    if (!canManageSettings) return;
    setStatusesLoading(true);
    try {
      setLeadStatuses(await adminApi.listAdminLeadStatuses());
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setStatusesLoading(false);
    }
  }, [canManageSettings, showToast]);

  useEffect(() => {
    if (tab === 'users') loadUsers();
    if (tab === 'company') loadSettings();
    if (tab === 'statuses') loadLeadStatuses();
  }, [tab, loadUsers, loadSettings, loadLeadStatuses]);

  const openCreateUser = () => {
    setEditingUser(null);
    setUserForm(EMPTY_USER);
    setUserErrors({});
    setUserModal(true);
  };

  const openEditUser = (u) => {
    setEditingUser(u);
    setUserForm({
      email: u.email,
      password: '',
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      role: u.role,
      is_active: u.is_active,
    });
    setUserErrors({});
    setUserModal(true);
  };

  const validateUserForm = () => {
    const errs = {};
    if (!editingUser && !userForm.email?.trim()) errs.email = 'Email is required.';
    if (!editingUser && (!userForm.password || userForm.password.length < 8)) {
      errs.password = 'Password must be at least 8 characters.';
    }
    if (!userForm.last_name?.trim()) errs.last_name = 'Last name is required.';
    if (editingUser && userForm.password && userForm.password.length < 8) {
      errs.password = 'Password must be at least 8 characters.';
    }
    setUserErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const saveUser = async () => {
    if (!validateUserForm()) return;
    setSavingUser(true);
    try {
      if (editingUser) {
        const payload = {
          first_name: userForm.first_name || null,
          last_name: userForm.last_name,
          role: userForm.role,
          is_active: userForm.is_active,
        };
        if (userForm.password) payload.password = userForm.password;
        await adminApi.updateAdminUser(editingUser.id, payload);
        showToast('User updated', 'success');
      } else {
        await adminApi.createAdminUser({
          email: userForm.email,
          password: userForm.password,
          first_name: userForm.first_name || null,
          last_name: userForm.last_name,
          role: userForm.role,
        });
        showToast('User created', 'success');
      }
      setUserModal(false);
      loadUsers();
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSavingUser(false);
    }
  };

  const saveCompanySettings = async () => {
    setSavingSettings(true);
    try {
      const updated = await adminApi.updateAppSettings({
        company_name: appSettings.company_name,
        timezone: appSettings.timezone,
      });
      setAppSettings(updated || appSettings);
      showToast('Company settings saved', 'success');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSavingSettings(false);
    }
  };

  const addLeadStatus = async () => {
    if (!statusLabel.trim()) {
      showToast('Enter a status label');
      return;
    }
    setSavingStatus(true);
    try {
      await adminApi.createAdminLeadStatus({
        label: statusLabel.trim(),
        value: statusValue.trim() || slugifyStatusValue(statusLabel),
      });
      setStatusLabel('');
      setStatusValue('');
      showToast('Status added', 'success');
      loadLeadStatuses();
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSavingStatus(false);
    }
  };

  const removeLeadStatus = async (optionId) => {
    setDeletingStatus(optionId);
    try {
      await adminApi.deleteAdminLeadStatus(optionId);
      showToast('Status removed', 'success');
      loadLeadStatuses();
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setDeletingStatus('');
    }
  };

  const previewValue = statusValue.trim() || slugifyStatusValue(statusLabel);

  const openEditLeadStatus = (status) => {
    setEditingStatus(status);
    setEditingStatusLabel(status.label || '');
  };

  const saveLeadStatusEdit = async () => {
    if (!editingStatus) return;
    const nextLabel = editingStatusLabel.trim();
    if (!nextLabel) {
      showToast('Enter a status label');
      return;
    }
    setEditingStatusSaving(true);
    try {
      await adminApi.updateAdminLeadStatus(editingStatus.id || editingStatus.value, { label: nextLabel });
      showToast('Status updated', 'success');
      setEditingStatus(null);
      setEditingStatusLabel('');
      loadLeadStatuses();
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setEditingStatusSaving(false);
    }
  };

  const handleTriggerReport = async () => {
    try {
      const result = await triggerWeeklyReport();
      showToast(result.message || `Sent ${result.sent_count} report(s)`, 'success');
    } catch (err) {
      showToast(getApiError(err));
    }
  };

  const sendPasswordResetCode = async () => {
    if (!user?.email) return;
    setSendingCode(true);
    try {
      const message = await authApi.forgotPassword(user.email);
      setCodeSent(true);
      showToast(message, 'success');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSendingCode(false);
    }
  };

  const validatePasswordForm = () => {
    const errs = {};
    const otp = passwordForm.otp.trim();
    if (!/^\d{6}$/.test(otp)) errs.otp = 'Enter the 6-digit code from your email.';
    if (!passwordForm.new_password || passwordForm.new_password.length < 8) {
      errs.new_password = 'Password must be at least 8 characters.';
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      errs.confirm_password = 'Passwords do not match.';
    }
    setPasswordErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    if (!validatePasswordForm() || !user?.email) return;
    setResettingPassword(true);
    try {
      const message = await authApi.resetPassword({
        email: user.email,
        otp: passwordForm.otp.trim(),
        new_password: passwordForm.new_password,
      });
      showToast(message || 'Password updated. Please sign in again.', 'success');
      setPasswordForm({ otp: '', new_password: '', confirm_password: '' });
      setCodeSent(false);
      setTimeout(() => logout(), 1500);
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <CRMLayout>
      <div className="max-w-5xl mx-auto w-full">
        <h1 className="text-lg font-semibold text-zoho-text mb-1">Settings</h1>
        <p className="text-sm text-zoho-muted mb-6">Manage your profile, users, and organization settings</p>

        <div className="flex gap-1 mb-6 border-b border-gray-100 overflow-x-auto">
          {visibleTabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm border-b-2 -mb-px whitespace-nowrap ${tab === t.id ? 'border-brand-500 text-brand-600 font-medium' : 'border-transparent text-gray-500'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'profile' && (
          <div className="space-y-6">
            <div className="card p-5">
              <h2 className="text-sm font-semibold mb-3">My Profile</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div><dt className="text-zoho-muted text-xs">Name</dt><dd className="font-medium">{userDisplayName(user)}</dd></div>
                <div><dt className="text-zoho-muted text-xs">Email</dt><dd>{user?.email}</dd></div>
                <div><dt className="text-zoho-muted text-xs">Role</dt><dd className="text-brand-600">{myRoleLabel}</dd></div>
              </dl>
            </div>
            <div className="card p-5">
              <h2 className="text-sm font-semibold mb-1">Password</h2>
              <p className="text-sm text-zoho-muted mb-4">
                Reset your password with a verification code sent to <span className="font-medium text-zoho-text">{user?.email}</span>.
              </p>
              {!codeSent ? (
                <button
                  type="button"
                  onClick={sendPasswordResetCode}
                  disabled={sendingCode || !user?.email}
                  className="btn-secondary text-xs"
                >
                  {sendingCode ? 'Sending code…' : 'Send reset code'}
                </button>
              ) : (
                <form onSubmit={handlePasswordReset} className="space-y-3 max-w-md">
                  <FormField label="Reset code" required error={passwordErrors.otp} name="otp">
                    <input
                      className={inputClass(passwordErrors.otp)}
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={passwordForm.otp}
                      onChange={(e) => {
                        setPasswordForm((f) => ({ ...f, otp: e.target.value.replace(/\D/g, '').slice(0, 6) }));
                        setPasswordErrors((er) => ({ ...er, otp: null }));
                      }}
                      placeholder="000000"
                      autoComplete="one-time-code"
                    />
                  </FormField>
                  <FormField label="New password" required error={passwordErrors.new_password} name="new_password">
                    <PasswordInput
                      className={inputClass(passwordErrors.new_password)}
                      value={passwordForm.new_password}
                      onChange={(e) => {
                        setPasswordForm((f) => ({ ...f, new_password: e.target.value }));
                        setPasswordErrors((er) => ({ ...er, new_password: null }));
                      }}
                      minLength={8}
                      autoComplete="new-password"
                    />
                  </FormField>
                  <FormField label="Confirm password" required error={passwordErrors.confirm_password} name="confirm_password">
                    <PasswordInput
                      className={inputClass(passwordErrors.confirm_password)}
                      value={passwordForm.confirm_password}
                      onChange={(e) => {
                        setPasswordForm((f) => ({ ...f, confirm_password: e.target.value }));
                        setPasswordErrors((er) => ({ ...er, confirm_password: null }));
                      }}
                      minLength={8}
                      autoComplete="new-password"
                    />
                  </FormField>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button type="submit" disabled={resettingPassword} className="btn-primary text-xs">
                      {resettingPassword ? 'Updating…' : 'Update password'}
                    </button>
                    <button
                      type="button"
                      onClick={sendPasswordResetCode}
                      disabled={sendingCode}
                      className="btn-secondary text-xs"
                    >
                      {sendingCode ? 'Sending…' : 'Resend code'}
                    </button>
                  </div>
                </form>
              )}
            </div>
            <div className="card p-5">
              <h2 className="text-sm font-semibold mb-2">Your Access</h2>
              <p className="text-sm text-zoho-muted">{roleAccess}</p>
            </div>
            {canManageUsers && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold mb-3">Role Permissions Reference</h2>
              <div className="space-y-3">
                {USER_ROLES.map(r => (
                  <div key={r} className="flex gap-3 text-sm border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                    <span className="font-medium text-brand-600 w-32 shrink-0">{ROLE_LABELS[r]}</span>
                    <span className="text-zoho-muted">{ROLE_ACCESS[r]}</span>
                  </div>
                ))}
              </div>
            </div>
            )}
            {canManageSettings && (
              <div className="card p-5">
                <h2 className="text-sm font-semibold mb-2">Weekly Auto-Reports</h2>
                <p className="text-sm text-zoho-muted mb-3">Configure recipients and schedule in Reports.</p>
                <Link href="/reports" className="btn-secondary text-xs inline-block mr-2">Configure in Reports</Link>
                <button type="button" className="btn-secondary text-xs" onClick={handleTriggerReport}>Trigger report now</button>
              </div>
            )}
          </div>
        )}

        {tab === 'users' && canManageUsers && (
          <div className="card overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-sm font-semibold">Users</h2>
                <p className="text-xs text-zoho-muted">Manage CRM users via <code className="text-brand-600">/admin/users</code></p>
              </div>
              <button type="button" onClick={openCreateUser} className="btn-primary text-xs">+ Add User</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-th">Name</th>
                    <th className="table-th">Email</th>
                    <th className="table-th">Role</th>
                    <th className="table-th">Access</th>
                    <th className="table-th">Status</th>
                    <th className="table-th">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {usersLoading ? (
                    <tr><td colSpan={6} className="table-td text-center py-8 text-gray-400">Loading users...</td></tr>
                  ) : users.length === 0 ? (
                    <tr><td colSpan={6} className="table-td text-center py-8 text-gray-400">No users found</td></tr>
                  ) : users.map(u => (
                    <tr key={u.id} className={!u.is_active ? 'opacity-60' : ''}>
                      <td className="table-td font-medium">{userDisplayName(u)}</td>
                      <td className="table-td text-blue-600">{u.email}</td>
                      <td className="table-td"><span className="badge bg-brand-50 text-brand-700">{roleLabel(u.role)}</span></td>
                      <td className="table-td text-xs text-zoho-muted max-w-[200px]">{ROLE_ACCESS[u.role]}</td>
                      <td className="table-td">
                        <span className={`badge ${u.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="table-td">
                        <button type="button" onClick={() => openEditUser(u)} className="text-xs text-blue-600 hover:underline">Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'statuses' && canManageSettings && (
          <div className="space-y-4">
            <div className="card p-5">
              <h2 className="text-sm font-semibold mb-1">Add Custom Lead Status</h2>
              <p className="text-xs text-zoho-muted mb-4">
                Manage via <code className="text-brand-600">/admin/lookup-options/lead-statuses</code>.
                Status value is saved as snake_case (e.g. <code className="text-brand-600">follow_up_required</code>).
                System statuses cannot be removed.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <FormField label="Status Label" name="status_label">
                  <input
                    className="input"
                    placeholder="e.g. Follow Up Required"
                    value={statusLabel}
                    onChange={(e) => setStatusLabel(e.target.value)}
                  />
                </FormField>
                <FormField label="Status Value (optional)" name="status_value">
                  <input
                    className="input font-mono text-xs"
                    placeholder="Auto-generated from label"
                    value={statusValue}
                    onChange={(e) => setStatusValue(e.target.value)}
                  />
                </FormField>
              </div>
              {statusLabel.trim() && (
                <p className="text-xs text-zoho-muted mb-3">
                  Saved as: <code className="text-brand-600">{previewValue || '—'}</code>
                </p>
              )}
              <button type="button" onClick={addLeadStatus} disabled={savingStatus || !statusLabel.trim()} className="btn-primary text-xs">
                {savingStatus ? 'Saving...' : 'Save Status'}
              </button>
            </div>

            <div className="card overflow-hidden">
              <div className="p-4 border-b">
                <h2 className="text-sm font-semibold">All Lead Statuses</h2>
                <p className="text-xs text-zoho-muted">Used in lead forms, filters, and mass update actions</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="table-th">Label</th>
                      <th className="table-th">Value</th>
                      <th className="table-th">Type</th>
                      <th className="table-th">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {statusesLoading ? (
                      <tr><td colSpan={4} className="table-td text-center py-8 text-gray-400">Loading statuses...</td></tr>
                    ) : leadStatuses.length === 0 ? (
                      <tr><td colSpan={4} className="table-td text-center py-8 text-gray-400">No statuses found</td></tr>
                    ) : leadStatuses.map((s) => (
                      <tr key={s.id || s.value}>
                        <td className="table-td font-medium">{s.label}</td>
                        <td className="table-td font-mono text-xs text-zoho-muted">{s.value}</td>
                        <td className="table-td">
                          <span className={`badge ${s.is_system ? 'bg-gray-100 text-gray-600' : 'bg-brand-50 text-brand-700'}`}>
                            {s.is_system ? 'System' : 'Custom'}
                          </span>
                        </td>
                        <td className="table-td">
                          {!s.is_system && s.id && (
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => openEditLeadStatus(s)}
                                className="text-xs text-blue-600 hover:underline"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => removeLeadStatus(s.id)}
                                disabled={deletingStatus === s.id}
                                className="text-xs text-red-600 hover:underline disabled:opacity-50"
                              >
                                {deletingStatus === s.id ? 'Removing...' : 'Delete'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === 'company' && canManageSettings && (
          <div className="card p-5 max-w-lg">
            <h2 className="text-sm font-semibold mb-1">Company Settings</h2>
            <p className="text-xs text-zoho-muted mb-4">From <code className="text-brand-600">GET /admin/settings</code> · app_settings</p>
            {settingsLoading ? (
              <p className="text-sm text-gray-400 py-6">Loading settings...</p>
            ) : (
              <div className="space-y-4">
                <FormField label="Company Name" name="company_name">
                  <input className="input" value={appSettings.company_name || ''}
                    onChange={e => setAppSettings(s => ({ ...s, company_name: e.target.value }))} />
                </FormField>
                <FormField label="Timezone" name="timezone">
                  <input className="input" value={appSettings.timezone || 'UTC'}
                    onChange={e => setAppSettings(s => ({ ...s, timezone: e.target.value }))}
                    placeholder="e.g. Asia/Kolkata, UTC" />
                </FormField>
                <button type="button" onClick={saveCompanySettings} disabled={savingSettings} className="btn-primary text-xs">
                  {savingSettings ? 'Saving...' : 'Save Company Settings'}
                </button>
              </div>
            )}
          </div>
        )}

        {tab === 'announcements' && canManageSettings && (
          <AnnouncementsPanel />
        )}
      </div>

      {userModal && (
        <Modal title={editingUser ? 'Edit User' : 'Add User'} onClose={() => setUserModal(false)}>
          <div className="space-y-3">
            {!editingUser && (
              <FormField label="Email" required error={userErrors.email} name="email">
                <input className={inputClass(userErrors.email)} type="email" value={userForm.email}
                  onChange={e => { setUserForm(f => ({ ...f, email: e.target.value })); setUserErrors(er => ({ ...er, email: null })); }} />
              </FormField>
            )}
            <FormField label={editingUser ? 'New Password (optional)' : 'Password'} required={!editingUser} error={userErrors.password} name="password">
              <PasswordInput
                className={inputClass(userErrors.password)}
                value={userForm.password}
                onChange={e => { setUserForm(f => ({ ...f, password: e.target.value })); setUserErrors(er => ({ ...er, password: null })); }}
                placeholder={editingUser ? 'Leave blank to keep current' : 'Min. 8 characters'}
              />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="First Name" name="first_name">
                <input className="input" value={userForm.first_name}
                  onChange={e => setUserForm(f => ({ ...f, first_name: e.target.value }))} />
              </FormField>
              <FormField label="Last Name" required error={userErrors.last_name} name="last_name">
                <input className={inputClass(userErrors.last_name)} value={userForm.last_name}
                  onChange={e => { setUserForm(f => ({ ...f, last_name: e.target.value })); setUserErrors(er => ({ ...er, last_name: null })); }} />
              </FormField>
            </div>
            <FormField label="Role" name="role">
              <select className="input" value={userForm.role} onChange={e => setUserForm(f => ({ ...f, role: e.target.value }))}>
                {USER_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </FormField>
            <p className="text-xs text-zoho-muted bg-gray-50 rounded-lg p-2">{ROLE_ACCESS[userForm.role]}</p>
            {editingUser && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={userForm.is_active !== false}
                  onChange={e => setUserForm(f => ({ ...f, is_active: e.target.checked }))} />
                Active user
              </label>
            )}
          </div>
          <div className="flex gap-2 justify-end pt-4 mt-2 border-t border-gray-100">
            <button type="button" onClick={() => setUserModal(false)} className="btn-secondary">Cancel</button>
            <button type="button" onClick={saveUser} disabled={savingUser} className="btn-primary">{savingUser ? 'Saving...' : 'Save User'}</button>
          </div>
        </Modal>
      )}

      {editingStatus && (
        <Modal title="Edit Lead Status" onClose={() => { if (!editingStatusSaving) { setEditingStatus(null); setEditingStatusLabel(''); } }}>
          <div className="space-y-3">
            <FormField label="Status Label" required name="edit_status_label">
              <input
                className="input"
                value={editingStatusLabel}
                onChange={(e) => setEditingStatusLabel(e.target.value)}
              />
            </FormField>
            <FormField label="Status Value" name="edit_status_value">
              <input
                className="input font-mono text-xs bg-gray-50"
                value={editingStatus.value}
                readOnly
              />
            </FormField>
          </div>
          <div className="flex gap-2 justify-end pt-4">
            <button
              type="button"
              onClick={() => { if (!editingStatusSaving) { setEditingStatus(null); setEditingStatusLabel(''); } }}
              className="btn-secondary text-xs"
              disabled={editingStatusSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveLeadStatusEdit}
              disabled={editingStatusSaving}
              className="btn-primary text-xs"
            >
              {editingStatusSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </Modal>
      )}
    </CRMLayout>
  );
}
