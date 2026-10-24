import { useCallback, useEffect, useRef, useState } from 'react';
import { Block, BlockProps, BookmarkPreview } from '../types';
import { api } from '../api/client';
import { blockUrl, readPreview } from '../utils/bookmark';
import { mergeProps } from '../utils/blockProps';

export type PreviewStatus = 'idle' | 'loading' | 'error';

type PropsChange = (id: string, props: BlockProps, options?: { record?: boolean }) => void;

// Keeps a bookmark block's props.preview in step with its URL. The editor
// fetches the metadata once per URL (the server does the request, see
// /api/link-preview) and stores it in the block, so reopening the page, and the
// public share view, render the card without any request. It fetches again only
// when the URL changed or `refresh` is called (the "Refresh preview" menu item).
//
// The automatic fill is a cache write, not an edit of the user's: it is saved
// but kept out of undo history (record: false), otherwise Ctrl+Z right after
// pasting a link would only wipe the preview, and the next fill would then
// discard the redo stack. Refresh is a user action and is recorded.
export function useBookmarkPreview(block: Block, onPropsChange: PropsChange | undefined, enabled: boolean) {
  const [status, setStatus] = useState<PreviewStatus>('idle');
  const url = enabled ? blockUrl(block.content) : null;
  const cached = url ? readPreview(block.props, url) : null;
  const hasCache = cached !== null;

  // Always the latest block, for the async result to build on.
  const latest = useRef({ block, onPropsChange, url });
  latest.current = { block, onPropsChange, url };
  // URLs already tried by this mounted block, so a failing page isn't retried on
  // every render. A failure isn't stored: the next time the page opens retries.
  const tried = useRef(new Set<string>());
  const seq = useRef(0);

  const load = useCallback((target: string, record: boolean) => {
    const mine = ++seq.current;
    tried.current.add(target);
    setStatus('loading');
    api.linkPreview(target).then(res => {
      if (mine !== seq.current) return;
      const { block: current, onPropsChange: save, url: currentUrl } = latest.current;
      // The URL was edited while the page was loading.
      if (currentUrl !== target) return;
      const preview: BookmarkPreview = {
        url: target,
        title: res.title,
        description: res.description,
        image: res.image,
        siteName: res.siteName,
        favicon: res.favicon,
        fetchedAt: new Date().toISOString(),
      };
      save?.(current.id, mergeProps(current.props ?? {}, { preview }), { record });
      setStatus('idle');
    }).catch(() => {
      if (mine === seq.current) setStatus('error');
    });
  }, []);

  useEffect(() => {
    if (url && !hasCache && !tried.current.has(url)) load(url, false);
  }, [url, hasCache, load]);

  // A pending request must not report back after the block is gone. Clearing
  // `tried` too means a remount (StrictMode's mount, cleanup, mount, or a block
  // that remounts mid-request) starts the fetch again instead of waiting for a
  // result that was already discarded.
  useEffect(() => () => {
    seq.current++;
    tried.current.clear();
  }, []);

  const refresh = useCallback(() => {
    const target = latest.current.url;
    if (target) load(target, true);
  }, [load]);

  // Nothing cached yet counts as loading from the first render, before the effect
  // above has started the request.
  let shown: PreviewStatus = status;
  if (!url) shown = 'idle';
  else if (!cached && status === 'idle') shown = 'loading';
  else if (cached && status === 'error') shown = 'idle';

  return { preview: cached, status: shown, refresh };
}
