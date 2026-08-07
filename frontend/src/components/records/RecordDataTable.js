'use client';
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Modal from '../ui/Modal.js';
import FormField from '../forms/FormField.js';
import CampaignCombobox from '../forms/CampaignCombobox.js';
import ConfirmDialog from '../ui/ConfirmDialog.js';
import { useToast } from '../ui/Toast.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { getApiError } from '../../lib/api.js';
import { getBulkConfig, bulkDeleteRecords, exportRecordsCsv, printMailingLabels, sendBulkEmail,
} from '../../lib/bulkModuleConfig.js';
import { getNoteMeta, notesApiSupported } from '../../lib/noteHelpers.js';
import RecordNoteRowIcon from './RecordNoteRowIcon.js';
import RecordNotesSidePanel from './RecordNotesSidePanel.js';
import SortableEmailHeader from './SortableEmailHeader.js';
import * as tasksApi from '../../lib/services/tasks.js';
import * as campaignsApi from '../../lib/services/campaigns.js';
import { fetchUsers, fetchMassUpdateFieldOptions, fetchLostReasons, isConvertMassUpdateField, filterLeadMassUpdateFields } from '../../lib/services/lookups.js';
import { fetchCampaignLookups, assignRecordsToCampaign, resolveOrCreateCampaignId } from '../../lib/campaignRecordHelpers.js';
import { personRecordId, personCampaignMemberType, parsePersonRowId } from '../../lib/services/people.js';
import { isLostLeadStatus, isLeadStatusMassField } from '../../lib/statusHelpers.js';
import { logEmailSent } from '../../lib/outreachActivity.js';
import { useAuth } from '../../hooks/useAuth.js';
import { userDisplayName } from '../../lib/userHelpers.js';

const defaultGetRowId = (r) => r.id;

const LEAD_MODULE_KEYS = new Set(['leads', 'raw-leads', 'qualified-leads', 'proposals']);

const CAMPAIGN_MEMBER_TYPES = {
  leads: 'lead',
  'raw-leads': 'lead',
  'qualified-leads': 'lead',
  proposals: 'lead',
  contacts: 'contact',
  accounts: 'account',
  companies: 'account',
};

const MODULE_PIPELINE_STAGE = {
  'raw-leads': 'raw_prospect',
  leads: 'contacted',
  'qualified-leads': 'qualified_lead',
  proposals: 'proposal',
};

function normalizeConvertTargetValue(value) {
  const target = String(value || '').trim().toLowerCase();
  if (!target) return '';
  if (target === 'raw_lead' || target === 'raw_prospect') return 'raw_prospect';
  if (target === 'lead' || target === 'contacted') return 'contacted';
  if (target === 'qualified' || target === 'qualified_lead') return 'qualified_lead';
  if (target === 'proposal') return 'proposal';
  return target;
}

