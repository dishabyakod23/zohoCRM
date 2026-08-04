'use client';
import {
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  applyPermissionDependencies,
} from '../../lib/permissionModules.js';

const ACTION_LABELS = { view: 'View', create: 'Create', edit: 'Edit', delete: 'Delete', import: 'Import', export: 'Export' };

export default function PermissionMatrix({ permissions, onChange, disabled }) {
  const toggle = (moduleKey, action) => {
    if (disabled) return;
    const next = {
      ...permissions,
      [moduleKey]: { ...permissions[moduleKey], [action]: !permissions[moduleKey]?.[action] },
    };
    onChange(applyPermissionDependencies(next));
  };

  return (
    <div className="overflow-x-auto border border-zoho-border rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="table-th text-left">Module / Screen</th>
            {PERMISSION_ACTIONS.map((action) => (
              <th key={action} className="table-th text-center w-20">{ACTION_LABELS[action]}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {PERMISSION_MODULES.map((mod) => (
            <tr key={mod.key}>
              <td className="table-td font-medium whitespace-nowrap">{mod.label}</td>
              {PERMISSION_ACTIONS.map((action) => {
                if (mod.superAdminOnly) {
                  return action === 'view' ? (
                    <td key={action} colSpan={PERMISSION_ACTIONS.length} className="table-td text-center text-xs text-zoho-muted">
                      Super Admin only
                    </td>
                  ) : null;
                }
                if (!mod.actions.includes(action)) return <td key={action} className="table-td text-center text-zoho-muted/40">—</td>;
                return (
                  <td key={action} className="table-td text-center">
                    <input
                      type="checkbox"
                      checked={Boolean(permissions[mod.key]?.[action])}
                      disabled={disabled}
                      onChange={() => toggle(mod.key, action)}
                      aria-label={`${mod.label} — ${mod.actionLabels?.[action] || ACTION_LABELS[action]}`}
                      className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 disabled:opacity-50"
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
