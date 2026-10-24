import type { Page, PageWithBlocks, Block, BlockProps, FileInfo, SearchResult, TrashedPage } from '../types';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('auth_token');
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (res.status === 401) {
    if (!path.startsWith('/share')) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_expires_at');
      window.location.href = '/login';
    }
    throw new ApiError('Unauthorized', 401);
  }
  if (!res.ok) {
    let message = `API Error ${res.status}`;
    let data: any = null;
    try {
      data = await res.json();
      if (data && typeof data.error === 'string') message = data.error;
    } catch {
      // body wasn't JSON
    }
    throw new ApiError(message, res.status, data);
  }
  return res.json();
}

export const api = {
  auth: {
    login: (username: string, password: string) =>
      request<{ token: string; username: string; expiresAt: number }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }),
    createToken: (name?: string, expiresInDays?: number) =>
      request<{ id: string; name: string; token: string; expiresAt: number; createdAt: string }>('/auth/token', {
        method: 'POST',
        body: JSON.stringify({ name, expiresInDays }),
      }),
    listTokens: () =>
      request<{ tokens: Array<{ id: string; name: string; tokenPreview: string; createdAt: string; expiresAt: number }> }>('/auth/tokens'),
    deleteToken: (id: string) =>
      request<{ success: boolean; id: string }>(`/auth/tokens/${id}`, {
        method: 'DELETE',
      }),
  },
  files: {
    upload: async (file: File, pageId?: string): Promise<{ file: FileInfo }> => {
      const token = localStorage.getItem('auth_token');
      const formData = new FormData();
      formData.append('file', file);
      if (pageId) formData.append('page_id', pageId);
      const res = await fetch(`${API_BASE}/files/upload`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });
      if (res.status === 401) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_expires_at');
        window.location.href = '/login';
        throw new Error('Unauthorized');
      }
      if (!res.ok) {
        let message = `Upload error: ${res.status}`;
        try {
          const data: any = await res.json();
          if (data && typeof data.error === 'string') message = data.error;
        } catch { /* ignore */ }
        throw new Error(message);
      }
      return res.json();
    },
    // Same endpoint as `upload`, but through XMLHttpRequest because fetch has no
    // upload progress events. `onProgress` gets 0..1. Aborting `signal` rejects
    // with an AbortError and cancels the request.
    uploadWithProgress: (
      file: File,
      pageId: string | undefined,
      onProgress: (fraction: number) => void,
      signal?: AbortSignal
    ): Promise<{ file: FileInfo }> =>
      new Promise((resolve, reject) => {
        const abortError = () => new DOMException('Upload cancelled', 'AbortError');
        if (signal?.aborted) return reject(abortError());

        const token = localStorage.getItem('auth_token');
        const formData = new FormData();
        formData.append('file', file);
        if (pageId) formData.append('page_id', pageId);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_BASE}/files/upload`);
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total);
        };
        xhr.onload = () => {
          signal?.removeEventListener('abort', onAbort);
          if (xhr.status === 401) {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_expires_at');
            window.location.href = '/login';
            return reject(new ApiError('Unauthorized', 401));
          }
          let data: any = null;
          try { data = JSON.parse(xhr.responseText); } catch { /* body wasn't JSON */ }
          if (xhr.status >= 200 && xhr.status < 300 && data) return resolve(data);
          const message = data && typeof data.error === 'string' ? data.error : `Upload error: ${xhr.status}`;
          reject(new ApiError(message, xhr.status, data));
        };
        // status 0 marks a request that never got an HTTP answer (offline, reset).
        xhr.onerror = () => {
          signal?.removeEventListener('abort', onAbort);
          reject(new ApiError('Network error', 0));
        };
        xhr.onabort = () => reject(abortError());

        // xhr.abort() fires no event if the request never started, so reject here too.
        const onAbort = () => {
          xhr.abort();
          reject(abortError());
        };
        signal?.addEventListener('abort', onAbort, { once: true });

        xhr.send(formData);
      }),
    getUrl: (id: string) => `${API_BASE}/files/${id}`,
  },
  pages: {
    list: () => request<{ pages: Page[] }>('/pages'),
    // `includeTrashed` lets the editor open a page that is in Trash (to show
    // the restore banner); otherwise the API answers 404 for it.
    get: (id: string, opts?: { includeTrashed?: boolean }) =>
      request<{ page: PageWithBlocks }>(`/pages/${id}${opts?.includeTrashed ? '?include_trashed=1' : ''}`),
    create: (data: { title?: string; parent_id?: string | null; icon?: string }) =>
      request<{ page: Page }>('/pages', { method: 'POST', body: JSON.stringify(data) }),
    update: (
      id: string,
      data: Partial<Pick<Page, 'title' | 'icon' | 'parent_id' | 'position' | 'is_favorite' | 'full_width' | 'is_project' | 'cover'>>
    ) =>
      request<{ page: Page }>(`/pages/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    // Moves the page (and its subpages) to Trash; nothing is lost yet.
    delete: (id: string) =>
      request<{ success: boolean; deletedPages: number }>(`/pages/${id}`, { method: 'DELETE' }),
    duplicate: (id: string) =>
      request<{ page: Page; copiedBlocks: number }>(`/pages/${id}/duplicate`, { method: 'POST' }),
    trash: () => request<{ pages: TrashedPage[] }>('/pages/trash'),
    restore: (id: string) =>
      request<{ page: Page; restoredPages: number }>(`/pages/${id}/restore`, { method: 'POST' }),
    // Irreversible: removes the page, its subpages, blocks and orphaned files.
    deletePermanent: (id: string) =>
      request<{ success: boolean; deletedPages: number; deletedFiles: number }>(`/pages/${id}/permanent`, {
        method: 'DELETE',
      }),
    emptyTrash: () =>
      request<{ success: boolean; deletedPages: number; deletedFiles: number }>('/pages/trash', {
        method: 'DELETE',
      }),
    cascadeCount: (id: string) =>
      request<{ pages: number; blocks: number }>(`/pages/${id}/cascade-count`),
    export: (id: string) =>
      request<{ markdown: string; title: string }>(`/pages/${id}/export`),
    import: (data: { markdown: string; title?: string; parent_id?: string | null }) =>
      request<{ page: PageWithBlocks }>('/pages/import', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
  blocks: {
    create: (pageId: string, data: { type: string; content?: string; position: number; parent_id?: string | null; language?: string; props?: BlockProps }) =>
      request<{ block: Block }>(`/pages/${pageId}/blocks`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Pick<Block, 'content' | 'type' | 'checked' | 'language' | 'position' | 'parent_id' | 'collapsed' | 'props'>>) =>
      request<{ block: Block }>(`/blocks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/blocks/${id}`, { method: 'DELETE' }),
    reorder: (blocks: { id: string; position: number }[]) =>
      request<{ success: boolean }>('/blocks/reorder', { method: 'PUT', body: JSON.stringify({ blocks }) }),
  },
  workspace: {
    get: () => request<{ name: string; icon: string }>('/workspace'),
    update: (data: Partial<{ name: string; icon: string }>) =>
      request<{ name: string; icon: string }>('/workspace', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },
  shares: {
    // Auth-gated: manages the share of a page you own.
    // Returns null instead of throwing if the page has no active share.
    get: async (pageId: string): Promise<{ token: string; revoked: boolean; created_at: string } | null> => {
      try {
        return await request<{ token: string; revoked: boolean; created_at: string }>(`/pages/${pageId}/share`);
      } catch (err: any) {
        if (err?.status === 404 || /404|No active share/i.test(err?.message || '')) {
          return null;
        }
        throw err;
      }
    },
    create: (pageId: string) =>
      request<{ token: string; revoked: boolean; created_at: string }>(`/pages/${pageId}/share`, {
        method: 'POST',
      }),
    revoke: (pageId: string) =>
      request<{ success: boolean; changed: number }>(`/pages/${pageId}/share`, {
        method: 'DELETE',
      }),
    // Public: no auth required. The backend validates the token + that
    // pageId is a descendant of the shared root.
    publicGet: (token: string) =>
      request<{ root: Page; pages: Page[] }>(`/share/${encodeURIComponent(token)}`),
    publicGetPage: (token: string, pageId: string) =>
      request<{ page: Page; blocks: Block[] }>(
        `/share/${encodeURIComponent(token)}/page/${encodeURIComponent(pageId)}`
      ),
  },
  search: (query: string) =>
    request<{ results: SearchResult[] }>(`/search?q=${encodeURIComponent(query)}`),
};

