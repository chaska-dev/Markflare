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

// PARASTI_API_TOKEN wins when present: each account has its own token and only
// sees its owner's data. The username/password path stays as a fallback for
// local runs that have not created a token yet.
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
        const projectTag = p.is_project ? ' [project]' : '';
        const parentInfo = p.parent_id ? ` (parent: ${p.parent_id})` : ' (root)';
        return `- ${icon} [${p.title}] (ID: ${p.id})${projectTag}${parentInfo}`;
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

// Tool: create_event
server.tool(
  'create_event',
  'Create a calendar event in Parasti. Times are wall-clock HH:MM strings; omit both for an all-day event.',
  {
    title: z.string().describe('Event title'),
    event_date: z.string().describe('Event date in YYYY-MM-DD format'),
    start_time: z.string().optional().describe('Start time in HH:MM (24h). Omit for an all-day event.'),
    end_time: z.string().optional().describe('End time in HH:MM (24h). Omit for an all-day event.'),
  },
  async ({ title, event_date, start_time, end_time }) => {
    try {
      const res = await apiRequest<{ event: any }>('/api/events', {
        method: 'POST',
        body: JSON.stringify({
          title,
          event_date,
          start_time: start_time?.trim() || null,
          end_time: end_time?.trim() || null,
        }),
      });

      const event = res.event;
      const time = event.start_time
        ? event.end_time
          ? `${event.start_time}-${event.end_time}`
          : event.start_time
        : 'all-day';
      return {
        content: [
          {
            type: 'text',
            text: `Created event "${event.title}" on ${event.event_date} at ${time} (ID: ${event.id})`,
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Failed to create event: ${err.message}` }],
      };
    }
  }
);

// Tool: list_events
server.tool(
  'list_events',
  'List calendar events in Parasti. Provide both from and to (YYYY-MM-DD) to filter a date range, or omit both to list every event.',
  {
    from: z.string().optional().describe('Start date of the range, inclusive, in YYYY-MM-DD format. Requires to.'),
    to: z.string().optional().describe('End date of the range, inclusive, in YYYY-MM-DD format. Requires from.'),
  },
  async ({ from, to }) => {
    try {
      const hasFrom = Boolean(from && from.trim());
      const hasTo = Boolean(to && to.trim());
      // The API rejects a range with only one bound, so ask for both instead of
      // passing through a guaranteed 400.
      if (hasFrom !== hasTo) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'Provide both "from" and "to" (YYYY-MM-DD), or omit both to list every event.' }],
        };
      }

      const query = hasFrom
        ? `?from=${encodeURIComponent(from!.trim())}&to=${encodeURIComponent(to!.trim())}`
        : '';
      const res = await apiRequest<{ events: any[] }>(`/api/events${query}`);
      const events = res.events || [];
      if (events.length === 0) {
        return {
          content: [{ type: 'text', text: 'No events found.' }],
        };
      }

      const lines = events.map((e) => {
        const time = e.start_time
          ? e.end_time
            ? `${e.start_time}-${e.end_time}`
            : e.start_time
          : 'all-day';
        return `- ${e.event_date} ${time} ${e.title} (ID: ${e.id})`;
      });

      return {
        content: [
          {
            type: 'text',
            text: `Events (${events.length}):\n${lines.join('\n')}`,
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Failed to list events: ${err.message}` }],
      };
    }
  }
);

