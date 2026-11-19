# Parasti Release Notes

> Parasti is a self-hosted, block-based note-taking workspace on Cloudflare Pages + D1 and Express + SQLite.

---

## Task Checklist

- [x] Configure local development server with SQLite
- [x] Implement Cloudflare D1 database support
- [x] Add Model Context Protocol (MCP) server integration
- [ ] Implement PDF export functionality

## Compatibility Matrix

| Environment | Database | Runtime |
| :--- | :--- | :--- |
| **Local Dev** | SQLite (`better-sqlite3`) | Node.js (Express 5) |
| **Production** | Cloudflare D1 | Cloudflare Pages (Hono) |

## Code Snippet

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

console.log('Parasti MCP Server ready to synchronize notes.');
```

## KaTeX Equation

$$S = k_B \ln \Omega$$
