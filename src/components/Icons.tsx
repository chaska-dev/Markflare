import React from 'react';
import { motion, type SVGMotionProps } from 'motion/react';

// Interactive animated icons (Lucide + motion). Respond to hover with soft
// micro-interactions and spring physics. Inherit the color from --icon-color
// (pure white in dark mode, pure black in light mode, or a custom RGB color).

export type IconProps = SVGMotionProps<SVGSVGElement> & { size?: number };

const base = (size: number): SVGMotionProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'var(--icon-color, currentColor)',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
});

const springTransition = { type: 'spring' as const, stiffness: 350, damping: 20 };

export function DownloadIcon({ size = 16, className = '', ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      className={`icon-download ${className}`.trim()}
      whileHover={{ y: 2 }}
      transition={springTransition}
      {...rest}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </motion.svg>
  );
}

export function UploadIcon({ size = 16, className = '', ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      className={`icon-upload ${className}`.trim()}
      whileHover={{ y: -2 }}
      transition={springTransition}
      {...rest}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </motion.svg>
  );
}

export function PlusIcon({ size = 16, className = '', ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      className={`icon-plus ${className}`.trim()}
      whileHover={{ rotate: 90 }}
      transition={{ type: 'spring', stiffness: 300, damping: 15 }}
      {...rest}
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </motion.svg>
  );
}

export function LinkIcon({ size = 16, className = '', ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      className={`icon-link ${className}`.trim()}
      whileHover={{ scale: 1.1, rotate: -5 }}
      transition={springTransition}
      {...rest}
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </motion.svg>
  );
}

export function DocumentIcon({ size = 16, className = '', ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      className={`icon-document ${className}`.trim()}
      whileHover={{ scale: 1.1, rotate: -2 }}
      transition={springTransition}
      {...rest}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="14" y2="17" />
    </motion.svg>
  );
}

export function ChevronDownIcon({ size = 16, className = '', ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      className={`icon-chevron-down ${className}`.trim()}
      whileHover={{ y: 2 }}
      transition={springTransition}
      {...rest}
    >
      <polyline points="6 9 12 15 18 9" />
    </motion.svg>
  );
}

export function ChevronLeftIcon({ size = 16, className = '', ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      className={`icon-chevron-left ${className}`.trim()}
      whileHover={{ x: -2 }}
      transition={springTransition}
      {...rest}
    >
      <polyline points="15 18 9 12 15 6" />
    </motion.svg>
  );
}

export function ChevronRightIcon({ size = 16, className = '', ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      className={`icon-chevron-right ${className}`.trim()}
      whileHover={{ x: 2 }}
      transition={springTransition}
      {...rest}
    >
      <polyline points="9 18 15 12 9 6" />
    </motion.svg>
  );
}

export function XIcon({ size = 16, className = '', ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      className={`icon-x ${className}`.trim()}
      whileHover={{ rotate: 90, scale: 1.1 }}
      transition={springTransition}
      {...rest}
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </motion.svg>
  );
}

export function MenuIcon({ size = 16, ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      whileHover={{ scale: 1.08 }}
      transition={springTransition}
      {...rest}
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </motion.svg>
  );
}

export function AlertTriangleIcon({ size = 16, ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      whileHover={{ rotate: [-3, 3, -3, 0] }}
      transition={{ duration: 0.3 }}
      {...rest}
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </motion.svg>
  );
}

export function TrashIcon({ size = 16, className = '', ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      className={`icon-trash ${className}`.trim()}
      whileHover={{ rotate: [-5, 5, 0], scale: 1.1 }}
      transition={springTransition}
      {...rest}
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </motion.svg>
  );
}

export function MoreHorizontalIcon({ size = 16, className = '', ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      className={`icon-more ${className}`.trim()}
      whileHover={{ scale: 1.2 }}
      transition={springTransition}
      {...rest}
    >
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </motion.svg>
  );
}

