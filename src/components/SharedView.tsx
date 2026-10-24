// Read-only public view of a shared page. Selection lives in ?p=pageId so it's
// linkable and shares the browser back/forward stack. Mobile stacks the tree
// above the content. Not wrapped in AuthProvider/PageProvider; works without
// any session (the public endpoint does not validate Bearer tokens).
import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { Page, Block } from '../types';
import { buildPageTree } from '../contexts/PageContext';
import { buildRenderItems, RenderItem } from '../utils/columns';
import { DocumentIcon, ChevronDownIcon, ChevronRightIcon, LoaderIcon, NotebookIcon } from './Icons';
import { ReadOnlyBlock } from './ReadOnlyBlock';
import { ColumnRow } from './ColumnRow';
import { useLanguage } from '../i18n/LanguageContext';

interface ShareState {
  root: Page;
  pages: Page[];
}

// Blocks in reading order. A column_list is one item holding its columns, each
// with its own blocks (depth restarts at 0 inside them). Blocks whose parent is
// missing still show up, at the root.
function sharedItems(blocks: Block[]): RenderItem[] {
  return buildRenderItems(blocks, { respectCollapsed: false, includeOrphans: true });
}

function SharedItems({ items, token }: { items: RenderItem[]; token: string }) {
  return (
    <>
      {items.map(({ block, depth, columns }) => columns ? (
        <ColumnRow
          key={block.id}
          columns={columns.map(column => ({
            block: column.block,
            children: <SharedItems items={column.items} token={token} />,
          }))}
        />
      ) : (
        <div
          key={block.id}
          className="shared-block-wrapper"
          style={depth > 0 ? { paddingLeft: `${depth * 24}px` } : undefined}
        >
          <ReadOnlyBlock block={block} shareToken={token} />
        </div>
      ))}
    </>
  );
}

export function SharedView() {
  const { token } = useParams<{ token: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useLanguage();
  const selectedPageId = searchParams.get('p'); // null = root

  const [share, setShare] = useState<ShareState | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Expanded pages in the tree. Root starts expanded; selecting a page also
  // expands it so it stays visible.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Load share tree (root + flat list of descendants).
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.shares
      .publicGet(token)
      .then((data) => {
        if (cancelled) return;
        setShare(data);
        setExpanded(new Set([data.root.id]));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : t('shared.errorUnavailable'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Load blocks for the currently selected page (or root if no query param).
  useEffect(() => {
    if (!token || !share) return;
    const targetId = selectedPageId || share.root.id;
    // If targetId isn't part of this share (tampered URL), fall back to root.
    if (targetId !== share.root.id && !share.pages.find((p) => p.id === targetId)) {
      setSearchParams({}, { replace: true });
      return;
    }
    let cancelled = false;
    setBlocks([]);
    api.shares
      .publicGetPage(token, targetId)
      .then((data) => {
        if (cancelled) return;
        setBlocks(data.blocks || []);
        setExpanded((prev) => new Set(prev).add(targetId));
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('shared.errorLoading'));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, share, selectedPageId, setSearchParams]);

  if (loading) {
    return (
      <div className="shared-view-loading">
        <LoaderIcon size={20} />
        <span>{t('common.loading')}</span>
      </div>
    );
  }

  if (error || !share || !token) {
    return (
      <div className="shared-view-error">
        <div className="shared-view-error-icon">
          <DocumentIcon size={48} />
        </div>
        <div className="shared-view-error-title">{t('shared.errorUnavailable')}</div>
        <div className="shared-view-error-help">
          {error || t('shared.errorHelp')}
        </div>
      </div>
    );
  }

  const root = share.root;
  // buildPageTree gives each page a populated `children` array so the recursive
  // TreeNode below can render without re-querying. The share root may or may
  // not appear in `treeRoots` depending on whether its parent is in the set.
  const treeRoots = buildPageTree(share.pages);
  const rootNode = treeRoots.find((p) => p.id === root.id);
  const rootChildren = rootNode?.children ?? [];

  const currentPage =
    share.pages.find((p) => p.id === selectedPageId) || root;

  const selectPage = (id: string) => {
    if (id === root.id) {
      setSearchParams({});
    } else {
      setSearchParams({ p: id });
    }
  };

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="shared-view">
      <header className="shared-view-header">
        <div className="shared-view-header-left">
          <NotebookIcon size={18} />
          <span className="shared-view-header-icon">{root.icon || '📄'}</span>
          <span className="shared-view-header-title">
            {root.title || t('page.titlePlaceholder')}
          </span>
          <span className="shared-view-header-badge">{t('shared.publicView')}</span>
        </div>
      </header>

      <div className="shared-view-body">
        <aside className="shared-view-tree" aria-label={t('shared.treeAria')}>
          <TreeNode
            node={{ ...root, children: rootChildren } as Page}
            expanded={expanded}
            selectedId={currentPage.id}
            onSelect={selectPage}
            onToggle={toggleExpanded}
            depth={0}
            isRoot
          />
        </aside>

        <main className="shared-view-content" aria-label={t('shared.contentAria')}>
          <div className="shared-view-page">
            <div className="shared-view-page-icon">{currentPage.icon || '📄'}</div>
            <h1 className="shared-view-page-title">
              {currentPage.title || t('page.titlePlaceholder')}
            </h1>
            <div className="shared-view-blocks">
              {blocks.length === 0 ? (
                <div className="shared-view-empty">{t('shared.emptyPage')}</div>
              ) : (
                <SharedItems items={sharedItems(blocks)} token={token} />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// Recursive tree node. Receives the page object with its `children` array
// already populated (from buildPageTree). Render-only: no drag, no context
// menu, just expand/collapse and selection.
interface TreeNodeProps {
  node: Page;
  expanded: Set<string>;
  selectedId: string;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  depth: number;
  isRoot?: boolean;
}

function TreeNode({
  node,
  expanded,
  selectedId,
  onSelect,
  onToggle,
  depth,
  isRoot,
}: TreeNodeProps) {
  const { t } = useLanguage();
  const isExpanded = expanded.has(node.id);
  const children = node.children ?? [];
  const hasChildren = children.length > 0;
  const isSelected = node.id === selectedId;

  return (
    <div className="shared-tree-node">
      <div
        className={`shared-tree-row${isSelected ? ' selected' : ''}`}
        style={{ paddingLeft: 8 + depth * 16 }}
      >
        <button
          className="shared-tree-chevron"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggle(node.id);
          }}
          aria-label={isExpanded ? t('shared.collapse') : t('shared.expand')}
          tabIndex={hasChildren ? 0 : -1}
          style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
        >
          {isExpanded ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />}
        </button>
        <button
          className="shared-tree-label"
          onClick={() => onSelect(node.id)}
          title={node.title || t('page.titlePlaceholder')}
        >
          <span className="shared-tree-icon">{node.icon || <DocumentIcon size={14} />}</span>
          <span className="shared-tree-title">{node.title || t('page.titlePlaceholder')}</span>
          {isRoot && <span className="shared-tree-root-badge">{t('shared.home')}</span>}
        </button>
      </div>
      {hasChildren && isExpanded && (
        <div className="shared-tree-children">
          {children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              expanded={expanded}
              selectedId={selectedId}
              onSelect={onSelect}
              onToggle={onToggle}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
