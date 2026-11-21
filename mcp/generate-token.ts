import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

function loadSecret(): { username: string; secret: string } {
  let username = process.env.AUTH_USERNAME;
  let secret = process.env.AUTH_SECRET;

  const searchPaths = [
    path.resolve(process.cwd(), '.dev.vars'),
    path.resolve(process.cwd(), '.env'),
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
        if (k === 'AUTH_USERNAME' && !username) username = v;
        if (k === 'AUTH_SECRET' && !secret) secret = v;
      }
    }
  }

  if (!secret) {
    console.error('Error: AUTH_SECRET not found in environment or .dev.vars');
    process.exit(1);
  }

  return { username: username || 'admin', secret };
}

async function main() {
  const { username, secret } = loadSecret();
  const days = 365;
  const expiresAt = Date.now() + days * 24 * 60 * 60 * 1000;
  const payload = `${username}:${expiresAt}`;
  const sig = crypto.createHash('sha256').update(`${payload}:${secret}`).digest('hex');
  const b64 = Buffer.from(payload, 'utf8').toString('base64');
  const token = `${b64}.${sig}`;

  console.log('\n--- Parasti API / MCP Token ---');
  console.log(`Username:   ${username}`);
  console.log(`Valid for:  ${days} days (${new Date(expiresAt).toISOString()})`);
  console.log('\nToken:');
  console.log(token);
  console.log('\nAdd to your MCP client configuration:');
  console.log(`"PARASTI_API_TOKEN": "${token}"\n`);
}

main().catch(console.error);