export function LightbulbIcon({ size = 16, className = '', ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      className={`icon-lightbulb ${className}`.trim()}
      whileHover={{ scale: 1.15 }}
      transition={springTransition}
      {...rest}
    >
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M12 2a7 7 0 0 0-4 12.7c.8.7 1.5 1.5 1.5 2.3v1h5v-1c0-.8.7-1.6 1.5-2.3A7 7 0 0 0 12 2z" />
    </motion.svg>
  );
}

export function PaperclipIcon({ size = 16, ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      whileHover={{ rotate: 15, scale: 1.1 }}
      transition={springTransition}
      {...rest}
    >
      <path d="M21.4 11.05l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" />
    </motion.svg>
  );
}

export function ArrowUpRightIcon({ size = 14, ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      whileHover={{ x: 2, y: -2 }}
      transition={springTransition}
      {...rest}
    >
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </motion.svg>
  );
}

export function NotebookIcon({ size = 16, ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      whileHover={{ scale: 1.1, rotate: -2 }}
      transition={springTransition}
      {...rest}
    >
      <path d="M4 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <path d="M9 2v20" />
      <path d="M13 8h3M13 12h3M13 16h3" />
    </motion.svg>
  );
}

export function UserIcon({ size = 16, ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      whileHover={{ scale: 1.12, y: -1 }}
      transition={springTransition}
      {...rest}
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </motion.svg>
  );
}

export function LogOutIcon({ size = 16, className = '', ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      className={`icon-logout ${className}`.trim()}
      whileHover={{ x: 2 }}
      transition={springTransition}
      {...rest}
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </motion.svg>
  );
}

export function HeadingIcon({ size = 16, ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      whileHover={{ scale: 1.1 }}
      transition={springTransition}
      {...rest}
    >
      <path d="M6 4v16M18 4v16M6 12h12" />
    </motion.svg>
  );
}

export function TextIcon({ size = 16, ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      whileHover={{ scale: 1.1 }}
      transition={springTransition}
      {...rest}
    >
      <line x1="17" y1="10" x2="3" y2="10" />
      <line x1="21" y1="6" x2="3" y2="6" />
      <line x1="21" y1="14" x2="3" y2="14" />
      <line x1="17" y1="18" x2="3" y2="18" />
    </motion.svg>
  );
}

export function ImageIcon({ size = 16, ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      whileHover={{ scale: 1.1, rotate: 2 }}
      transition={springTransition}
      {...rest}
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </motion.svg>
  );
}

export function TableIcon({ size = 16, ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      whileHover={{ scale: 1.08 }}
      transition={springTransition}
      {...rest}
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </motion.svg>
  );
}

export function ColumnsIcon({ size = 16, ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      whileHover={{ scale: 1.08 }}
      transition={springTransition}
      {...rest}
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="12" y1="3" x2="12" y2="21" />
    </motion.svg>
  );
}

export function DividerIcon({ size = 16, ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      whileHover={{ scaleX: 1.15 }}
      transition={springTransition}
      {...rest}
    >
      <line x1="3" y1="12" x2="21" y2="12" />
    </motion.svg>
  );
}

export function QuoteIcon({ size = 16, ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      whileHover={{ scale: 1.1 }}
      transition={springTransition}
      {...rest}
    >
      <path d="M3 21c3 0 7-1 7-8V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h3" />
      <path d="M14 21c3 0 7-1 7-8V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h3" />
    </motion.svg>
  );
}

export function CodeIcon({ size = 16, ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      whileHover={{ scale: 1.12 }}
      transition={springTransition}
      {...rest}
    >
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </motion.svg>
  );
}

export function CheckSquareIcon({ size = 16, ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      whileHover={{ scale: 1.1 }}
      transition={springTransition}
      {...rest}
    >
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </motion.svg>
  );
}

