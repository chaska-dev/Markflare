#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Read config from env or .dev.vars
function getEnvConfig() {
  const env = process.env;
  let url = env.PARASTI_URL || 'http://localhost:3000';
  let apiToken = env.PARASTI_API_TOKEN || env.PARASTI_TOKEN;
  let username = env.PARASTI_USERNAME || env.AUTH_USERNAME;
  let password = env.PARASTI_PASSWORD || env.AUTH_PASSWORD;

  if (!apiToken && (!username || !password)) {
    const searchPaths = [
      path.resolve(process.cwd(), '.dev.vars'),
      path.resolve(process.cwd(), '.env'),
      path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..', '.dev.vars'),
      path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..', '.env'),
    ];
    for (const p of searchPaths) {
      if (fs.existsSync(p)) {
        const text = fs.readFileSync(p, 'utf8');
        for (const line of text.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const m = trimmed.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
          if (!m) continue;
          const [, k, vRaw] = m;
          let v = vRaw.trim();
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
            v = v.slice(1, -1);
          }
          if (k === 'PARASTI_API_TOKEN' && !apiToken) apiToken = v;
          if (k === 'AUTH_USERNAME' && !username) username = v;
          if (k === 'AUTH_PASSWORD' && !password) password = v;
          if (k === 'PARASTI_URL' && env.PARASTI_URL === undefined) url = v;
        }
      }
    }
  }

  return {
    url: url.replace(/\/+$/, ''),
    apiToken: apiToken || null,
    username: username || 'admin',
    password: password || 'admin',
  };
}

const config = getEnvConfig();
let cachedToken: string | null = config.apiToken;
let tokenExpiresAt = config.apiToken ? Infinity : 0;

async function getAuthToken(): Promise<string> {
  if (config.apiToken) {
    return config.apiToken;
  }

  const now = Date.now();
  if (cachedToken && tokenExpiresAt > now + 60000) {
    return cachedToken;
  }

  const res = await fetch(`${config.url}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: config.username,
      password: config.password,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Parasti authentication failed (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { token: string; expiresAt?: number };
  cachedToken = data.token;
  tokenExpiresAt = data.expiresAt ? data.expiresAt * 1000 : now + 24 * 60 * 60 * 1000;
  return cachedToken;
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  let token = await getAuthToken();
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let res = await fetch(`${config.url}${endpoint}`, {
    ...options,
    headers,
  });

  // Retry once if token expired
  if (res.status === 401) {
    cachedToken = null;
    token = await getAuthToken();
    headers.set('Authorization', `Bearer ${token}`);
    res = await fetch(`${config.url}${endpoint}`, {
      ...options,
      headers,
    });
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Parasti API error [${res.status}] ${endpoint}: ${text}`);
  }

  return (await res.json()) as T;
}

// Create MCP server instance
const server = new McpServer({
  name: 'parasti-mcp',
  version: '1.0.0',
});

// Tool: import_markdown
server.tool(
  'import_markdown',
  'Import raw Markdown content into Parasti as a new page with parsed blocks.',
  {
    markdown: z.string().describe('The markdown content to import'),
    title: z.string().optional().describe('Optional title for the page. If omitted, will be extracted from the first # H1 header or titled "Untitled"'),
    parentId: z.string().optional().describe('Optional parent page ID to nest this page under. Omit for root level.'),
  },
  async ({ markdown, title, parentId }) => {
    try {
      const res = await apiRequest<{ page: any }>('/api/pages/import', {
        method: 'POST',
        body: JSON.stringify({
          markdown,
          title: title || undefined,
          parent_id: parentId || null,
        }),
      });

      const page = res.page;
      return {
        content: [
          {
            type: 'text',
            text: `Successfully created page "${page.title}" (ID: ${page.id}) in Parasti with ${page.blocks?.length || 0} blocks.\nView at: ${config.url}/page/${page.id}`,
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Failed to import markdown: ${err.message}` }],
      };
    }
  }
);

// Tool: import_markdown_file
server.tool(
  'import_markdown_file',
  'Read a local .md file and import it into Parasti as a new page.',
  {
    filePath: z.string().describe('Absolute or relative path to the .md file'),
    title: z.string().optional().describe('Optional title for the page. If omitted, uses the filename without extension or first header.'),
    parentId: z.string().optional().describe('Optional parent page ID to nest under. Omit for root level.'),
  },
  async ({ filePath, title, parentId }) => {
    try {
      const resolved = path.resolve(filePath);
      if (!fs.existsSync(resolved)) {
        return {
          isError: true,
          content: [{ type: 'text', text: `File not found: ${filePath}` }],
        };
      }

      const content = fs.readFileSync(resolved, 'utf8');
      const inferredTitle = title || path.basename(resolved, path.extname(resolved));

      const res = await apiRequest<{ page: any }>('/api/pages/import', {
        method: 'POST',
        body: JSON.stringify({
          markdown: content,
          title: inferredTitle,
          parent_id: parentId || null,
        }),
      });

      const page = res.page;
      return {
        content: [
          {
            type: 'text',
            text: `Successfully imported file "${path.basename(resolved)}" as page "${page.title}" (ID: ${page.id}) with ${page.blocks?.length || 0} blocks.\nView at: ${config.url}/page/${page.id}`,
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Failed to import markdown file: ${err.message}` }],
      };
    }
  }
);

// Tool: list_pages
server.tool(
  'list_pages',
  'List all pages in Parasti workspace to inspect the hierarchy and obtain page IDs.',
  {},
  async () => {
    try {
      const res = await apiRequest<{ pages: any[] }>('/api/pages');
      const pages = res.pages || [];
      if (pages.length === 0) {
        return {
          content: [{ type: 'text', text: 'No pages found in the workspace.' }],
        };
      }

      const lines = pages.map((p) => {
        const icon = p.icon || '📄';
        const parentInfo = p.parent_id ? ` (parent: ${p.parent_id})` : ' (root)';
        return `- ${icon} [${p.title}] (ID: ${p.id})${parentInfo}`;
      });

      return {
        content: [
          {
            type: 'text',
            text: `Workspace pages (${pages.length}):\n${lines.join('\n')}`,
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Failed to list pages: ${err.message}` }],
      };
    }
  }
);

// Tool: search_pages
server.tool(
  'search_pages',
  'Search for pages or block contents in Parasti.',
  {
    query: z.string().describe('Search query string'),
  },
  async ({ query }) => {
    try {
      const res = await apiRequest<{ results: any[] }>(`/api/search?q=${encodeURIComponent(query)}`);
      const results = res.results || [];
      if (results.length === 0) {
        return {
          content: [{ type: 'text', text: `No results found for "${query}".` }],
        };
      }

      const formatted = results.map((r) => {
        return `- [${r.page_title || 'Untitled'}] (Page ID: ${r.page_id})\n  Match: ${r.content || ''}`;
      });

      return {
        content: [
          {
            type: 'text',
            text: `Search results for "${query}" (${results.length}):\n\n${formatted.join('\n\n')}`,
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Failed to search pages: ${err.message}` }],
      };
    }
  }
);

// Tool: get_page
server.tool(
  'get_page',
  'Get details and blocks of a specific page by ID.',
  {
    pageId: z.string().describe('ID of the page to retrieve'),
  },
  async ({ pageId }) => {
    try {
      const res = await apiRequest<{ page: any }>(`/api/pages/${pageId}`);
      const page = res.page;
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(page, null, 2),
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Failed to get page: ${err.message}` }],
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[parasti-mcp] Server running on stdio');
}

main().catch((err) => {
  console.error('[parasti-mcp] Fatal error:', err);
  process.exit(1);
});
