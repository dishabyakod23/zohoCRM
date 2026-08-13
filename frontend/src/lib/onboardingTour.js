export const ONBOARDING_RESTART_EVENT = 'crm-restart-onboarding';
export const ONBOARDING_VERSION = 'v1';

export const ONBOARDING_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to CRM',
    body: 'A quick tour of the main areas — leads, contacts, search, and shortcuts — so you know where everything lives.',
    placement: 'center',
  },
  {
    id: 'sidebar',
    target: '[data-tour="sidebar-nav"]',
    title: 'Navigation',
    body: 'The sidebar is your home base. Open Home, Work Items, Reports, and modules like Contacts, Cold Leads, Warm Leads, Qualified Leads, and Proposals.',
    placement: 'right',
  },
  {
    id: 'search',
    target: '[data-tour="header-search"]',
    title: 'Global search',
    body: 'Search leads, contacts, and accounts from any page. Results open the matching record.',
    placement: 'bottom',
  },
  {
    id: 'quick-create',
    target: '[data-tour="header-quick-create"]',
    title: 'Quick create',
    body: 'Use the + button to add cold leads, warm leads, contacts, accounts, proposals, campaigns, and calendar events without leaving your current page.',
    placement: 'bottom',
    optional: true,
  },
  {
    id: 'notifications',
    target: '[data-tour="header-notifications"]',
    title: 'Notifications',
    body: 'Meeting invites and reminders show up here so you do not miss follow-ups.',
    placement: 'bottom',
  },
  {
    id: 'settings',
    target: '[data-tour="header-settings"]',
    title: 'Settings',
    body: 'Manage your profile, preferences, and account settings.',
    placement: 'bottom',
  },
  {
    id: 'profile',
    target: '[data-tour="header-profile"]',
    title: 'Your profile',
    body: 'View your profile details or sign out from here.',
    placement: 'bottom',
  },
  {
    id: 'utility-bar',
    target: '[data-tour="bottom-utility-bar"]',
    title: 'Quick tools',
    body: 'Announcements, reminders, audit logs, accessibility options, and Help are always available at the bottom of the screen.',
    placement: 'top',
  },
  {
    id: 'finish',
    title: 'You are all set',
    body: 'Start from the Dashboard or Work Items, or use Quick Create to add your first record. You can replay this tour anytime from Settings.',
    placement: 'center',
  },
];

function storageKey(userId) {
  return `crm_onboarding_${ONBOARDING_VERSION}_${userId}`;
}

export function isOnboardingComplete(userId) {
  if (!userId || typeof window === 'undefined') return true;
  return localStorage.getItem(storageKey(userId)) === '1';
}

export function markOnboardingComplete(userId) {
  if (!userId || typeof window === 'undefined') return;
  localStorage.setItem(storageKey(userId), '1');
}

export function resetOnboarding(userId) {
  if (!userId || typeof window === 'undefined') return;
  localStorage.removeItem(storageKey(userId));
}

export function getAvailableOnboardingSteps() {
  if (typeof document === 'undefined') return ONBOARDING_STEPS;
  return ONBOARDING_STEPS.filter((step) => {
    if (!step.target) return true;
    if (step.optional && !document.querySelector(step.target)) return false;
    return Boolean(document.querySelector(step.target));
  });
}