function MassUpdatePanel({
  open, field, value, campaignName, onFieldChange, onValueChange, onCampaignChange, onCancel, onUpdate, updating,
  statusOptions, massUpdateFields, dynamicFields, loadingFields,
  valueOptions, loadingValueOptions, useDynamicFields, isConvertField,
  showLostReason, lostReason, lostReasonOptions, onLostReasonChange, loadingLostReasons,
  statusMassUpdateLabel = 'Status',
}) {
  if (!open) return null;

  const isDynamic = useDynamicFields && Array.isArray(dynamicFields) && dynamicFields.length > 0;
  const valuePlaceholder = isConvertField ? 'Select target' : 'Select value';
  const isCampaignField = String(field || '').toLowerCase() === 'campaign';
  const hasCampaignValue = !!(value || String(campaignName || '').trim());

  let valueInput = null;
  if (field) {
    if (isCampaignField) {
      valueInput = (
        <div className="flex-1 min-w-0">
          <CampaignCombobox
            options={valueOptions || []}
            valueId={value || ''}
            valueLabel={campaignName || ''}
            onChange={({ campaign_id, campaign_name }) => onCampaignChange?.({ campaign_id, campaign_name })}
            disabled={loadingValueOptions}
            placeholder={loadingValueOptions ? 'Loading campaigns…' : 'Search or type campaign name'}
          />
        </div>
      );
    } else if (loadingValueOptions) {
      valueInput = (
        <select className="input flex-1" disabled>
          <option>Loading options…</option>
        </select>
      );
    } else if (isConvertField) {
      valueInput = (
        <select className="input flex-1" value={value} onChange={(e) => onValueChange(e.target.value)}>
          <option value="">{valueOptions?.length ? 'Select target' : 'No options available'}</option>
          {(valueOptions || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    } else if (useDynamicFields) {
      valueInput = (
        <select className="input flex-1" value={value} onChange={(e) => onValueChange(e.target.value)}>
          <option value="">{valueOptions?.length ? valuePlaceholder : 'No options available'}</option>
          {(valueOptions || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    } else if (field === 'status' && statusOptions?.length) {
      valueInput = (
        <select className="input flex-1" value={value} onChange={(e) => onValueChange(e.target.value)}>
          <option value="">Select value</option>
          {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    } else {
      valueInput = <input className="input flex-1" value={value} onChange={(e) => onValueChange(e.target.value)} placeholder="Enter value" />;
    }
  }

  const staticFields = massUpdateFields || ['status', 'convert'];

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4">
      <div className="bg-white border border-zoho-border rounded-xl shadow-card-hover p-5 animate-scaleIn">
        <h3 className="text-sm font-semibold text-zoho-text mb-4">Mass Update</h3>
        <div className="flex flex-wrap gap-2 items-center">
          <select className="input w-44" value={field} onChange={(e) => onFieldChange(e.target.value)} disabled={loadingFields}>
            <option value="">{loadingFields ? 'Loading fields…' : 'Select a field'}</option>
            {isDynamic
              ? dynamicFields.map(f => <option key={f.value} value={f.value}>{f.label}</option>)
              : <>
                  {staticFields.includes('status') && <option value="status">{statusMassUpdateLabel}</option>}
                  {staticFields.includes('convert') && <option value="convert">Convert</option>}
                  {staticFields.includes('campaign') && <option value="campaign">Campaign</option>}
                </>
            }
          </select>
          {field && valueInput}
          {showLostReason && (
            loadingLostReasons ? (
              <select className="input flex-1" disabled><option>Loading reasons…</option></select>
            ) : (
              <select className="input flex-1" value={lostReason} onChange={(e) => onLostReasonChange(e.target.value)}>
                <option value="">Select lost reason</option>
                {(lostReasonOptions || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )
          )}
        </div>
        <div className="flex gap-2 justify-end mt-4 pt-3 border-t border-gray-100">
          <button type="button" onClick={onCancel} className="btn-secondary text-xs">Cancel</button>
          <button type="button" onClick={onUpdate} disabled={updating || loadingValueOptions || loadingLostReasons || !field || (!isCampaignField && !value) || (isCampaignField && !hasCampaignValue) || (showLostReason && !lostReason)} className="btn-primary text-xs">
            {updating ? 'Updating...' : 'Update'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RecordDataTable({
  moduleKey,
  records = [],
  loading = false,
  columns = [],
  onRefresh,
  statusOptions = [],
  pagination,
  emptyMessage = 'No records found',
  getRowId = defaultGetRowId,
  totalMatching,
  fetchAllMatchingIds,
  selectionResetKey,
  massUpdateFieldsLoader,
  convertTargetsLoader,
  massUpdateHandler,
  sort,
  onSortChange,
}) {
  const { showToast } = useToast();
  const { user } = useAuth();
  const { canEdit, canDelete, canAssignLeads, canEditRecord, canDeleteRecord } = usePermissions();
  const config = useMemo(() => getBulkConfig(moduleKey), [moduleKey]);
  const noteMeta = useMemo(() => getNoteMeta(moduleKey), [moduleKey]);
  const showNotes = notesApiSupported(moduleKey);

  const [selected, setSelected] = useState([]);
  const [allMatchingSelected, setAllMatchingSelected] = useState(false);
  const [selectingAllMatching, setSelectingAllMatching] = useState(false);
  const [panelRecord, setPanelRecord] = useState(null);
  const [massUpdateOpen, setMassUpdateOpen] = useState(false);
  const [massField, setMassField] = useState('');
  const [massValue, setMassValue] = useState('');
  const [massCampaignName, setMassCampaignName] = useState('');
  const [massUpdating, setMassUpdating] = useState(false);
  const [dynamicMassFields, setDynamicMassFields] = useState([]);
  const [dynamicConvertTargets, setDynamicConvertTargets] = useState([]);
  const [massValueOptions, setMassValueOptions] = useState([]);
  const [loadingMassFields, setLoadingMassFields] = useState(false);
  const [loadingMassValueOptions, setLoadingMassValueOptions] = useState(false);
  const [massLostReason, setMassLostReason] = useState('');
  const [lostReasonOptions, setLostReasonOptions] = useState([]);
  const [loadingLostReasons, setLoadingLostReasons] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [taskModal, setTaskModal] = useState(false);
  const [campaignModal, setCampaignModal] = useState(false);
  const [campaignLookups, setCampaignLookups] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState({ campaign_id: '', campaign_name: '' });
  const [users, setUsers] = useState([]);
  const [taskForm, setTaskForm] = useState({ title: '', due_date: '', assigned_to: '', description: '' });
  const [savingTask, setSavingTask] = useState(false);
  const [savingCampaign, setSavingCampaign] = useState(false);
  const menuRef = useRef(null);

  const selectedRecords = useMemo(
    () => records.filter((r) => selected.includes(getRowId(r))),
    [records, selected, getRowId],
  );

  const canMassEditSelection = selectedRecords.length > 0
    && selectedRecords.every((record) => canEditRecord(record));
  const canMassDeleteSelection = selectedRecords.length > 0
    && selectedRecords.every((record) => canDeleteRecord(record));

  useEffect(() => {
    setSelected([]);
    setAllMatchingSelected(false);
  }, [selectionResetKey]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const toggleSelect = useCallback((id) => {
    setAllMatchingSelected(false);
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }, []);

  const toggleSelectAll = useCallback(() => {
    const ids = records.map(getRowId);
    const allOnPageSelected = ids.length > 0 && ids.every((id) => selected.includes(id));
    if (allOnPageSelected) {
      setSelected([]);
      setAllMatchingSelected(false);
      return;
    }
    setAllMatchingSelected(false);
    setSelected((s) => {
      const merged = new Set(s);
      ids.forEach((id) => merged.add(id));
      return [...merged];
    });
  }, [records, getRowId, selected]);

  const clearSelection = () => {
    setSelected([]);
    setAllMatchingSelected(false);
  };

  const handleSelectAllMatching = async () => {
    if (!fetchAllMatchingIds) return;
    setSelectingAllMatching(true);
    try {
      const ids = await fetchAllMatchingIds();
      setSelected(ids);
      setAllMatchingSelected(true);
      showToast(`Selected all ${ids.length} ${config.label.toLowerCase()}`, 'success');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSelectingAllMatching(false);
    }
  };

  const allSelected = records.length > 0 && records.every((r) => selected.includes(getRowId(r)));
  const resolvedTotalMatching = totalMatching ?? records.length;
  const showSelectAllMatchingBanner = Boolean(
    fetchAllMatchingIds
    && allSelected
    && !allMatchingSelected
    && resolvedTotalMatching > records.length,
  );

  useEffect(() => {
    if (!massUpdateOpen || !massUpdateFieldsLoader) return;
    setLoadingMassFields(true);
    setDynamicMassFields([]);
    massUpdateFieldsLoader()
      .then((fields) => {
        let filtered = LEAD_MODULE_KEYS.has(moduleKey)
          ? filterLeadMassUpdateFields(fields, { canChangeOwner: canAssignLeads })
          : fields;
        const hasCampaign = filtered.some((f) => String(f.value).toLowerCase() === 'campaign');
        if (!hasCampaign && (LEAD_MODULE_KEYS.has(moduleKey) || moduleKey === 'contacts')) {
          filtered = [...filtered, { value: 'campaign', label: 'Campaign' }];
        }
        setDynamicMassFields(filtered);
      })
      .catch(() => setDynamicMassFields([]))
      .finally(() => setLoadingMassFields(false));
  }, [massUpdateOpen, massUpdateFieldsLoader, moduleKey, canAssignLeads]);

  useEffect(() => {
    const fieldDef = dynamicMassFields.find((f) => f.value === massField);
    const isConvert = isConvertMassUpdateField(fieldDef)
      || String(massField).toLowerCase() === 'convert'
      || String(massField).toLowerCase() === 'pipeline_convert';

    if (!massField || !isConvert || !convertTargetsLoader) {
      setDynamicConvertTargets([]);
      return undefined;
    }

    let cancelled = false;
    setLoadingMassValueOptions(true);
    setDynamicConvertTargets([]);

    convertTargetsLoader()
      .then((options) => { if (!cancelled) setDynamicConvertTargets(options); })
      .catch(() => { if (!cancelled) setDynamicConvertTargets([]); })
      .finally(() => { if (!cancelled) setLoadingMassValueOptions(false); });

    return () => { cancelled = true; };
  }, [massField, dynamicMassFields, convertTargetsLoader]);

  useEffect(() => {
    if (!massField) {
      setMassValueOptions([]);
      if (!convertTargetsLoader) setLoadingMassValueOptions(false);
      return undefined;
    }

    const fieldDef = massUpdateFieldsLoader
      ? dynamicMassFields.find((f) => f.value === massField)
      : null;
    const isConvert = isConvertMassUpdateField(fieldDef) || String(massField).toLowerCase() === 'convert';

    if (isConvert) {
      return undefined;
    }

    if (String(massField).toLowerCase() === 'campaign') {
      let cancelled = false;
      setLoadingMassValueOptions(true);
      setMassValueOptions([]);
      fetchCampaignLookups()
        .then((options) => { if (!cancelled) setMassValueOptions(options); })
        .catch(() => { if (!cancelled) setMassValueOptions([]); })
        .finally(() => { if (!cancelled) setLoadingMassValueOptions(false); });
      return () => { cancelled = true; };
    }

    if (!massUpdateFieldsLoader || !fieldDef) {
      setMassValueOptions([]);
      setLoadingMassValueOptions(false);
      return undefined;
    }

    let cancelled = false;
    setLoadingMassValueOptions(true);
    setMassValueOptions([]);

    fetchMassUpdateFieldOptions(fieldDef)
      .then((options) => { if (!cancelled) setMassValueOptions(options); })
      .catch(() => { if (!cancelled) setMassValueOptions([]); })
      .finally(() => { if (!cancelled) setLoadingMassValueOptions(false); });

    return () => { cancelled = true; };
  }, [massField, dynamicMassFields, massUpdateFieldsLoader, convertTargetsLoader]);

  const selectedMassFieldDef = dynamicMassFields.find((f) => f.value === massField);
  const massFieldKey = String(massField || '').toLowerCase();
  const isConvertMassField = isConvertMassUpdateField(selectedMassFieldDef)
    || massFieldKey === 'convert'
    || massFieldKey === 'pipeline_convert';
  const currentStageTarget = MODULE_PIPELINE_STAGE[moduleKey] || null;
  const filteredConvertTargets = useMemo(() => {
    if (!isConvertMassField || !currentStageTarget) return dynamicConvertTargets;
    return (dynamicConvertTargets || []).filter((option) => (
      normalizeConvertTargetValue(option?.value) !== currentStageTarget
    ));
  }, [dynamicConvertTargets, isConvertMassField, currentStageTarget]);
  const showLostReasonField = massUpdateFieldsLoader
    && isLeadStatusMassField(massField, selectedMassFieldDef)
    && isLostLeadStatus(massValue);
  const staticConvertTargets = useMemo(() => {
    if (!isConvertMassField || massUpdateFieldsLoader) return [];
    return config.convertOptions || [];
  }, [isConvertMassField, massUpdateFieldsLoader, config]);
  const convertTargets = isConvertMassField
    ? (filteredConvertTargets.length ? filteredConvertTargets : staticConvertTargets)
    : [];

  useEffect(() => {
    if (!isConvertMassField || !massValue) return;
    const selectedTargetStillAvailable = convertTargets.some((option) => option.value === massValue);
    if (!selectedTargetStillAvailable) setMassValue('');
  }, [isConvertMassField, massValue, convertTargets]);

  useEffect(() => {
    if (!showLostReasonField) {
      setLostReasonOptions([]);
      setMassLostReason('');
      setLoadingLostReasons(false);
      return undefined;
    }
    let cancelled = false;
    setLoadingLostReasons(true);
    fetchLostReasons()
      .then((options) => { if (!cancelled) setLostReasonOptions(options); })
      .catch(() => { if (!cancelled) setLostReasonOptions([]); })
      .finally(() => { if (!cancelled) setLoadingLostReasons(false); });
    return () => { cancelled = true; };
  }, [showLostReasonField, massValue]);

  const hasConvertField = massUpdateFieldsLoader
    ? dynamicMassFields.some(isConvertMassUpdateField)
    : config.massUpdateFields?.includes('convert');

  const hasCampaignField = massUpdateFieldsLoader
    ? dynamicMassFields.some((f) => String(f.value).toLowerCase() === 'campaign')
    : config.massUpdateFields?.includes('campaign');

  const hasMassUpdate = massUpdateFieldsLoader
    || (config.massUpdateFields?.includes('status') && config.statusField)
    || hasConvertField
    || hasCampaignField;

  const handleSendEmail = () => {
    if (!config.emailField) {
      showToast('Email is not available for this module');
      return;
    }
    const url = sendBulkEmail(selectedRecords, config.emailField, {
      onSent: (record) => {
        const contactId = personRecordId(record) || record.id;
        if (contactId) {
          logEmailSent(String(contactId).split(':').pop(), {
            user: { id: user?.id, name: userDisplayName(user) },
          });
        }
      },
    });
    if (!url) {
      showToast('No email addresses found on selected records');
      return;
    }
    window.location.href = url;
    showToast('Opening email client…', 'success');
  };

  const handleMassUpdate = async () => {
    const isCampaignField = String(massField).toLowerCase() === 'campaign';
    const hasValue = isCampaignField
      ? !!(massValue || String(massCampaignName || '').trim())
      : !!massValue;
    if (!massField || !hasValue) return;
    setMassUpdating(true);
    const finishMassUpdate = () => {
      setMassUpdateOpen(false);
      setMassField('');
      setMassValue('');
      setMassCampaignName('');
      setMassLostReason('');
      clearSelection();
      onRefresh?.();
    };
    try {
      if (isCampaignField) {
        const campaignId = await resolveOrCreateCampaignId({
          campaign_id: massValue,
          campaign_name: massCampaignName,
          campaigns: massValueOptions,
        });
        if (!campaignId) {
          showToast('Select or enter a campaign name');
          return;
        }
        if (moduleKey === 'contacts') {
          const members = selectedRecords.map((record) => ({
            member_type: personCampaignMemberType(record),
            member_id: personRecordId(record) || parsePersonRowId(getRowId(record)).recordId,
          })).filter((member) => member.member_id);
          if (!members.length) {
            showToast('No valid records selected');
            return;
          }
          await campaignsApi.addCampaignMembers(campaignId, members);
        } else {
          const memberType = CAMPAIGN_MEMBER_TYPES[moduleKey];
          if (!memberType) {
            showToast('Campaign assignment is not supported for this module');
            return;
          }
          await assignRecordsToCampaign(campaignId, memberType, selected);
        }
        showToast(`Added ${selected.length} record(s) to campaign`, 'success');
        finishMassUpdate();
        return;
      }

      if (massUpdateHandler) {
        const result = await massUpdateHandler(selected, massField, massValue, {
          lost_reason: showLostReasonField ? massLostReason : undefined,
        });
        const failed = result?.failed_count ?? 0;
        const count = result?.success_count ?? result?.updated ?? selected.length;
        if (failed > 0 && count > 0) {
          showToast(`Updated ${count} record(s); ${failed} failed`);
          finishMassUpdate();
          return;
        }
        if (failed > 0) {
          showToast((result?.errors || []).join('; ') || `${failed} record(s) failed to update`);
          return;
        }
        showToast(`Updated ${count} record(s)`, 'success');
      } else {
        let success = 0;
        let failed = 0;
        for (const recordId of selected) {
          try {
            const targetId = moduleKey === 'contacts'
              ? parsePersonRowId(recordId).recordId
              : recordId;
            if (massField === 'status' && config.statusField && config.update) {
              await config.update(targetId, { [config.statusField]: massValue });
              success += 1;
            } else if (massField === 'convert' && config.convert) {
              await config.convert(targetId, massValue);
              success += 1;
            }
          } catch {
            failed += 1;
          }
        }
        if (!success) {
          showToast(failed > 1 ? `${failed} record(s) failed to update` : 'Update failed');
          return;
        }
        if (failed > 0) {
          showToast(`Updated ${success} record(s); ${failed} failed`);
        } else {
          showToast(`Updated ${success} record(s)`, 'success');
        }
      }
      finishMassUpdate();
    } catch (err) {
      const partial = err?.massUpdateResult;
      if (partial?.success_count > 0) {
        showToast(`Updated ${partial.success_count} record(s); ${partial.failed_count || 0} failed`);
        finishMassUpdate();
      } else {
        showToast(getApiError(err));
      }
    } finally {
      setMassUpdating(false);
    }
  };

  const handleDelete = async () => {
    try {
      const result = await bulkDeleteRecords(selected, config);
      showToast(`Deleted ${result.success_count ?? selected.length} record(s)`, 'success');
      setDeleteConfirm(false);
      clearSelection();
      onRefresh?.();
    } catch (err) {
      showToast(getApiError(err));
    }
  };

  const handleExport = () => {
    exportRecordsCsv(selectedRecords, config, `${moduleKey}-export.csv`);
    showToast(`Exported ${selectedRecords.length} record(s)`, 'success');
  };

  const handlePrintLabels = () => {
    printMailingLabels(selectedRecords, config);
  };

  const openTaskModal = () => {
    fetchUsers().then(setUsers).catch(() => {});
    setTaskForm({
      title: `Follow up: ${selectedRecords.length} record(s)`,
      due_date: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
      assigned_to: '',
      description: selectedRecords.map((r) => config.exportRow(r)).map((row) => Object.values(row).join(' — ')).join('\n'),
    });
    setTaskModal(true);
    setMenuOpen(false);
  };

  const saveTask = async () => {
    if (!taskForm.title || !taskForm.due_date || !taskForm.assigned_to) {
      showToast('Fill in task title, due date, and assignee');
      return;
    }
    setSavingTask(true);
    try {
      await tasksApi.createTask({ ...taskForm, status: 'not_started', priority: 'normal' });
      showToast('Task created', 'success');
      setTaskModal(false);
      clearSelection();
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSavingTask(false);
    }
  };

  const openCampaignModal = () => {
    fetchCampaignLookups().then(setCampaignLookups).catch(() => setCampaignLookups([]));
    setSelectedCampaign({ campaign_id: '', campaign_name: '' });
    setCampaignModal(true);
    setMenuOpen(false);
  };

  const addToCampaign = async () => {
    const hasCampaign = !!(selectedCampaign.campaign_id || String(selectedCampaign.campaign_name || '').trim());
    if (!hasCampaign) return;
    setSavingCampaign(true);
    try {
      const campaignId = await resolveOrCreateCampaignId({
        ...selectedCampaign,
        campaigns: campaignLookups,
      });
      if (!campaignId) {
        showToast('Select or enter a campaign name');
        return;
      }

      if (moduleKey === 'contacts') {
        await Promise.all(selectedRecords.map((record) => campaignsApi.addCampaignMember(campaignId, {
          member_type: personCampaignMemberType(record),
          member_id: personRecordId(record) || parsePersonRowId(getRowId(record)).recordId,
        })));
      } else {
        const memberType = CAMPAIGN_MEMBER_TYPES[moduleKey];
        if (!memberType) {
          showToast('Add to Campaign is only supported for Leads and Contacts lists');
          return;
        }
        await Promise.all(selected.map((id) => campaignsApi.addCampaignMember(campaignId, {
          member_type: memberType,
          member_id: id,
        })));
      }

      showToast(`Added ${selected.length} record(s) to campaign`, 'success');
      setCampaignModal(false);
      setSelectedCampaign({ campaign_id: '', campaign_name: '' });
      clearSelection();
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSavingCampaign(false);
    }
  };

  const colSpan = columns.length + 1;

  return (
    <>
      <MassUpdatePanel
        open={massUpdateOpen}
        field={massField}
        value={massValue}
        campaignName={massCampaignName}
        onFieldChange={(f) => { setMassField(f); setMassValue(''); setMassCampaignName(''); setMassLostReason(''); }}
        onValueChange={(v) => { setMassValue(v); setMassLostReason(''); }}
        onCampaignChange={({ campaign_id, campaign_name }) => {
          setMassValue(campaign_id);
          setMassCampaignName(campaign_name);
          setMassLostReason('');
        }}
        onCancel={() => { setMassUpdateOpen(false); setMassField(''); setMassValue(''); setMassCampaignName(''); setMassLostReason(''); }}
        onUpdate={handleMassUpdate}
        updating={massUpdating}
        statusOptions={statusOptions}
        massUpdateFields={config.massUpdateFields}
        statusMassUpdateLabel={config.statusMassUpdateLabel}
        dynamicFields={dynamicMassFields}
        loadingFields={loadingMassFields}
        valueOptions={isConvertMassField ? convertTargets : massValueOptions}
        loadingValueOptions={loadingMassValueOptions}
        useDynamicFields={!!massUpdateFieldsLoader}
        isConvertField={isConvertMassField}
        showLostReason={showLostReasonField}
        lostReason={massLostReason}
        lostReasonOptions={lostReasonOptions}
        onLostReasonChange={setMassLostReason}
        loadingLostReasons={loadingLostReasons}
      />

      <div className="record-data-table-shell">
        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 shrink-0 bg-brand-50/80 border-b border-brand-200 text-sm">
            <span className="font-medium text-brand-800">
              {allMatchingSelected && resolvedTotalMatching > records.length
                ? `All ${resolvedTotalMatching} ${config.label} selected.`
                : `${selected.length} ${config.label} Selected.`}
            </span>
            <button type="button" onClick={clearSelection} className="text-brand-600 hover:underline text-xs font-medium">Clear</button>
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              {config.emailField && (
                <button type="button" onClick={handleSendEmail} className="btn-secondary text-xs">Send Email</button>
              )}
              {canMassEditSelection && hasMassUpdate && (
                <button type="button" onClick={() => setMassUpdateOpen(true)} className="btn-secondary text-xs">Mass Update</button>
              )}
              <div className="relative" ref={menuRef}>
                <button type="button" onClick={() => setMenuOpen(!menuOpen)} aria-label="More actions"
                  className="w-8 h-8 rounded-lg border border-zoho-border bg-white flex items-center justify-center text-zoho-muted hover:bg-brand-50 hover:text-brand-600">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-zoho-border rounded-xl shadow-card-hover py-1 w-52 z-40">
                    {canEdit && <button type="button" onClick={openTaskModal} className="w-full text-left px-3 py-2 text-sm hover:bg-brand-50">Create Task</button>}
                    {canEdit && <button type="button" onClick={openCampaignModal} className="w-full text-left px-3 py-2 text-sm hover:bg-brand-50">Add to Campaigns</button>}
                    <button type="button" onClick={() => { handlePrintLabels(); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-brand-50">Print Mailing Labels</button>
                    {canDelete && <button type="button" onClick={() => { if (!canMassDeleteSelection) { showToast('You can only delete records you own.'); setMenuOpen(false); return; } setDeleteConfirm(true); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 text-red-600">Delete</button>}
                    <button type="button" onClick={() => { handleExport(); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-brand-50">Export Selected Records</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {showSelectAllMatchingBanner && (
          <div className="flex flex-wrap items-center justify-center gap-1 px-4 py-2 shrink-0 bg-amber-50 border-b border-amber-200 text-sm text-amber-900">
            <span>All {records.length} on this page are selected.</span>
            <button
              type="button"
              onClick={handleSelectAllMatching}
              disabled={selectingAllMatching}
              className="font-semibold text-brand-600 hover:underline disabled:opacity-60"
            >
              {selectingAllMatching ? 'Selecting…' : `Select all ${resolvedTotalMatching} ${config.label.toLowerCase()}`}
            </button>
          </div>
        )}

        <div className="record-data-table-scroll">
          <table className="record-data-table w-full">
            <thead>
              <tr>
                <th className={`table-th ${showNotes ? 'w-[4.5rem]' : 'w-10'}`}>
                  <div className="flex items-center gap-2">
                    {showNotes && <span className="w-7 shrink-0" aria-hidden="true" />}
                    <input type="checkbox" className="rounded border-zoho-border" checked={allSelected} onChange={toggleSelectAll} aria-label="Select all" />
                  </div>
                </th>
                {columns.map((col) => (
                  <th key={col.id} className={`table-th ${col.className || ''}`}>
                    {col.sortField === 'email' && onSortChange ? (
                      <SortableEmailHeader label={col.header} sort={sort} onSortChange={onSortChange} />
                    ) : col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={colSpan} className="table-td text-center py-12 text-zoho-muted">Loading…</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={colSpan} className="table-td text-center py-12 text-zoho-muted">{emptyMessage}</td></tr>
              ) : records.map((record) => {
                const id = getRowId(record);
                const recordLabel = noteMeta.getLabel(record);
                return (
                  <tr key={id} className="list-table-row">
                    <td className="table-td">
                      <div className="flex items-center gap-2">
                        {showNotes && (
                          <RecordNoteRowIcon
                            relatedType={noteMeta.relatedType}
                            recordId={id}
                            moduleLabel={noteMeta.moduleLabel}
                            recordLabel={recordLabel}
                            onOpen={() => setPanelRecord({ id, label: recordLabel })}
                          />
                        )}
                        <input type="checkbox" className="rounded border-zoho-border" checked={selected.includes(id)} onChange={() => toggleSelect(id)} />
                      </div>
                    </td>
                    {columns.map((col) => (
                      <td key={col.id} className={`table-td ${col.className || ''}`}>{col.cell(record)}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {pagination && (
          <div className="record-data-table-footer">
            <p className="text-xs text-zoho-muted">{pagination.label || ''}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => pagination.onPageChange(pagination.page - 1)} disabled={pagination.page <= 1} className="btn-secondary-sm disabled:opacity-40">← Prev</button>
              <span className="btn-secondary-sm pointer-events-none">{pagination.page} / {pagination.totalPages}</span>
              <button type="button" onClick={() => pagination.onPageChange(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages} className="btn-secondary-sm disabled:opacity-40">Next →</button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog open={deleteConfirm} message={`Delete ${selected.length} selected record(s)?`} confirmLabel="Delete" danger onConfirm={handleDelete} onCancel={() => setDeleteConfirm(false)} />

      {taskModal && (
        <Modal title="Create Task" onClose={() => setTaskModal(false)}>
          <div className="space-y-3">
            <FormField label="Task Title" required>
              <input className="input" value={taskForm.title} onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))} />
            </FormField>
            <FormField label="Due Date" required>
              <input className="input" type="datetime-local" value={taskForm.due_date} onChange={(e) => setTaskForm((f) => ({ ...f, due_date: e.target.value }))} />
            </FormField>
            <FormField label="Assigned To" required>
              <select className="input" value={taskForm.assigned_to} onChange={(e) => setTaskForm((f) => ({ ...f, assigned_to: e.target.value }))}>
                <option value="">Select user</option>
                {users.map((u) => <option key={u.id || u.value} value={u.id || u.value}>{u.name}</option>)}
              </select>
            </FormField>
            <FormField label="Description">
              <textarea className="input min-h-[80px]" value={taskForm.description} onChange={(e) => setTaskForm((f) => ({ ...f, description: e.target.value }))} />
            </FormField>
          </div>
          <div className="flex gap-2 justify-end pt-4">
            <button onClick={() => setTaskModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={saveTask} disabled={savingTask} className="btn-primary">{savingTask ? 'Saving...' : 'Create Task'}</button>
          </div>
        </Modal>
      )}

      {campaignModal && (
        <Modal title="Add to Campaign" onClose={() => setCampaignModal(false)}>
          <FormField label="Campaign">
            <CampaignCombobox
              options={campaignLookups}
              valueId={selectedCampaign.campaign_id}
              valueLabel={selectedCampaign.campaign_name}
              onChange={setSelectedCampaign}
              placeholder="Search or type campaign name"
            />
          </FormField>
          <div className="flex gap-2 justify-end pt-4">
            <button onClick={() => setCampaignModal(false)} className="btn-secondary">Cancel</button>
            <button
              onClick={addToCampaign}
              disabled={!(selectedCampaign.campaign_id || selectedCampaign.campaign_name?.trim()) || savingCampaign}
              className="btn-primary"
            >
              {savingCampaign ? 'Adding...' : 'Add to Campaign'}
            </button>
          </div>
        </Modal>
      )}

      <RecordNotesSidePanel
        open={!!panelRecord && showNotes}
        onClose={() => setPanelRecord(null)}
        relatedType={noteMeta.relatedType}
        recordId={panelRecord?.id}
        recordLabel={panelRecord?.label}
        moduleLabel={noteMeta.moduleLabel}
        canEdit={canEdit}
      />
    </>
  );
}