export function ListBulletIcon({ size = 16, ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      whileHover={{ scale: 1.1 }}
      transition={springTransition}
      {...rest}
    >
      <line x1="9" y1="6" x2="20" y2="6" />
      <line x1="9" y1="12" x2="20" y2="12" />
      <line x1="9" y1="18" x2="20" y2="18" />
      <circle cx="4" cy="6" r="1" fill="var(--icon-color, currentColor)" />
      <circle cx="4" cy="12" r="1" fill="var(--icon-color, currentColor)" />
      <circle cx="4" cy="18" r="1" fill="var(--icon-color, currentColor)" />
    </motion.svg>
  );
}

export function ListOrderedIcon({ size = 16, ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      whileHover={{ scale: 1.1 }}
      transition={springTransition}
      {...rest}
    >
      <line x1="10" y1="6" x2="21" y2="6" />
      <line x1="10" y1="12" x2="21" y2="12" />
      <line x1="10" y1="18" x2="21" y2="18" />
      <path d="M4 6h1v4" />
      <path d="M4 10h2" />
      <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
    </motion.svg>
  );
}

export function ChevronRightSmallIcon({ size = 16, className = '', ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      className={`icon-chevron-right-small ${className}`.trim()}
      whileHover={{ x: 2 }}
      transition={springTransition}
      {...rest}
    >
      <polyline points="9 6 15 12 9 18" />
    </motion.svg>
  );
}

export function ShareIcon({ size = 16, className = '', ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      className={`icon-share ${className}`.trim()}
      whileHover={{ scale: 1.12, rotate: 6 }}
      transition={springTransition}
      {...rest}
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </motion.svg>
  );
}

export function CopyIcon({ size = 16, className = '', ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      className={`icon-copy ${className}`.trim()}
      whileHover={{ scale: 1.12, x: 1, y: -1 }}
      transition={springTransition}
      {...rest}
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </motion.svg>
  );
}

export function CheckIcon({ size = 16, className = '', ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      className={`icon-check ${className}`.trim()}
      initial={{ scale: 0.8 }}
      animate={{ scale: 1 }}
      whileHover={{ scale: 1.2 }}
      transition={springTransition}
      {...rest}
    >
      <polyline points="20 6 9 17 4 12" />
    </motion.svg>
  );
}

export function EyeIcon({ size = 16, className = '', ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      className={`icon-eye ${className}`.trim()}
      whileHover={{ scale: 1.12 }}
      transition={springTransition}
      {...rest}
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </motion.svg>
  );
}

export function GlobeIcon({ size = 16, className = '', ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      className={`icon-globe ${className}`.trim()}
      whileHover={{ rotate: 180 }}
      transition={{ duration: 0.5 }}
      {...rest}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </motion.svg>
  );
}

export function LoaderIcon({ size = 16, ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
      {...rest}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </motion.svg>
  );
}

export function MathIcon({ size = 16, ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      whileHover={{ scale: 1.1 }}
      transition={springTransition}
      {...rest}
    >
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="9" y1="7" x2="9" y2="18" />
      <path d="M15 7v8a3 3 0 0 0 3 3" />
    </motion.svg>
  );
}

export function BookmarkIcon({ size = 16, ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      whileHover={{ y: -1.5 }}
      transition={springTransition}
      {...rest}
    >
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
    </motion.svg>
  );
}

export function EmbedIcon({ size = 16, ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      whileHover={{ scale: 1.08 }}
      transition={springTransition}
      {...rest}
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <polygon points="10 9 15 12 10 15 10 9" />
    </motion.svg>
  );
}

export function RefreshIcon({ size = 16, ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      whileHover={{ rotate: 90 }}
      transition={springTransition}
      {...rest}
    >
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
      <path d="M21 3v5h-5" />
    </motion.svg>
  );
}

export function SearchIcon({ size = 16, className = '', ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      className={`icon-search ${className}`.trim()}
      whileHover={{ scale: 1.15, rotate: 8 }}
      transition={springTransition}
      {...rest}
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </motion.svg>
  );
}

