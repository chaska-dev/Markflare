import { BlockProps } from '../types';

// Merge a change into a props bag; undefined removes the key.
export function mergeProps(props: BlockProps, patch: Partial<BlockProps>): BlockProps {
  const next: BlockProps = { ...props, ...patch };
  for (const key of Object.keys(next)) if (next[key] === undefined) delete next[key];
  return next;
}
