/** CRM import field definitions with labels and header aliases for auto-mapping */

export const LEAD_IMPORT_FIELDS = [
  { key: 'first_name', label: 'First Name', required: true, aliases: ['firstname', 'first', 'givenname', 'given_name', 'fname'] },
  { key: 'last_name', label: 'Last Name', required: true, aliases: ['lastname', 'last', 'surname', 'familyname', 'lname'] },
  { key: 'company', label: 'Company', required: true, aliases: ['organization', 'organisation', 'org', 'account', 'companyname', 'account_name'] },
  { key: 'email', label: 'Email', required: true, aliases: ['emailaddress', 'email_address', 'mail', 'e_mail'] },
  { key: 'phone', label: 'Phone', aliases: ['phonenumber', 'phone_number', 'telephone', 'tel', 'workphone', 'work_phone'] },
  { key: 'mobile', label: 'Mobile', aliases: ['mobilephone', 'mobile_phone', 'cell', 'cellphone'] },
  { key: 'owner_id', label: 'Owner', aliases: ['owner', 'owner_id', 'owner_email', 'lead_owner'] },
  { key: 'lead_status', label: 'Lead Status', aliases: ['status', 'lead_status', 'lead status'] },
  { key: 'title', label: 'Title / Designation', aliases: ['designation', 'jobtitle', 'job_title', 'role', 'position'] },
  { key: 'lead_source', label: 'Lead Source', aliases: ['source', 'leadsource'] },
  { key: 'industry', label: 'Industry', aliases: [] },
  { key: 'description', label: 'Description', aliases: ['notes', 'comment', 'comments'] },
];

export const CONTACT_IMPORT_FIELDS = [
  { key: 'first_name', label: 'First Name', aliases: ['firstname', 'first', 'givenname', 'fname'] },
  { key: 'last_name', label: 'Last Name', required: true, aliases: ['lastname', 'last', 'surname', 'lname'] },
  { key: 'email', label: 'Email', required: true, aliases: ['emailaddress', 'email_address', 'mail'] },
  { key: 'phone', label: 'Phone', aliases: ['phonenumber', 'phone_number', 'telephone', 'tel'] },
  { key: 'mobile', label: 'Mobile', aliases: ['mobilephone', 'cell', 'cellphone'] },
  { key: 'account_name', label: 'Account Name', required: true, aliases: ['account', 'company', 'organization', 'accountname'] },
  { key: 'title', label: 'Title / Designation', aliases: ['designation', 'jobtitle', 'job_title', 'role'] },
  { key: 'department', label: 'Department', aliases: ['dept'] },
  { key: 'lead_source', label: 'Lead Source', aliases: ['source'] },
];

export function getImportFields(module) {
  if (module === 'contacts') return CONTACT_IMPORT_FIELDS;
  return LEAD_IMPORT_FIELDS;
}
