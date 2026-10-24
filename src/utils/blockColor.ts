import type { BlockType } from '../types';

// Block colors (Notion's "Color" menu), stored in props.color as a palette name:
// "red" colors the text, "red_background" the block's background, "default"
// (or nothing) leaves it alone. The values live in CSS (see editor.css): the
// name only ends up in a data-color attribute, so it has to be one of these.
export const COLOR_NAMES = [
  'gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red',
] as const;

export type ColorName = (typeof COLOR_NAMES)[number];

const VALID = new Set<string>([
  ...COLOR_NAMES,
  ...COLOR_NAMES.map(name => `${name}_background`),
]);

// Block types the color applies to: the ones that hold plain text.
const COLORABLE_TYPES: BlockType[] = [
  'paragraph', 'heading1', 'heading2', 'heading3', 'bullet_list', 'numbered_list',
  'todo', 'toggle', 'quote', 'callout',
];

export function isColorable(type: BlockType): boolean {
  return COLORABLE_TYPES.includes(type);
}

// The color to render for a block: a palette name, or undefined for the default
// look (also for names that are not in the palette, e.g. from a newer client).
export function blockColor(type: BlockType, props: { color?: unknown } | undefined): string | undefined {
  const color = props?.color;
  return isColorable(type) && typeof color === 'string' && VALID.has(color) ? color : undefined;
}
