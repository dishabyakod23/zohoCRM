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

/** Matches fields on the Create Contact form */
export const CONTACT_IMPORT_FIELDS = [
  { key: 'owner_id', label: 'Contact Owner', aliases: ['owner', 'owner_id', 'owner_email', 'contact_owner'] },
  { key: 'salutation', label: 'Salutation', aliases: ['prefix', 'honorific'] },
  { key: 'first_name', label: 'First Name', aliases: ['firstname', 'first', 'givenname', 'fname'] },
  { key: 'last_name', label: 'Last Name', required: true, aliases: ['lastname', 'last', 'surname', 'lname'] },
  { key: 'email', label: 'Email', required: true, aliases: ['emailaddress', 'email_address', 'mail'] },
  { key: 'account_name', label: 'Account Name', required: true, aliases: ['account', 'company', 'organization', 'accountname', 'account_id'] },
  { key: 'phone', label: 'Phone', aliases: ['phonenumber', 'phone_number', 'telephone', 'tel'] },
  { key: 'other_phone', label: 'Other Phone', aliases: ['otherphone', 'alt_phone', 'alternate_phone'] },
  { key: 'mobile', label: 'Mobile', aliases: ['mobilephone', 'cell', 'cellphone', 'mobile_phone'] },
  { key: 'home_phone', label: 'Home Phone', aliases: ['homephone', 'home'] },
  { key: 'fax', label: 'Fax', aliases: ['faxnumber', 'fax_number'] },
  { key: 'assistant', label: 'Assistant', aliases: ['asst', 'pa'] },
  { key: 'asst_phone', label: 'Asst Phone', aliases: ['assistant_phone', 'asstphone'] },
  { key: 'lead_source', label: 'Lead Source', aliases: ['source', 'leadsource'] },
  { key: 'title', label: 'Designation', aliases: ['designation', 'jobtitle', 'job_title', 'role', 'position'] },
  { key: 'department', label: 'Department', aliases: ['dept'] },
  { key: 'date_of_birth', label: 'Date of Birth', aliases: ['dob', 'birthday', 'birth_date', 'dateofbirth'] },
  { key: 'email_opt_out', label: 'Email Opt Out', aliases: ['opt_out', 'emailoptout', 'do_not_email'] },
  { key: 'skype_id', label: 'LinkedIn', aliases: ['linkedin', 'linkedin_url', 'linkedin_profile', 'skype'] },
  { key: 'secondary_email', label: 'Secondary Email', aliases: ['alt_email', 'alternate_email', 'email2'] },
  { key: 'twitter', label: 'Twitter', aliases: ['twitter_handle', 'x', 'x_handle'] },
  { key: 'website', label: 'Website', aliases: ['web', 'url', 'homepage', 'site'] },
  { key: 'mailing_flat', label: 'Mailing Flat / Building', aliases: ['mailing_building', 'mailing_apartment'] },
  { key: 'mailing_street', label: 'Mailing Street', aliases: ['street', 'address', 'mailing_address', 'address1'] },
  { key: 'mailing_city', label: 'Mailing City', aliases: ['city', 'mailingcity'] },
  { key: 'mailing_state', label: 'Mailing State / Province', aliases: ['state', 'province', 'mailing_state'] },
  { key: 'mailing_country', label: 'Mailing Country', aliases: ['country', 'mailing_country'] },
  { key: 'mailing_zip', label: 'Mailing Zip / Postal Code', aliases: ['zip', 'postal', 'zipcode', 'mailing_zip_code', 'mailing_postal'] },
  { key: 'mailing_lat', label: 'Mailing Latitude', aliases: ['latitude', 'lat'] },
  { key: 'mailing_lng', label: 'Mailing Longitude', aliases: ['longitude', 'lng', 'lon'] },
  { key: 'other_flat', label: 'Other Flat / Building', aliases: ['other_building'] },
  { key: 'other_street', label: 'Other Street', aliases: ['other_address'] },
  { key: 'other_city', label: 'Other City', aliases: [] },
  { key: 'other_state', label: 'Other State / Province', aliases: [] },
  { key: 'other_country', label: 'Other Country', aliases: [] },
  { key: 'other_zip', label: 'Other Zip / Postal Code', aliases: ['other_postal', 'other_zip_code'] },
  { key: 'other_lat', label: 'Other Latitude', aliases: [] },
  { key: 'other_lng', label: 'Other Longitude', aliases: [] },
  { key: 'description', label: 'Description', aliases: ['notes', 'comment', 'comments'] },
];

export function getImportFields(module) {
  if (module === 'contacts') return CONTACT_IMPORT_FIELDS;
  return LEAD_IMPORT_FIELDS;
}