export function SunIcon({ size = 16, className = '', ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      className={`icon-sun ${className}`.trim()}
      whileHover={{ rotate: 90 }}
      transition={{ type: 'spring', stiffness: 200, damping: 10 }}
      {...rest}
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </motion.svg>
  );
}

export function MoonIcon({ size = 16, className = '', ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      className={`icon-moon ${className}`.trim()}
      whileHover={{ rotate: -20, scale: 1.1 }}
      transition={{ type: 'spring', stiffness: 250, damping: 12 }}
      {...rest}
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </motion.svg>
  );
}

export function SettingsIcon({ size = 16, className = '', ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      className={`icon-settings ${className}`.trim()}
      whileHover={{ rotate: 90 }}
      transition={{ type: 'spring', stiffness: 200, damping: 10 }}
      {...rest}
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </motion.svg>
  );
}

export function PaletteIcon({ size = 16, className = '', ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      className={`icon-palette ${className}`.trim()}
      whileHover={{ rotate: 18, scale: 1.12 }}
      transition={{ type: 'spring', stiffness: 300, damping: 15 }}
      {...rest}
    >
      <circle cx="13.5" cy="6.5" r=".5" fill="var(--icon-color, currentColor)" />
      <circle cx="17.5" cy="10.5" r=".5" fill="var(--icon-color, currentColor)" />
      <circle cx="8.5" cy="7.5" r=".5" fill="var(--icon-color, currentColor)" />
      <circle cx="6.5" cy="12.5" r=".5" fill="var(--icon-color, currentColor)" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.563-2.512 5.563-5.563C22 6.5 17.5 2 12 2z" />
    </motion.svg>
  );
}

export function LockIcon({ size = 16, ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      whileHover={{ scale: 1.1 }}
      transition={springTransition}
      {...rest}
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </motion.svg>
  );
}

export function EyeOffIcon({ size = 16, ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      whileHover={{ scale: 1.1 }}
      transition={springTransition}
      {...rest}
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </motion.svg>
  );
}

export function KeyIcon({ size = 16, className = '', ...rest }: IconProps) {
  return (
    <motion.svg
      {...base(size)}
      className={`icon-key ${className}`.trim()}
      whileHover={{ rotate: 15 }}
      transition={springTransition}
      {...rest}
    >
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="m21 2-9.6 9.6" />
      <path d="m15.5 7.5 3 3L22 7l-3-3" />
    </motion.svg>
  );
}

export function AlignLeftIcon({ size = 16, ...rest }: IconProps) {
  return (
    <motion.svg {...base(size)} {...rest}>
      <line x1="21" y1="6" x2="3" y2="6" />
      <line x1="15" y1="12" x2="3" y2="12" />
      <line x1="17" y1="18" x2="3" y2="18" />
    </motion.svg>
  );
}

export function AlignCenterIcon({ size = 16, ...rest }: IconProps) {
  return (
    <motion.svg {...base(size)} {...rest}>
      <line x1="21" y1="6" x2="3" y2="6" />
      <line x1="17" y1="12" x2="7" y2="12" />
      <line x1="19" y1="18" x2="5" y2="18" />
    </motion.svg>
  );
}

export function AlignRightIcon({ size = 16, ...rest }: IconProps) {
  return (
    <motion.svg {...base(size)} {...rest}>
      <line x1="21" y1="6" x2="3" y2="6" />
      <line x1="21" y1="12" x2="9" y2="12" />
      <line x1="21" y1="18" x2="7" y2="18" />
    </motion.svg>
  );
}

export function CaptionIcon({ size = 16, ...rest }: IconProps) {
  return (
    <motion.svg {...base(size)} {...rest}>
      <rect x="3" y="3" width="18" height="12" rx="2" ry="2" />
      <line x1="7" y1="19" x2="17" y2="19" />
    </motion.svg>
  );
}
