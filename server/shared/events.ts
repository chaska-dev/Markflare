// Shared validation for calendar events. Both backends (server/index.ts and
// functions/api/[[route]].ts) call these so their HTTP contract and the rules
// they enforce stay identical.

export interface EventInput {
  title: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
}

export type EventValidation = { error: string } | { value: EventInput };

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// A real calendar date: the regex only checks the shape, so 2025-02-30 would
// otherwise slip through. Round-tripping through Date catches that (it rolls
// over to March and the round-trip stops matching the input).
function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(`${date}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

// Validates the body of POST /events and PUT /events/:id. On success returns
// the exact values to store; title is trimmed and capped like page titles.
export function validateEventInput(body: unknown): EventValidation {
  const b = (body || {}) as Record<string, unknown>;
  const title = typeof b.title === 'string' ? b.title.trim().slice(0, 500) : '';
  if (!title) return { error: 'Title is required' };
  const date = typeof b.event_date === 'string' ? b.event_date : '';
  if (!isValidDate(date)) return { error: 'Invalid date' };
  const start = b.start_time == null || b.start_time === '' ? null : String(b.start_time);
  const end = b.end_time == null || b.end_time === '' ? null : String(b.end_time);
  if (start && !TIME_RE.test(start)) return { error: 'Invalid start time' };
  if (end && !TIME_RE.test(end)) return { error: 'Invalid end time' };
  // Strings of HH:MM compare correctly as text.
  if (start && end && end < start) return { error: 'End time is before start time' };
  return { value: { title, event_date: date, start_time: start, end_time: end } };
}

// Validates the ?from/?to range of GET /events. Empty string = absent (the
// query is optional); both bounds must be real dates and ordered.
export function validateEventRange(from: string, to: string): { error: string } | { value: { from: string; to: string } | null } {
  if (!from && !to) return { value: null };
  if (!isValidDate(from) || !isValidDate(to)) return { error: 'Invalid date range' };
  if (from > to) return { error: 'Invalid date range' };
  return { value: { from, to } };
}
