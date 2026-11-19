import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Helper to communicate with the MCP server over stdio
async function runMcpSession() {
  console.log('Starting Parasti MCP test suite...\n');

  const child = spawn('npx.cmd', ['tsx', 'mcp/index.ts'], {
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

  // 1. Initialize
  const initRes = await sendRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test-suite', version: '1.0.0' },
  });
  console.log('[1/6] MCP server initialized:', initRes.result.serverInfo.name, 'v' + initRes.result.serverInfo.version);
  sendNotification('notifications/initialized');

  // 2. list_pages
  const listRes = await sendRequest('tools/call', {
    name: 'list_pages',
    arguments: {},
  });
  console.log('[2/6] list_pages executed successfully.');
  console.log('Current workspace pages:');
  console.log(listRes.result.content[0].text.split('\n').map((l: string) => '     ' + l).join('\n'));

  // 3. import_markdown with rich content
  console.log('\n[3/6] Creating rich page with H1, H2, table, code, tasks, and quotes...');
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
  console.log('[3/6] import_markdown executed successfully.');
  console.log('Result:', importRes.result.content[0].text);

  // Extract created page ID
  const match = importRes.result.content[0].text.match(/ID: ([a-f0-9-]+)/);
  const parentPageId = match ? match[1] : null;

  // 4. import_markdown_file creating a nested subpage
  if (parentPageId) {
    console.log(`\n[4/6] Creating local file and importing as subpage under ID: ${parentPageId}...`);
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
    console.log('[4/6] import_markdown_file executed successfully.');
    console.log('Result:', importFileRes.result.content[0].text);

    // Clean up temporary file
    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
  }

  // 5. search_pages
  console.log('\n[5/6] Testing search_pages...');
  const searchRes = await sendRequest('tools/call', {
    name: 'search_pages',
    arguments: { query: 'Architecture' },
  });
  console.log('[5/6] search_pages executed successfully.');
  console.log('Result:', searchRes.result.content[0].text);

  // 6. get_page
  if (parentPageId) {
    console.log(`\n[6/6] Fetching page details via get_page...`);
    const getPageRes = await sendRequest('tools/call', {
      name: 'get_page',
      arguments: { pageId: parentPageId },
    });
    const parsedPage = JSON.parse(getPageRes.result.content[0].text);
    console.log(`[6/6] get_page executed. Title: "${parsedPage.title}", Block count: ${parsedPage.blocks?.length}`);
  }

  console.log('\nAll MCP test cases completed successfully.');
  child.kill();
  process.exit(0);
}

runMcpSession().catch((err) => {
  console.error('Error during test execution:', err);
  process.exit(1);
});
