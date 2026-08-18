import {
  HomeIcon,
  ChartBarIcon,
  TrashIcon,
  UserGroupIcon,
  InboxArrowDownIcon,
  FunnelIcon,
  CheckBadgeIcon,
  DocumentTextIcon,
  BuildingOffice2Icon,
  BuildingLibraryIcon,
  CalendarDaysIcon,
  MegaphoneIcon,
  FolderIcon,
  ClipboardDocumentListIcon,
  PaperClipIcon,
} from '@heroicons/react/24/outline';

const ICONS = {
  Home: HomeIcon,
  'Work Items': ClipboardDocumentListIcon,
  Reports: ChartBarIcon,
  'Recycle Bin': TrashIcon,
  Contacts: UserGroupIcon,
  'Cold Leads': InboxArrowDownIcon,
  'Warm Leads': FunnelIcon,
  // Legacy icon keys (pre-rename)
  'Raw Leads': InboxArrowDownIcon,
  Leads: FunnelIcon,
  Qualified: CheckBadgeIcon,
  Proposals: DocumentTextIcon,
  Companies: BuildingLibraryIcon,
  Accounts: BuildingOffice2Icon,
  Calendar: CalendarDaysIcon,
  Campaigns: MegaphoneIcon,
  Documents: PaperClipIcon,
  Projects: FolderIcon,
};

export default function ModuleIcon({ name, className = 'w-5 h-5 shrink-0' }) {
  const Icon = ICONS[name];
  if (!Icon) {
    return (
      <span className={`inline-block rounded-full bg-current opacity-40 ${className}`} aria-hidden="true" />
    );
  }
  return <Icon className={className} aria-hidden="true" />;
}
