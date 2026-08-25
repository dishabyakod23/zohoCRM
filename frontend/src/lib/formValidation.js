/** Build a message that names only the required fields that are still empty. */
export function missingRequiredMessage(fields) {
  const missing = (fields || [])
    .filter((field) => !String(field?.value ?? '').trim())
    .map((field) => field.label)
    .filter(Boolean);
  if (!missing.length) return null;
  if (missing.length === 1) return `Fill in ${missing[0]}`;
  if (missing.length === 2) return `Fill in ${missing[0]} and ${missing[1]}`;
  return `Fill in ${missing.slice(0, -1).join(', ')}, and ${missing[missing.length - 1]}`;
}
