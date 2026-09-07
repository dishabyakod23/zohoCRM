/** Strip leading whitespace from typed form values. */
export function trimStartValue(value) {
  return typeof value === 'string' ? value.trimStart() : value;
}

/** Full trim for string fields right before API payloads / validation. */
export function trimStringFields(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const next = { ...obj };
  for (const [key, value] of Object.entries(next)) {
    if (typeof value === 'string') next[key] = value.trim();
  }
  return next;
}

/**
 * Standard create-form field setter: trims leading spaces as the user types.
 * Checkbox values are left as booleans.
 * Usage: const set = makeFieldSetter(setForm, setErrors);
 */
export function makeFieldSetter(setForm, setErrors) {
  return (field) => (e) => {
    let value;
    if (e?.target != null) {
      value = e.target.type === 'checkbox' ? e.target.checked : trimStartValue(e.target.value);
    } else {
      value = trimStartValue(e);
    }
    setForm((f) => ({ ...f, [field]: value }));
    if (setErrors) {
      setErrors((er) => (er?.[field] == null ? er : { ...er, [field]: null }));
    }
  };
}
