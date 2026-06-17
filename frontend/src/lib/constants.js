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

/** Zoho-style horizontal module tabs (top navigation) */
export const MODULE_TABS = [
  { href: '/dashboard', label: 'Home', match: ['/dashboard'] },
  { href: '/contacts', label: 'Contacts', match: ['/contacts'] },
  { href: '/raw-leads', label: 'Raw Leads', match: ['/raw-leads'] },
  { href: '/leads', label: 'Leads', match: ['/leads'] },
  { href: '/qualified-leads', label: 'Qualified', match: ['/qualified-leads'] },
  { href: '/proposals', label: 'Proposals', match: ['/proposals'] },
  { href: '/accounts', label: 'Accounts', match: ['/accounts'] },
  { href: '/deals', label: 'Deals', match: ['/deals'] },
  { href: '/activities', label: 'Activities', match: ['/activities', '/tasks', '/meetings', '/calls'] },
  { href: '/campaigns', label: 'Campaigns', match: ['/campaigns'] },
  { href: '/documents', label: 'Documents', match: ['/documents'] },
  { href: '/visits', label: 'Visits', match: ['/visits'] },
  { href: '/projects', label: 'Projects', match: ['/projects'] },
  { href: '/reports', label: 'Reports', match: ['/reports'] },
];

export const MODULE_ICONS = {
  Home: '🏠', Contacts: '👤', Leads: '🎯', 'Raw Leads': '📥', Qualified: '✅', Proposals: '📝',
  Accounts: '🏢', Deals: '💰',
  Activities: '📋', Campaigns: '📣', Documents: '📄', Reports: '📊',
  Tasks: '✓', Meetings: '📅', Calls: '📞', Visits: '📍', Projects: '📁',
};

export const NAV_MODULES = [
  { href: '/dashboard', label: 'Home', section: 'main', icon: 'Home' },
  { href: '/reports', label: 'Reports', section: 'main', icon: 'Reports' },
  { href: '/contacts', label: 'Contacts', section: 'modules', icon: 'Contacts' },
  { href: '/raw-leads', label: 'Raw Leads', section: 'modules', icon: 'Raw Leads' },
  { href: '/leads', label: 'Leads', section: 'modules', icon: 'Leads' },
  { href: '/qualified-leads', label: 'Qualified Leads', section: 'modules', icon: 'Qualified' },
  { href: '/proposals', label: 'Proposals', section: 'modules', icon: 'Proposals' },
  { href: '/accounts', label: 'Accounts', section: 'modules', icon: 'Accounts' },
  { href: '/deals', label: 'Deals', section: 'modules', icon: 'Deals' },
  { href: '/activities', label: 'Activities', section: 'modules', icon: 'Activities' },
  { href: '/tasks', label: 'Tasks', section: 'modules', icon: 'Tasks', parent: 'Activities' },
  { href: '/meetings', label: 'Meetings', section: 'modules', icon: 'Meetings', parent: 'Activities' },
  { href: '/calls', label: 'Calls', section: 'modules', icon: 'Calls', parent: 'Activities' },
  { href: '/campaigns', label: 'Campaigns', section: 'modules', icon: 'Campaigns' },
  { href: '/documents', label: 'Documents', section: 'modules', icon: 'Documents' },
  { href: '/visits', label: 'Visits', section: 'modules', icon: 'Visits' },
  { href: '/projects', label: 'Projects', section: 'modules', icon: 'Projects' },
];

export const QUICK_CREATE = [
  { label: 'Lead', href: '/leads/create', group: 'Sales' },
  { label: 'Contact', href: '/contacts/create', group: 'Sales' },
  { label: 'Account', href: '/accounts/create', group: 'Sales' },
  { label: 'Deal', href: '/deals?create=1', group: 'Sales' },
  { label: 'Task', href: '/tasks?create=1', group: 'Activities' },
  { label: 'Meeting', href: '/meetings?create=1', group: 'Activities' },
  { label: 'Call', href: '/calls?create=1', group: 'Activities' },
  { label: 'Campaign', href: '/campaigns?create=1', group: 'Marketing' },
];

export const LIST_VIEWS = {
  leads: ['All Leads', 'My Leads', 'Unread Leads', 'Recently Created', 'Recently Modified'],
  contacts: ['All Contacts', 'My Contacts', 'Unread Contacts', 'Recently Created'],
  accounts: ['All Accounts', 'My Accounts', 'Recently Created'],
  deals: ['All Deals', 'My Deals', 'Open Deals', 'Closing This Month'],
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
