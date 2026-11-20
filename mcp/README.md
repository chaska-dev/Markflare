# Parasti MCP Server

Official [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server to connect Artificial Intelligence assistants (Claude Desktop, Cursor, Zed, Antigravity, etc.) directly to your **Parasti** workspace.

It allows any LLM or AI agent to:
- Create pages and import structured Markdown documents into pages and native blocks.
- Upload local `.md` files directly from disk.
- Query the workspace page hierarchy and retrieve page identifiers (`parentId`).
- Search across existing pages and blocks in Parasti.
- Inspect page details and ordered blocks by page ID.

Beyond pages, this server can also write your calendar and create projects: it creates, lists, updates, and deletes events, and it builds project roots with nested sub-pages, not only standalone pages.

---

## Authentication: Generating an API Token

Parasti uses dedicated, long-lived API tokens for MCP integrations. This allows AI assistants to authenticate without requiring or exposing your account password.

You can generate a token in two ways:

1. **From the Web UI (Recommended)**:
   - Open Parasti in your browser (`http://localhost:5173`).
   - Click on your user avatar at the bottom of the sidebar.
   - Select **API / MCP Token**.
   - Click **Generate Token** and copy either the token or the pre-formatted JSON snippet.

2. **From the Terminal (CLI)**:
   ```bash
   pnpm run mcp:token
   ```

Each family member uses their own API token, created from their own account
under **Profile → API / MCP Token**. A token only grants access to the data
owned by the account that created it; use `PARASTI_API_TOKEN` instead of
sharing one username and password.

---

## Available Tools

| Tool | Arguments | Description |
|---|---|---|
| `import_markdown` | `markdown` *(string, required)*<br>`title` *(string, optional)*<br>`parentId` *(string, optional)* | Imports raw Markdown content as a new page divided into blocks (headings, todos, code blocks, tables, KaTeX, etc.). |
| `import_markdown_file` | `filePath` *(string, required)*<br>`title` *(string, optional)*<br>`parentId` *(string, optional)* | Reads a local `.md` file from disk and imports it as a new page. |
| `list_pages` | *(none)* | Returns the workspace page hierarchy with icon, title, ID, and relationship (`root` or `parent`). |
| `search_pages` | `query` *(string, required)* | Searches for text within all pages and blocks. |
| `get_page` | `pageId` *(string, required)* | Retrieves the full page object and all ordered blocks. |
| `create_event` | `title` *(string, required)*<br>`event_date` *(string, required, `YYYY-MM-DD`)*<br>`start_time` *(string, optional, `HH:MM`)*<br>`end_time` *(string, optional, `HH:MM`)* | Creates a calendar event. Omit both times for an all-day event. |
| `list_events` | `from` *(string, optional, `YYYY-MM-DD`)*<br>`to` *(string, optional, `YYYY-MM-DD`)* | Lists events, optionally restricted to an inclusive date range. Provide both bounds or neither. |
| `update_event` | `eventId` *(string, required)*<br>`title` *(string, required)*<br>`event_date` *(string, required, `YYYY-MM-DD`)*<br>`start_time` *(string, optional, `HH:MM`)*<br>`end_time` *(string, optional, `HH:MM`)* | Replaces an event. All fields must be supplied; this is not a partial update. |
| `delete_event` | `eventId` *(string, required)* | Permanently deletes an event. Destructive: only call after the user confirms. |
| `create_project` | `title` *(string, required)*<br>`icon` *(string, optional, max 32 chars)* | Creates a root page flagged as a project. |
| `list_projects` | *(none)* | Lists projects (root pages with `is_project`). |
| `create_page` | `title` *(string, required)*<br>`icon` *(string, optional, max 32 chars)*<br>`parentId` *(string, optional)* | Creates an empty page, optionally nested under a project or private page. |

---

## Environment Variables

| Variable | Description |
|---|---|
| `PARASTI_URL` | Base URL of your Parasti instance (e.g. `http://localhost:3000` or `https://your-app.workers.dev`). |
| `PARASTI_API_TOKEN` | Dedicated API token generated from the UI or CLI (Recommended). |
| `PARASTI_USERNAME` | Username fallback (if no token is provided). |
| `PARASTI_PASSWORD` | Password fallback (if no token is provided). |

---

## Client Setup

### 1. Claude Desktop

Add the server definition to your configuration file:
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "parasti": {
      "command": "npx",
      "args": ["-y", "tsx", "path/to/parasti/mcp/index.ts"],
      "env": {
        "PARASTI_URL": "http://localhost:3000",
        "PARASTI_API_TOKEN": "YOUR_TOKEN_HERE"
      }
    }
  }
}
```
*(Note: Replace with your absolute path to `mcp/index.ts`)*.

### 2. Cursor IDE

Add to `.cursor/mcp.json` or your Cursor MCP settings:

```json
{
  "mcpServers": {
    "parasti": {
      "command": "npx",
      "args": ["-y", "tsx", "mcp/index.ts"],
      "env": {
        "PARASTI_URL": "http://localhost:3000",
        "PARASTI_API_TOKEN": "YOUR_TOKEN_HERE"
      }
    }
  }
}
```

---

## Automated Tests

To verify all MCP tools against a running instance:

```bash
# Ensure Parasti is running locally
pnpm run test:mcp
```

The test suite automatically validates:
1. JSON-RPC 2.0 stdio initialization and handshake.
2. Querying pages via `list_pages`.
3. Creating a page with rich Markdown elements via `import_markdown`.
4. Importing a local `.md` file as a nested subpage via `import_markdown_file`.
5. Searching content via `search_pages`.
6. Validating block integrity via `get_page`.

---

## Example Files

The [`mcp/examples/`](./examples) directory contains:
- `sample-note.md`: Sample Markdown note showcasing tables, task lists, TypeScript code blocks, and KaTeX equations.
- `claude_desktop_config.json`: Configuration snippet for Claude Desktop.
- `cursor_mcp.json`: Configuration snippet for Cursor IDE.
