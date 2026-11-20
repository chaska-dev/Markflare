import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

// The cleanup calls below go straight to the REST API (there is no delete-page
// MCP tool). Resolve the same local configuration the MCP server uses.
function readDevVars(): Record<string, string> {
  const file = path.resolve(process.cwd(), '.dev.vars');
  if (!fs.existsSync(file)) return {};

  const values: Record<string, string> = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.trim().match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[m[1]] = value;
  }
  return values;
}

function getApiConfig() {
  const devVars = readDevVars();
  return {
    url: (process.env.PARASTI_URL || devVars.PARASTI_URL || 'http://localhost:3000').replace(/\/+$/, ''),
    token: process.env.PARASTI_API_TOKEN || process.env.PARASTI_TOKEN || devVars.PARASTI_API_TOKEN || null,
    username: process.env.PARASTI_USERNAME || process.env.AUTH_USERNAME || devVars.AUTH_USERNAME || 'admin',
    password: process.env.PARASTI_PASSWORD || process.env.AUTH_PASSWORD || devVars.AUTH_PASSWORD || 'admin',
  };
}

async function getApiToken(): Promise<string> {
  const cfg = getApiConfig();
  if (cfg.token) return cfg.token;

  const res = await fetch(`${cfg.url}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: cfg.username, password: cfg.password }),
  });
  if (!res.ok) {
    throw new Error(`Cleanup login failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { token: string };
  return data.token;
}

async function deletePagePermanently(pageId: string): Promise<void> {
  const cfg = getApiConfig();
  const token = await getApiToken();
  const res = await fetch(`${cfg.url}/api/pages/${encodeURIComponent(pageId)}/permanent`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Cleanup failed for page ${pageId} (${res.status}): ${await res.text()}`);
  }
}

// Local calendar date as YYYY-MM-DD. toISOString() would shift the day for
// users east or west of UTC, so build it from the local parts.
function localDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function extractId(text: string): string | null {
  const match = text.match(/ID: ([0-9a-fA-F-]+)/);
  return match ? match[1] : null;
}

// Helper to communicate with the MCP server over stdio
async function runMcpSession() {
  console.log('Starting Parasti MCP test suite...\n');

  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const child = spawn(npxCmd, ['tsx', 'mcp/index.ts'], {
    cwd: process.cwd(),
    stdio: ['pipe', 'pipe', 'inherit'],
    shell: true,
  });

  let messageId = 1;
  const pendingRequests = new Map<number, (res: any) => void>();
  let buffer = '';

  child.stdout.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const json = JSON.parse(line);
        if (json.id && pendingRequests.has(json.id)) {
          const resolve = pendingRequests.get(json.id)!;
          pendingRequests.delete(json.id);
          resolve(json);
        }
      } catch (e) {
        // ignore
      }
    }
  });

  function sendRequest(method: string, params: any = {}): Promise<any> {
    const id = messageId++;
    return new Promise((resolve) => {
      pendingRequests.set(id, resolve);
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  }

  function sendNotification(method: string, params: any = {}) {
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
  }

  async function callTool(name: string, args: any = {}): Promise<string> {
    const res = await sendRequest('tools/call', { name, arguments: args });
    const result = res.result;
    const text = result?.content?.[0]?.text || '';
    if (!result) throw new Error(`${name} returned no result`);
    if (result.isError) throw new Error(`${name} failed: ${text}`);
    return text;
  }

  // Pages created by this run are removed at the end via the REST API.
  const createdPageIds: string[] = [];

  // 1. Initialize
  const initRes = await sendRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test-suite', version: '1.0.0' },
  });
  console.log('[1/14] MCP server initialized:', initRes.result.serverInfo.name, 'v' + initRes.result.serverInfo.version);
  sendNotification('notifications/initialized');

  // 2. list_pages
  const listRes = await sendRequest('tools/call', {
    name: 'list_pages',
    arguments: {},
  });
  console.log('[2/14] list_pages executed successfully.');
  console.log('Current workspace pages:');
  console.log(listRes.result.content[0].text.split('\n').map((l: string) => '     ' + l).join('\n'));

  // 3. import_markdown with rich content
  console.log('\n[3/14] Creating rich page with H1, H2, table, code, tasks, and quotes...');
  const richMarkdown = `# Parasti Architecture Guide

> Parasti is a self-hosted, block-based open-source note-taking workspace.

---

## Core Features

Overview of implemented capabilities:

- [x] Local development with Express and SQLite
- [x] Production deployment on Cloudflare Pages and D1
- [x] Model Context Protocol (MCP) server for AI assistants
- [ ] Real-time multi-user collaboration

## Technical Comparison

| Feature | Local Dev | Cloudflare Prod |
| :--- | :--- | :--- |
| Server | Express 5 | Hono (Edge) |
| Database | SQLite 3 | Cloudflare D1 |
| Storage | Local file system | Cloudflare R2 |

## Code Example

\`\`\`typescript
export function welcome(user: string) {
  console.log(\`Welcome to Parasti, \${user}!\`);
}
\`\`\`

## KaTeX Math Equation

$$f(x) = \\int_{-\\infty}^{\\infty} \\hat{f}(\\xi)\\,e^{2 \\pi i \\xi x}\\,d\\xi$$
`;

  const importRes = await sendRequest('tools/call', {
    name: 'import_markdown',
    arguments: {
      title: 'Parasti Architecture Guide',
      markdown: richMarkdown,
    },
  });
  console.log('[3/14] import_markdown executed successfully.');
  console.log('Result:', importRes.result.content[0].text);

  // Extract created page ID
  const parentPageId = extractId(importRes.result.content[0].text);
  if (parentPageId) createdPageIds.push(parentPageId);

  // 4. import_markdown_file creating a nested subpage
  if (parentPageId) {
    console.log(`\n[4/14] Creating local file and importing as subpage under ID: ${parentPageId}...`);
    const tempFilePath = path.resolve(process.cwd(), 'mcp', 'sample_subpage.md');
    fs.writeFileSync(
      tempFilePath,
      `# MCP Internal Architecture

This is a **subpage** created from a local \`.md\` file on disk.

### Components:
1. **StdioServerTransport**: Bidirectional communication via JSON-RPC 2.0.
2. **Auto-authentication**: Automatic bearer token exchange and renewal.
3. **Shared Parser**: Deterministic Markdown conversion to Parasti blocks.
`,
      'utf8'
    );

    const importFileRes = await sendRequest('tools/call', {
      name: 'import_markdown_file',
      arguments: {
        filePath: tempFilePath,
        parentId: parentPageId,
      },
    });
    console.log('[4/14] import_markdown_file executed successfully.');
    console.log('Result:', importFileRes.result.content[0].text);

    const importedFilePageId = extractId(importFileRes.result.content[0].text);
    if (importedFilePageId) createdPageIds.push(importedFilePageId);

    // Clean up temporary file
    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
  }

  // 5. search_pages
  console.log('\n[5/14] Testing search_pages...');
  const searchRes = await sendRequest('tools/call', {
    name: 'search_pages',
    arguments: { query: 'Architecture' },
  });
  console.log('[5/14] search_pages executed successfully.');
  console.log('Result:', searchRes.result.content[0].text);

  // 6. get_page
  if (parentPageId) {
    console.log(`\n[6/14] Fetching page details via get_page...`);
    const getPageRes = await sendRequest('tools/call', {
      name: 'get_page',
      arguments: { pageId: parentPageId },
    });
    const parsedPage = JSON.parse(getPageRes.result.content[0].text);
    console.log(`[6/14] get_page executed. Title: "${parsedPage.title}", Block count: ${parsedPage.blocks?.length}`);
  }

  // 7. create_project
  console.log('\n[7/14] Testing create_project...');
  const projectTitle = `MCP Test Project ${Date.now()}`;
  const projectText = await callTool('create_project', { title: projectTitle, icon: '🧪' });
  const projectId = extractId(projectText);
  if (!projectId) throw new Error(`create_project did not return an ID: ${projectText}`);
  createdPageIds.push(projectId);
  console.log('[7/14] create_project executed successfully.');
  console.log('Result:', projectText);

  // 8. list_projects
  console.log('\n[8/14] Testing list_projects...');
  const projectsText = await callTool('list_projects');
  if (!projectsText.includes(projectId)) {
    throw new Error(`list_projects did not include the new project ${projectId}: ${projectsText}`);
  }
  console.log('[8/14] list_projects executed successfully and contains the new project.');

  // 9. create_page as a sub-page of the project
  console.log('\n[9/14] Testing create_page with parentId...');
  const subPageText = await callTool('create_page', {
    title: `MCP Test Subpage ${Date.now()}`,
    parentId: projectId,
  });
  const subPageId = extractId(subPageText);
  if (!subPageId) throw new Error(`create_page did not return an ID: ${subPageText}`);
  if (!subPageText.includes(`under parent ${projectId}`)) {
    throw new Error(`create_page did not report the parent: ${subPageText}`);
  }
  createdPageIds.push(subPageId);
  console.log('[9/14] create_page executed successfully.');
  console.log('Result:', subPageText);

  // 10. create_event
  console.log('\n[10/14] Testing create_event...');
  const today = localDate(0);
  const inSevenDays = localDate(7);
  const eventTitle = `MCP Test Event ${Date.now()}`;
  const eventText = await callTool('create_event', {
    title: eventTitle,
    event_date: today,
    start_time: '09:00',
    end_time: '09:30',
  });
  const eventId = extractId(eventText);
  if (!eventId) throw new Error(`create_event did not return an ID: ${eventText}`);
  console.log('[10/14] create_event executed successfully.');
  console.log('Result:', eventText);

  // 11. list_events over today .. +7 days
  console.log('\n[11/14] Testing list_events over today..+7 days...');
  const eventsText = await callTool('list_events', { from: today, to: inSevenDays });
  if (!eventsText.includes(eventId)) {
    throw new Error(`list_events did not include the new event ${eventId}: ${eventsText}`);
  }
  console.log('[11/14] list_events executed successfully and contains the new event.');

  // 12. update_event
  console.log('\n[12/14] Testing update_event...');
  const updatedTitle = `${eventTitle} updated`;
  const updateText = await callTool('update_event', {
    eventId,
    title: updatedTitle,
    event_date: today,
    start_time: '09:00',
    end_time: '09:30',
  });
  if (!updateText.includes(updatedTitle)) {
    throw new Error(`update_event did not report the new title: ${updateText}`);
  }
  console.log('[12/14] update_event executed successfully.');
  console.log('Result:', updateText);

  // 13. delete_event
  console.log('\n[13/14] Testing delete_event...');
  const deleteText = await callTool('delete_event', { eventId });
  if (!deleteText.includes('"success":true')) {
    throw new Error(`delete_event did not confirm success: ${deleteText}`);
  }
  console.log('[13/14] delete_event executed successfully.');
  console.log('Result:', deleteText);

  // 14. Remove the pages created by this run (cascade: subpages too)
  console.log('\n[14/14] Cleaning up test pages...');
  for (const pageId of [...createdPageIds].reverse()) {
    await deletePagePermanently(pageId);
  }
  console.log(`[14/14] Removed ${createdPageIds.length} test pages.`);

  console.log('\nAll MCP test cases completed successfully.');
  child.kill();
  process.exit(0);
}

runMcpSession().catch((err) => {
  console.error('Error during test execution:', err);
  process.exit(1);
});