// Tool: update_event
server.tool(
  'update_event',
  'Update a calendar event in Parasti. Replace total: semua field harus diisi. Bukan partial update.',
  {
    eventId: z.string().describe('ID of the event to update'),
    title: z.string().describe('New event title'),
    event_date: z.string().describe('New event date in YYYY-MM-DD format'),
    start_time: z.string().optional().describe('New start time in HH:MM (24h). Omit for an all-day event.'),
    end_time: z.string().optional().describe('New end time in HH:MM (24h). Omit for an all-day event.'),
  },
  async ({ eventId, title, event_date, start_time, end_time }) => {
    try {
      const res = await apiRequest<{ event: any }>(`/api/events/${encodeURIComponent(eventId)}`, {
        method: 'PUT',
        body: JSON.stringify({
          title,
          event_date,
          start_time: start_time?.trim() || null,
          end_time: end_time?.trim() || null,
        }),
      });

      const event = res.event;
      const time = event.start_time
        ? event.end_time
          ? `${event.start_time}-${event.end_time}`
          : event.start_time
        : 'all-day';
      return {
        content: [
          {
            type: 'text',
            text: `Updated event "${event.title}" on ${event.event_date} at ${time} (ID: ${event.id})`,
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Failed to update event: ${err.message}` }],
      };
    }
  }
);

// Tool: delete_event
server.tool(
  'delete_event',
  'Delete a calendar event permanently. DESTRUKTIF dan permanen. Hanya panggil setelah user mengkonfirmasi.',
  {
    eventId: z.string().describe('ID of the event to delete'),
  },
  async ({ eventId }) => {
    try {
      const res = await apiRequest<{ success: boolean; deleted: number }>(
        `/api/events/${encodeURIComponent(eventId)}`,
        { method: 'DELETE' }
      );
      return {
        content: [
          {
            type: 'text',
            text: `Deleted event ${eventId}. Response: ${JSON.stringify(res)}`,
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Failed to delete event: ${err.message}` }],
      };
    }
  }
);

// Tool: create_project
server.tool(
  'create_project',
  'Create a project in Parasti: a root page flagged as a project.',
  {
    title: z.string().describe('Project title'),
    icon: z.string().max(32).optional().describe('Optional emoji or icon, max 32 characters. Defaults to 📁.'),
  },
  async ({ title, icon }) => {
    try {
      const res = await apiRequest<{ page: any }>('/api/pages', {
        method: 'POST',
        body: JSON.stringify({
          title,
          icon: icon || '📁',
          parent_id: null,
        }),
      });

      const page = res.page;
      try {
        // POST /api/pages cannot set is_project; only PUT accepts the flag.
        await apiRequest(`/api/pages/${encodeURIComponent(page.id)}`, {
          method: 'PUT',
          body: JSON.stringify({ is_project: true }),
        });
      } catch (err: any) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Page "${page.title}" was created as a normal page (ID: ${page.id}), but marking it as a project failed: ${err.message}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `Created project "${page.title}" (ID: ${page.id})\nView at: ${config.url}/page/${page.id}`,
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Failed to create project: ${err.message}` }],
      };
    }
  }
);

// Tool: list_projects
server.tool(
  'list_projects',
  'List all projects in Parasti (root pages flagged as projects).',
  {},
  async () => {
    try {
      const res = await apiRequest<{ pages: any[] }>('/api/pages');
      const projects = (res.pages || []).filter((p) => p.is_project === true && p.parent_id === null);
      if (projects.length === 0) {
        return {
          content: [{ type: 'text', text: 'No projects found.' }],
        };
      }

      const lines = projects.map((p) => `- ${p.icon || '📁'} ${p.title} (ID: ${p.id})`);
      return {
        content: [
          {
            type: 'text',
            text: `Projects (${projects.length}):\n${lines.join('\n')}`,
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Failed to list projects: ${err.message}` }],
      };
    }
  }
);

// Tool: create_page
server.tool(
  'create_page',
  'Create an empty page in Parasti. Pass parentId to make it a sub-page of a project or private page; omit parentId for a root page.',
  {
    title: z.string().describe('Page title'),
    icon: z.string().max(32).optional().describe('Optional emoji or icon, max 32 characters.'),
    parentId: z.string().optional().describe('Optional parent page ID. Omit to create a root page.'),
  },
  async ({ title, icon, parentId }) => {
    try {
      const parent = parentId?.trim() || null;
      if (parent) {
        try {
          await apiRequest(`/api/pages/${encodeURIComponent(parent)}`);
        } catch {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: 'Parent page ID tidak ditemukan. Jalankan list_pages atau list_projects dulu untuk mengambil ID yang benar.',
              },
            ],
          };
        }
      }

      const res = await apiRequest<{ page: any }>('/api/pages', {
        method: 'POST',
        body: JSON.stringify({
          title,
          icon: icon || undefined,
          parent_id: parent,
        }),
      });

      const page = res.page;
      const location = parent ? `under parent ${parent}` : 'at root level';
      return {
        content: [
          {
            type: 'text',
            text: `Created page "${page.title}" (ID: ${page.id}) ${location}\nView at: ${config.url}/page/${page.id}`,
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Failed to create page: ${err.message}` }],
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
