'use client';

/**
 * EditableFieldSection config for record owner.
 * Super Admin and Sales Manager can reassign via owner_id dropdown.
 */
export function ownerFieldConfig({ users = [], canAssign = false, ownerName } = {}) {
  if (!canAssign) {
    return {
      name: 'owner_name',
      label: 'Owner',
      readOnly: true,
      format: () => ownerName || '—',
    };
  }

  return {
    name: 'owner_id',
    label: 'Owner',
    format: () => ownerName || 'Unassigned',
    render: (d, set) => (
      <select
        className="input"
        value={d.owner_id ?? ''}
        onChange={(e) => set((p) => ({ ...p, owner_id: e.target.value }))}
      >
        <option value="">--None--</option>
        {users.map((u) => (
          <option key={u.id || u.value} value={u.id || u.value}>
            {u.name || u.label}
          </option>
        ))}
      </select>
    ),
  };
}
