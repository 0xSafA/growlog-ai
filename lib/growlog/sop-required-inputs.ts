/**
 * Validates `sop_definitions.required_inputs_after_execution` (array of string keys, ADR-006).
 * Photo/evidence keys are looked up in `evidence_json` first, then `measured_values`.
 */
export function parseRequiredInputKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((s) => s.trim());
}

function isEvidenceKey(key: string): boolean {
  const k = key.toLowerCase();
  return k.includes('photo') || k.includes('evidence') || k.endsWith('_image');
}

function isPresent(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return !Number.isNaN(v);
  if (typeof v === 'object') return Object.keys(v as object).length > 0;
  return true;
}

export function missingRequiredInputs(
  required: string[],
  measured: Record<string, unknown>,
  evidence: Record<string, unknown>
): string[] {
  const miss: string[] = [];
  for (const key of required) {
    if (isEvidenceKey(key)) {
      const v = evidence[key] ?? measured[key];
      if (!isPresent(v)) miss.push(key);
    } else {
      if (!isPresent(measured[key])) miss.push(key);
    }
  }
  return miss;
}
