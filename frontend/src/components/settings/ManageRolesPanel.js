'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Modal from '../ui/Modal.js';
import ConfirmDialog from '../ui/ConfirmDialog.js';
import FormField, { inputClass } from '../forms/FormField.js';
import { useToast } from '../ui/Toast.js';
import * as manageRolesApi from '../../lib/services/manageRoles.js';
import * as adminApi from '../../lib/services/admin.js';
import { normalizeRole } from '../../lib/roles.js';
import {
  emptyModulePermissions,
  applyPermissionDependencies,
  countGrantedModules,
} from '../../lib/permissionModules.js';
import { ROLE_NAME_MAX_LENGTH } from '../../lib/manageRolesHelpers.js';
import PermissionMatrix from './PermissionMatrix.js';

const EMPTY_FORM = { name: '', description: '', status: 'active', permissions: emptyModulePermissions() };

function emptyErrors() {
  return { name: null, description: null };
}

export default function ManageRolesPanel() {
  const { showToast } = useToast();
  const [roles, setRoles] = useState([]);
  const [userCounts, setUserCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [viewOnly, setViewOnly] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState(emptyErrors());
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [roleList, users] = await Promise.all([manageRolesApi.listRoles(), adminApi.listAdminUsers()]);
      setRoles(roleList);
      const counts = {};
      for (const role of roleList) {
        counts[role.key] = users.filter((u) => normalizeRole(u.role) === role.key).length;
      }
      setUserCounts(counts);
    } catch {
      showToast('Failed to load roles.');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditingRole(null);
    setViewOnly(false);
    setForm(EMPTY_FORM);
    setErrors(emptyErrors());
    setModalOpen(true);
  };

  const openEdit = (role, { readOnly = false } = {}) => {
    setEditingRole(role);
    setViewOnly(readOnly);
    setForm({
      name: role.name,
      description: role.description || '',
      status: role.status || 'active',
      permissions: applyPermissionDependencies(role.permissions || {}),
    });
    setErrors(emptyErrors());
    setModalOpen(true);
  };

  const save = async () => {
    const existing = roles.filter((r) => !editingRole || String(r.id) !== String(editingRole.id));
    const errs = manageRolesApi.validateRolePayload(form, existing, editingRole?.id);
    setErrors({ ...emptyErrors(), ...errs });
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      if (editingRole) {
        await manageRolesApi.updateRole(editingRole.id, form);
        showToast('Role updated successfully.', 'success');
      } else {
        await manageRolesApi.createRole(form);
        showToast('Role created successfully.', 'success');
      }
      setModalOpen(false);
      load();
    } catch (err) {
      showToast(err.message || 'Failed to save role.');
    } finally {
      setSaving(false);
    }
  };

  const requestDelete = (role) => {
    const count = userCounts[role.key] || 0;
    if (count > 0) {
      showToast('This role cannot be deleted because users are assigned to it. Please reassign those users to another role before deleting.');
      return;
    }
    setDeleteTarget(role);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await manageRolesApi.deleteRole(deleteTarget.id);
      showToast('Role deleted successfully.', 'success');
      setDeleteTarget(null);
      load();
    } catch (err) {
      showToast(err.message || 'Failed to delete role.');
    } finally {
      setDeleting(false);
    }
  };

  const nameLength = form.name.length;

  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold">Manage Roles</h2>
          <p className="text-xs text-zoho-muted">Define which screens and actions each role can access.</p>
        </div>
        <button type="button" onClick={openAdd} className="btn-primary text-xs">+ Add Role</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="table-th">Role Name</th>
              <th className="table-th">Description</th>
              <th className="table-th">Users Assigned</th>
              <th className="table-th">Permissions</th>
              <th className="table-th">Status</th>
              <th className="table-th">Created By</th>
              <th className="table-th">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={7} className="table-td text-center py-8 text-gray-400">Loading roles...</td></tr>
            ) : roles.length === 0 ? (
              <tr><td colSpan={7} className="table-td text-center py-8 text-gray-400">No roles found</td></tr>
            ) : roles.map((role) => (
              <tr key={role.id}>
                <td className="table-td font-medium">
                  {role.name}
                  {role.is_system && <span className="ml-2 badge bg-gray-100 text-gray-600">System</span>}
                </td>
                <td className="table-td text-zoho-muted truncate max-w-xs">{role.description || '—'}</td>
                <td className="table-td">{userCounts[role.key] ?? 0}</td>
                <td className="table-td">{countGrantedModules(role.permissions)} module{countGrantedModules(role.permissions) === 1 ? '' : 's'}</td>
                <td className="table-td">
                  <span className={`badge ${role.status === 'inactive' ? 'bg-gray-100 text-gray-600' : 'bg-emerald-50 text-emerald-700'}`}>
                    {role.status === 'inactive' ? 'Inactive' : 'Active'}
                  </span>
                </td>
                <td className="table-td text-zoho-muted">{role.created_by}</td>
                <td className="table-td">
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => openEdit(role, { readOnly: true })} className="text-xs text-blue-600 hover:underline">View</button>
                    {!role.is_system && (
                      <button type="button" onClick={() => openEdit(role)} className="text-xs text-blue-600 hover:underline">Edit</button>
                    )}
                    {!role.is_system && (
                      <button type="button" onClick={() => requestDelete(role)} className="text-xs text-red-600 hover:underline">Delete</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <Modal
          title={viewOnly ? `View Role — ${editingRole?.name}` : editingRole ? 'Edit Role' : 'Add Role'}
          onClose={() => setModalOpen(false)}
          wide
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Role Name" required error={errors.name} name="role_name">
                <input
                  className={inputClass(errors.name)}
                  value={form.name}
                  maxLength={ROLE_NAME_MAX_LENGTH}
                  disabled={viewOnly}
                  onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setErrors((er) => ({ ...er, name: null })); }}
                />
                {!viewOnly && <p className="text-[11px] text-zoho-muted mt-1">{nameLength}/{ROLE_NAME_MAX_LENGTH}</p>}
              </FormField>
              <FormField label="Role Status" required name="role_status">
                <select
                  className="input"
                  value={form.status}
                  disabled={viewOnly}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </FormField>
            </div>
            <FormField label="Role Description" error={errors.description} name="role_description">
              <textarea
                className={`${inputClass(errors.description)} min-h-[70px] resize-y`}
                value={form.description}
                disabled={viewOnly}
                onChange={(e) => { setForm((f) => ({ ...f, description: e.target.value })); setErrors((er) => ({ ...er, description: null })); }}
              />
            </FormField>

            <div>
              <p className="text-xs font-semibold text-zoho-muted uppercase tracking-wider mb-2">Permissions</p>
              <PermissionMatrix
                permissions={form.permissions}
                onChange={(permissions) => setForm((f) => ({ ...f, permissions }))}
                disabled={viewOnly}
              />
              <p className="text-[11px] text-zoho-muted mt-2">
                Granting Create, Edit, Delete, Import, or Export automatically grants View. Import automatically grants Create.
              </p>
            </div>
          </div>

          {!viewOnly && (
            <div className="flex gap-2 justify-end pt-4 mt-4 border-t border-zoho-border">
              <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
              <button type="button" onClick={save} disabled={saving} className="btn-primary">
                {saving ? 'Saving…' : 'Save Role'}
              </button>
            </div>
          )}
        </Modal>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete role"
        message="Are you sure you want to delete this role?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        confirming={deleting}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />
    </div>
  );
}
