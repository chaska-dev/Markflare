// Per-block properties (blocks.props): a free-form JSON object kept as text.
// Shared by both backends so the stored shape and limits can't drift.

export const MAX_PROPS_LENGTH = 4096;

// Parse what the column holds into an object. Missing, invalid or non-object
// JSON (including arrays) yields {} so the frontend can always trust the shape.
export function parseBlockProps(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'string' || raw === '') return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

// Validate a request-body value and serialize it for the column. Returns null
// when it isn't a plain object or is over MAX_PROPS_LENGTH; callers ignore the
// field in that case, like any other invalid field.
export function serializeBlockProps(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const json = JSON.stringify(value);
  return json.length <= MAX_PROPS_LENGTH ? json : null;
}
