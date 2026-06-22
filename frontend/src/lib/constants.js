// Prefer GET /api/v1/lookups/lead-statuses (snake_case values) in leads UI
export const LEAD_STATUSES = [
  'None', 'Attempted to Contact', 'Contact in Future', 'Contacted', 'Junk Lead',
  'Lost Lead', 'Not Contacted', 'Pre-Qualified', 'Not Qualified',
];

export const LEAD_SOURCES = ['Website', 'LinkedIn', 'Cold Call', 'Referral', 'Trade Show', 'Email', 'Advertisement', 'Internal Seminar', 'Employee Referral', 'Partner', 'Other'];
export const SALUTATIONS = ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.'];
export const RATINGS = ['Hot', 'Warm', 'Cold'];
export const ACCOUNT_TYPES = ['Analyst', 'Competitor', 'Customer', 'Distributor', 'Integrator', 'Investor', 'Partner', 'Press', 'Prospect', 'Reseller'];
export const DEAL_TYPES = ['Existing Business', 'New Business'];

export const DEAL_STAGES = [
  'Qualification', 'Needs Analysis', 'Value Proposition', 'Id. Decision Makers',
  'Perception Analysis', 'Proposal / Price Quote', 'Negotiation / Review', 'Closed Won', 'Closed Lost',
];

export const TASK_STATUSES = ['Not Started', 'In Progress', 'Completed', 'Waiting for Input', 'Deferred'];
export const TASK_PRIORITIES = ['Low', 'Normal', 'High'];
export const CALL_TYPES = ['Inbound', 'Outbound'];
export const CAMPAIGN_TYPES = ['Email', 'Social', 'Webinar', 'Conference', 'Advertisement', 'Other'];
export const CAMPAIGN_STATUSES = ['Planning', 'Active', 'Inactive', 'Completed'];
export const INDUSTRIES = ['IT Services', 'E-Commerce', 'EdTech', 'Automotive', 'Finance', 'Healthcare', 'Manufacturing', 'Other'];

export const NAV_MODULES = [
  { href: '/dashboard', label: 'Home', section: 'main', icon: 'Home' },
  { href: '/work-items', label: 'Work Items', section: 'main', icon: 'Work Items' },
  { href: '/reports', label: 'Reports', section: 'main', icon: 'Reports' },
  { href: '/recycle-bin', label: 'Recycle Bin', section: 'main', icon: 'Recycle Bin' },
  { href: '/contacts', label: 'Contacts', section: 'modules', icon: 'Contacts' },
  { href: '/raw-leads', label: 'Raw Leads', section: 'modules', icon: 'Raw Leads' },
  { href: '/leads', label: 'Leads', section: 'modules', icon: 'Leads' },
  { href: '/qualified-leads', label: 'Qualified Leads', section: 'modules', icon: 'Qualified' },
  { href: '/proposals', label: 'Proposals', section: 'modules', icon: 'Proposals' },
  { href: '/accounts', label: 'Accounts', section: 'modules', icon: 'Accounts' },
  { href: '/calendar', label: 'Calendar', section: 'modules', icon: 'Calendar' },
  { href: '/campaigns', label: 'Campaigns', section: 'modules', icon: 'Campaigns' },
  { href: '/projects', label: 'Projects', section: 'modules', icon: 'Projects' },
];

export const QUICK_CREATE = [
  { label: 'Lead', href: '/leads/create', group: 'Sales' },
  { label: 'Contact', href: '/contacts/create', group: 'Sales' },
  { label: 'Account', href: '/accounts/create', group: 'Sales' },
  { label: 'Proposal', href: '/proposals/create', group: 'Sales' },
  { label: 'Calendar Event', href: '/calendar', group: 'Sales' },
  { label: 'Campaign', href: '/campaigns/create', group: 'Marketing' },
];

export const WORK_ITEM_VIEWS = ['All Work Items', 'Raw Leads', 'Leads', 'Qualified Leads', 'Proposals'];

export const LIST_VIEWS = {
  leads: ['All Leads', 'My Leads', 'Unread Leads', 'Recently Created', 'Recently Modified'],
  contacts: ['All Contacts', 'My Contacts', 'Unread Contacts', 'Recently Created'],
  accounts: ['All Accounts', 'My Accounts', 'Recently Created'],
};

import { getRolePermissions } from './roles.js';

export function canDownload(role) {
  return getRolePermissions(role).canDownload;
}

export function canEdit(role) {
  return getRolePermissions(role).canEdit;
}

export function canManageUsers(role) {
  return getRolePermissions(role).canManageUsers;
}
