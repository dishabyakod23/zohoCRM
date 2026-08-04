'use client';
import {
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  applyPermissionDependencies,
} from '../../lib/permissionModules.js';

const ACTION_LABELS = { view: 'View', create: 'Create', edit: 'Edit', delete: 'Delete', import: 'Import', export: 'Export' };

function moduleRowState(mod, permissions) {
  const applicable = mod.actions;
  const granted = applicable.filter((action) => permissions[mod.key]?.[action]);
  return {
    all: applicable.length > 0 && granted.length === applicable.length,
    some: granted.length > 0 && granted.length < applicable.length,
  };
}

function matrixSelectAllState(permissions) {
  const applicableModules = PERMISSION_MODULES.filter((mod) => !mod.superAdminOnly);
  const rows = applicableModules.map((mod) => moduleRowState(mod, permissions));
  const allRowsFull = rows.length > 0 && rows.every((row) => row.all);
  const anyGranted = rows.some((row) => row.all || row.some);
  return { all: allRowsFull, some: anyGranted && !allRowsFull };
}

export default function PermissionMatrix({ permissions, onChange, disabled }) {
  const toggle = (moduleKey, action) => {
    if (disabled) return;
    const next = {
      ...permissions,
      [moduleKey]: { ...permissions[moduleKey], [action]: !permissions[moduleKey]?.[action] },
    };
    onChange(applyPermissionDependencies(next));
  };

  const toggleModuleAll = (mod, checked) => {
    if (disabled || mod.superAdminOnly) return;
    const next = { ...permissions, [mod.key]: { ...permissions[mod.key] } };
    for (const action of PERMISSION_ACTIONS) {
      if (mod.actions.includes(action)) next[mod.key][action] = checked;
    }
    onChange(applyPermissionDependencies(next));
  };

  const toggleMatrixAll = (checked) => {
    if (disabled) return;
    const next = { ...permissions };
    for (const mod of PERMISSION_MODULES) {
      if (mod.superAdminOnly) continue;
      next[mod.key] = { ...next[mod.key] };
      for (const action of PERMISSION_ACTIONS) {
        if (mod.actions.includes(action)) next[mod.key][action] = checked;
      }
    }
    onChange(applyPermissionDependencies(next));
  };

  const matrixAll = matrixSelectAllState(permissions);

  return (
    <div className="overflow-x-auto border border-zoho-border rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="table-th text-left">Module / Screen</th>
            <th className="table-th text-center w-16">All</th>
            {PERMISSION_ACTIONS.map((action) => (
              <th key={action} className="table-th text-center w-20">{ACTION_LABELS[action]}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {PERMISSION_MODULES.map((mod) => {
            const row = moduleRowState(mod, permissions);
            return (
              <tr key={mod.key}>
                <td className="table-td font-medium whitespace-nowrap">{mod.label}</td>
                <td className="table-td text-center">
                  {mod.superAdminOnly ? (
                    <span className="text-zoho-muted/40">—</span>
                  ) : (
                    <input
                      type="checkbox"
                      checked={row.all}
                      ref={(el) => { if (el) el.indeterminate = row.some; }}
                      disabled={disabled}
                      onChange={() => toggleModuleAll(mod, !row.all)}
                      aria-label={`${mod.label} — select all permissions`}
                      className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 disabled:opacity-50"
                    />
                  )}
                </td>
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
            );
          })}
        </tbody>
        <tfoot className="bg-gray-50 border-t">
          <tr>
            <td className="table-td font-medium text-zoho-muted">Select all modules</td>
            <td className="table-td text-center">
              <input
                type="checkbox"
                checked={matrixAll.all}
                ref={(el) => { if (el) el.indeterminate = matrixAll.some; }}
                disabled={disabled}
                onChange={() => toggleMatrixAll(!matrixAll.all)}
                aria-label="Select all permissions for every module"
                className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 disabled:opacity-50"
              />
            </td>
            <td colSpan={PERMISSION_ACTIONS.length} className="table-td text-xs text-zoho-muted">
              Grants every available permission across all modules (except Super Admin only settings).
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
