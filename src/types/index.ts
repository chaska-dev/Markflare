export interface Page {
  id: string;
  title: string;
  icon: string;
  parent_id: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  // Page-level preferences and state, stored in the DB so they follow the user
  // across devices.
  is_favorite: boolean;
  full_width: boolean;
  is_project: boolean;
  // Gradient CSS string or image URL; null = no cover.
  cover: string | null;
  // Set while the page is in Trash (ISO-like UTC timestamp), otherwise null.
  deleted_at: string | null;
  children?: Page[];
}

// A row of the Trash list (GET /pages/trash): only trashed pages whose parent
// is not trashed, so a restore brings the whole subtree back.
export interface TrashedPage {
  id: string;
  title: string;
  icon: string;
  parent_id: string | null;
  deleted_at: string;
}

export type BlockType =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bullet_list'
  | 'numbered_list'
  | 'todo'
  | 'code'
  | 'quote'
  | 'divider'
  | 'callout'
  | 'image'
  | 'file'
  | 'subpage'
  | 'table'
  // 'toggle' es un alias semántico en el frontend. El backend lo trata como
  // un bloque normal (paragraph); lo especial es que al crearlo desde el slash
  // menu agregamos un hijo vacío para que el chevron sea visible de entrada.
  | 'toggle'
  | 'math';

// Free-form JSON bag stored in blocks.props. Images use width/align/caption,
// tables headerRow/headerColumn/colWidths, text blocks color; later phases will
// add more keys without touching the schema.
export interface BlockProps {
  width?: number;
  align?: 'left' | 'center' | 'right';
  caption?: string;
  // Table: first row / first column styled as a header (headerRow defaults to
  // true when missing) and the width in px of each column (missing = auto).
  headerRow?: boolean;
  headerColumn?: boolean;
  colWidths?: number[];
  // Text blocks: palette name of the text or background color, e.g. "blue" or
  // "blue_background" (see utils/blockColor.ts). Missing = default.
  color?: string;
  [key: string]: unknown;
}

export interface Block {
  id: string;
  page_id: string;
  type: BlockType;
  content: string;
  checked: boolean;
  language: string;
  position: number;
  // parent_id: id del bloque padre dentro de la misma página, o null.
  // Lo usamos para armar el árbol jerárquico del editor (markflare-style).
  parent_id: string | null;
  // collapsed: estado del chevron. true = hijos ocultos.
  collapsed: boolean;
  props: BlockProps;
  created_at: string;
  updated_at: string;
}

export interface PageWithBlocks extends Page {
  blocks: Block[];
}

export interface FileInfo {
  id: string;
  name: string;
  mime_type: string;
  size: number;
  url: string;
  page_id: string | null;
  created_at: string;
}

// Client-only state of an in-flight (or failed) file upload, keyed by block id
// in the editor. Never persisted: the block itself only stores the file id once
// the upload has finished.
export interface UploadState {
  status: 'queued' | 'uploading' | 'done' | 'error';
  // 0..1. 0 while still waiting or compressing, so the UI shows it as indeterminate.
  progress: number;
  // blob: URL of the local file for images, so the block shows the picture at once.
  previewUrl: string | null;
  fileName: string;
  fileSize: number;
  error?: string;
}

export interface BlockTypeOption {
  type: BlockType;
  // i18n keys — the consumer (SlashMenu / Block) translates with t().
  // `label` is just a fallback for cases where the caller doesn't have
  // access to LanguageContext (tests, SSR, etc.).
  labelKey: string;
  descriptionKey: string;
  icon: string;
  label: string;
  description: string;
}

export const BLOCK_TYPES: BlockTypeOption[] = [
  { type: 'paragraph', labelKey: 'slash.paragraph', descriptionKey: 'slash.paragraphDesc', icon: 'paragraph', label: 'Text', description: 'Simple text' },
  { type: 'heading1', labelKey: 'slash.heading1', descriptionKey: 'slash.heading1Desc', icon: 'heading1', label: 'Heading 1', description: 'Large heading' },
  { type: 'heading2', labelKey: 'slash.heading2', descriptionKey: 'slash.heading2Desc', icon: 'heading2', label: 'Heading 2', description: 'Medium heading' },
  { type: 'heading3', labelKey: 'slash.heading3', descriptionKey: 'slash.heading3Desc', icon: 'heading3', label: 'Heading 3', description: 'Small heading' },
  { type: 'bullet_list', labelKey: 'slash.bullet', descriptionKey: 'slash.bulletDesc', icon: 'bullet', label: 'Bullet list', description: 'Unordered list' },
  { type: 'numbered_list', labelKey: 'slash.numbered', descriptionKey: 'slash.numberedDesc', icon: 'numbered', label: 'Numbered list', description: 'Ordered list' },
  { type: 'todo', labelKey: 'slash.todo', descriptionKey: 'slash.todoDesc', icon: 'todo', label: 'To-do list', description: 'With checkboxes' },
  { type: 'code', labelKey: 'slash.code', descriptionKey: 'slash.codeDesc', icon: 'code', label: 'Code', description: 'Code block' },
  { type: 'quote', labelKey: 'slash.quote', descriptionKey: 'slash.quoteDesc', icon: 'quote', label: 'Quote', description: 'Quote block' },
  { type: 'divider', labelKey: 'slash.divider', descriptionKey: 'slash.dividerDesc', icon: 'divider', label: 'Divider', description: 'Divider line' },
  { type: 'callout', labelKey: 'slash.callout', descriptionKey: 'slash.calloutDesc', icon: 'callout', label: 'Callout', description: 'Note with icon' },
  { type: 'image' as BlockType, labelKey: 'slash.image', descriptionKey: 'slash.imageDesc', icon: 'image', label: 'Image', description: 'Upload an image' },
  { type: 'file' as BlockType, labelKey: 'slash.file', descriptionKey: 'slash.fileDesc', icon: 'file', label: 'File', description: 'Upload a file' },
  { type: 'subpage' as BlockType, labelKey: 'slash.subpage', descriptionKey: 'slash.subpageDesc', icon: 'subpage', label: 'Subpage', description: 'Create a page inside this one' },
  { type: 'table' as BlockType, labelKey: 'slash.table', descriptionKey: 'slash.tableDesc', icon: 'table', label: 'Table', description: 'Table with rows and columns' },
  { type: 'toggle' as BlockType, labelKey: 'slash.toggle', descriptionKey: 'slash.toggleDesc', icon: 'toggle', label: 'Toggle', description: 'Collapsible block with children' },
  { type: 'math' as BlockType, labelKey: 'slash.math', descriptionKey: 'slash.mathDesc', icon: 'math', label: 'Math equation', description: 'Formula with LaTeX / KaTeX' },
];

export interface SearchResult {
  id: string;
  page_id: string;
  title: string;
  icon: string;
  match_type: 'page' | 'block';
  block_type?: BlockType;
  snippet?: string;
  updated_at: string;
}
