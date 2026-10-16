// Shared constants and small helpers for file uploads.

// Same cap the backends enforce (MAX_UPLOAD_BYTES there). Checked client-side
// first so an oversized file fails instantly instead of after a long transfer.
export const MAX_UPLOAD_MB = 25;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

// How many files are sent at once when a batch is dropped or pasted. More than
// a few parallel transfers just split the bandwidth and delay the first one.
export const MAX_PARALLEL_UPLOADS = 3;

// Runs async tasks with at most `max` in flight; the rest wait in FIFO order.
export function createLimiter(max: number) {
  let active = 0;
  const waiting: Array<() => void> = [];

  const pump = () => {
    while (active < max && waiting.length > 0) {
      active++;
      waiting.shift()!();
    }
  };

  return <T>(task: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      waiting.push(() => {
        task().then(resolve, reject).finally(() => {
          active--;
          pump();
        });
      });
      pump();
    });
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}
