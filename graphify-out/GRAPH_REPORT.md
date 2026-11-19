# Graph Report - Parasti  (2026-11-19)

## Corpus Check
- 106 files · ~114,371 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 14 file(s) not represented in the graph (top: .css 7, (none) 3, .ttf 3)

## Summary
- 830 nodes · 2467 edges · 44 communities (38 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c4552576`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- linkPreview.ts
- Block.tsx
- FormatToolbar.tsx
- BlockEditor.tsx
- useLanguage
- [[route]].ts
- EmbedBlock.tsx
- useBlockSelection.tsx
- Sidebar
- server/index.ts
- pages
- package.json
- App.tsx
- ipGuard.ts
- markdown.ts
- dependencies
- blockHistory.ts
- compilerOptions
- WorkspaceSettings.tsx
- Block
- db.ts
- inlineFormat.ts
- XIcon
- columns.ts
- types/index.ts
- Login.tsx
- scripts
- Sidebar.tsx
- ref_node_fs
- mcp/index.ts
- ThemeContext.tsx
- 0005_api_tokens.sql
- imageCompress.ts
- allowBuilds
- 0003_workspace.sql
- parasti
- vite
- pnpm
- css.d.ts
- linkFetch.ts
- events.ts
- ApiTokenModal.tsx
- 0008_events.sql

## God Nodes (most connected - your core abstractions)
1. `useLanguage()` - 78 edges
2. `BlockEditor()` - 66 edges
3. `react` - 56 edges
4. `base()` - 55 edges
5. `Block()` - 37 edges
6. `Sidebar()` - 33 edges
7. `XIcon()` - 32 edges
8. `Block` - 29 edges
9. `useBlockSelection()` - 26 edges
10. `DocumentIcon()` - 24 edges

## Surprising Connections (you probably didn't know these)
- `useBlockSelection()` --calls--> `blocksToMarkdown()`  [EXTRACTED]
  src/hooks/useBlockSelection.tsx → server/shared/markdown.ts
- `normalizeBlock()` --calls--> `parseBlockProps()`  [EXTRACTED]
  functions/api/[[route]].ts → server/shared/blockProps.ts
- `BlockEditor()` --calls--> `parseMarkdownToBlocks()`  [EXTRACTED]
  src/components/BlockEditor.tsx → server/shared/markdown.ts
- `App()` --calls--> `CalendarPage()`  [EXTRACTED]
  src/App.tsx → src/components/CalendarPage.tsx
- `CalendarPage()` --calls--> `ChevronRightSmallIcon()`  [EXTRACTED]
  src/components/CalendarPage.tsx → src/components/Icons.tsx

## Import Cycles
- None detected.

## Communities (44 total, 6 thin omitted)

### Community 0 - "linkPreview.ts"
Cohesion: 0.18
Nodes (17): asciiLower(), cleanText(), decodeHtmlBody(), decodeHtmlEntities(), fetchLinkPreview(), LinkPreview, LinkPreviewError, NAMED_ENTITIES (+9 more)

### Community 1 - "Block.tsx"
Cohesion: 0.06
Nodes (94): Block(), caretOnEdgeLine(), CODE_LANGUAGES, CodeBlock(), emptyRow(), ImageBlock(), MathBlock(), NOT_TEXT_BLOCKS (+86 more)

### Community 2 - "FormatToolbar.tsx"
Cohesion: 0.15
Nodes (17): TransformOption, ColorMenu(), Props, FormatToolbar(), NO_TOOLBAR, Props, readTarget(), Target (+9 more)

### Community 3 - "BlockEditor.tsx"
Cohesion: 0.14
Nodes (28): parseMarkdownToBlocks(), BlockEditor(), debounceWithFlush(), inlineFormatShortcut(), isDescendantOf(), NO_INLINE_FORMAT, NOT_TURNABLE, TURN_INTO_BY_DIGIT (+20 more)

### Community 4 - "useLanguage"
Cohesion: 0.06
Nodes (59): react, react-dom, ConfirmDialog(), Props, CoverBanner(), CoverBannerProps, PRESET_GRADIENTS, PRESET_IMAGES (+51 more)

### Community 5 - "[[route]].ts"
Cohesion: 0.09
Nodes (16): app, authMiddleware(), Bindings, INLINE_SAFE_TYPES, issueToken(), loginAttempts, onRequest, previewRequest() (+8 more)

### Community 6 - "EmbedBlock.tsx"
Cohesion: 0.10
Nodes (36): BookmarkBlock(), BookmarkCard(), EmbedBlock(), EmbedFrame(), UrlField(), PreviewStatus, PropsChange, useBookmarkPreview() (+28 more)

### Community 7 - "useBlockSelection.tsx"
Cohesion: 0.19
Nodes (22): BlockSelection, blurInside(), EMPTY, Selection, useBlockSelection(), writeClipboard(), Box, documentOrder() (+14 more)

### Community 8 - "Sidebar"
Cohesion: 0.20
Nodes (23): ApiTokenModal(), EmptyState(), hexToRgb(), IconColorPickerModal(), PRESET_COLORS_DARK, PRESET_COLORS_LIGHT, Props, rgbToHex() (+15 more)

### Community 9 - "server/index.ts"
Cohesion: 0.11
Nodes (17): AuthEnv, checkRate(), clientIp(), issueToken(), loadAuthEnv(), loginAttempts, sha256Hex(), timingSafeEqual() (+9 more)

### Community 10 - "pages"
Cohesion: 0.21
Nodes (10): blocks, idx_blocks_page, idx_blocks_position, idx_pages_parent, pages, files, idx_files_page, idx_page_shares_token (+2 more)

### Community 11 - "package.json"
Cohesion: 0.11
Nodes (24): devDependencies, @cloudflare/workers-types@^4.20240925.0, multer@^2.4.0, @types/better-sqlite3@^9.6.0, @types/express@^5.0.6, @types/multer@^2.2.0, @types/react@^18.3.5, @types/react-dom@^18.3.0 (+16 more)

### Community 12 - "App.tsx"
Cohesion: 0.10
Nodes (19): App(), ProtectedRoute(), MenuIcon(), Layout(), AuthContext, AuthContextType, AuthProvider(), useAuth() (+11 more)

### Community 13 - "ipGuard.ts"
Cohesion: 0.50
Nodes (8): blockedIPv4(), blockedIPv6(), isBlockedAddress(), isBlockedHostname(), isIpLiteral(), parseIPv4(), parseIPv6(), PRIVATE_SUFFIXES

### Community 14 - "markdown.ts"
Cohesion: 0.16
Nodes (21): blocksToMarkdown(), blockToMarkdown(), COLUMN_CONTAINERS, ExportBlock, fileHref(), imageToMarkdown(), ImportToken, isTableHeader() (+13 more)

### Community 15 - "dependencies"
Cohesion: 0.10
Nodes (20): dependencies, better-sqlite3@^12.11.1, concurrently@^10.0.5, express@^5.2.1, hono@^4.6.0, katex@^0.18.9, motion@^13.4.4, react@^18.3.1 (+12 more)

### Community 16 - "blockHistory.ts"
Cohesion: 0.22
Nodes (16): BlockHistory, useBlockHistory(), BlockPatch, Change, deepEqual(), HISTORY_CAP, HISTORY_FIELDS, HistoryField (+8 more)

### Community 17 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleDetection (+11 more)

### Community 18 - "WorkspaceSettings.tsx"
Cohesion: 0.24
Nodes (9): NotebookIcon(), Props, WORKSPACE_ICONS, WorkspaceSettings(), DEFAULT, useWorkspace(), WorkspaceConfig, WorkspaceContext (+1 more)

### Community 19 - "Block"
Cohesion: 0.15
Nodes (16): Props, UploadJob, ColumnRow(), ColumnRowColumn, Drag, Props, round(), Props (+8 more)

### Community 20 - "db.ts"
Cohesion: 0.15
Nodes (14): normalizeBlock(), DATA_DIR, db, EXPECTED_COLUMNS, healSchema(), MIGRATIONS_DIR, normalizeBlock(), normalizePage() (+6 more)

### Community 21 - "inlineFormat.ts"
Cohesion: 0.19
Nodes (18): getCaretOffset(), getCaretRect(), getSelectionOffsets(), locateOffset(), placeCaret(), setSelectionOffsets(), applyInlineFormat(), cleanLinkText() (+10 more)

### Community 22 - "XIcon"
Cohesion: 0.26
Nodes (14): addDays(), addMonths(), CalendarPage(), EventModal(), monthGrid(), pad(), parseDate(), parseView() (+6 more)

### Community 23 - "columns.ts"
Cohesion: 0.15
Nodes (15): currentValue(), makeUpdate(), applyToList(), buildRenderItems(), columnCleanup(), DropZone, dropZone(), MIN_COLUMN_FRACTION (+7 more)

### Community 24 - "types/index.ts"
Cohesion: 0.11
Nodes (30): react-router-dom, api, ApiError, request(), ChevronDownIcon(), ChevronRightIcon(), ParentChoice, Props (+22 more)

### Community 25 - "Login.tsx"
Cohesion: 0.36
Nodes (8): EyeIcon(), EyeOffIcon(), LoaderIcon(), LockIcon(), LanguageSwitcher(), Login(), Logo(), LogoProps

### Community 26 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, db:migrate:all, db:migrate:local, db:migrate:prod, deploy, dev, dev:server (+6 more)

### Community 27 - "Sidebar.tsx"
Cohesion: 0.15
Nodes (19): buildDragSubtree(), computeZone(), containsPageId(), DragState, DragStateContext, DropZone, hasDescendant(), isDescendantOf() (+11 more)

### Community 28 - "ref_node_fs"
Cohesion: 0.22
Nodes (3): loadSecret(), main(), runMcpSession()

### Community 29 - "mcp/index.ts"
Cohesion: 0.20
Nodes (8): apiRequest(), config, getAuthToken(), server, @modelcontextprotocol/sdk@^1.31.0, zod@^3.24.2, @modelcontextprotocol/sdk, zod

### Community 30 - "ThemeContext.tsx"
Cohesion: 0.40
Nodes (4): IconColorMode, Theme, ThemeContext, ThemeContextType

### Community 32 - "imageCompress.ts"
Cohesion: 0.39
Nodes (7): createSurface(), encode(), isAnimated(), OPTIMIZABLE, optimizeImage(), renameWithExtension(), Surface

### Community 33 - "allowBuilds"
Cohesion: 0.29
Nodes (6): allowBuilds, better-sqlite3, esbuild, sharp, workerd, minimumReleaseAgeExclude

### Community 36 - "parasti"
Cohesion: 0.40
Nodes (4): PARASTI_API_TOKEN, PARASTI_URL, npx, parasti

### Community 37 - "vite"
Cohesion: 0.40
Nodes (4): vite@^5.4.3, @vitejs/plugin-react@^4.3.1, vite, @vitejs/plugin-react

### Community 43 - "linkFetch.ts"
Cohesion: 0.20
Nodes (6): requestOnce(), resolvePublic(), Vetted, PREVIEW_MAX_BYTES, PREVIEW_USER_AGENT, PreviewHop

### Community 46 - "events.ts"
Cohesion: 0.47
Nodes (5): EventInput, EventValidation, isValidDate(), validateEventInput(), validateEventRange()

### Community 47 - "ApiTokenModal.tsx"
Cohesion: 0.33
Nodes (5): CLIENT_OPTIONS, ClientOption, ClientType, Props, TokenItem

## Knowledge Gaps
- **5 isolated node(s):** `PARASTI_API_TOKEN`, `PARASTI_URL`, `npx`, `RFC-5987`, `RFC-5987`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 226 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `useLanguage` to `Block.tsx`, `FormatToolbar.tsx`, `BlockEditor.tsx`, `EmbedBlock.tsx`, `useBlockSelection.tsx`, `Sidebar`, `package.json`, `App.tsx`, `ApiTokenModal.tsx`, `dependencies`, `blockHistory.ts`, `WorkspaceSettings.tsx`, `Block`, `XIcon`, `types/index.ts`, `Login.tsx`, `Sidebar.tsx`, `ThemeContext.tsx`?**
  _High betweenness centrality (0.164) - this node is a cross-community bridge._
- **What connects `PARASTI_API_TOKEN`, `PARASTI_URL`, `npx` to the rest of the system?**
  _5 weakly-connected nodes found - possible missing edges._
- **Should `Block.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05965858041329739 - nodes in this community are weakly interconnected._
- **Why does `parseMarkdownToBlocks()` connect `BlockEditor.tsx` to `server/index.ts`, `[[route]].ts`, `markdown.ts`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Should `BlockEditor.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1431451612903226 - nodes in this community are weakly interconnected._
- **Why does `useLanguage()` connect `useLanguage` to `Block.tsx`, `FormatToolbar.tsx`, `BlockEditor.tsx`, `EmbedBlock.tsx`, `useBlockSelection.tsx`, `Sidebar`, `ApiTokenModal.tsx`, `WorkspaceSettings.tsx`, `XIcon`, `types/index.ts`, `Login.tsx`, `Sidebar.tsx`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Should `useLanguage` be split into smaller, more focused modules?**
  _Cohesion score 0.059466848940533154 - nodes in this community are weakly interconnected._