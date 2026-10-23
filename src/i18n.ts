// Every string on the page, once per language. Both pages render the same
// components from this file, so a section can never exist in only one language.

export type Lang = 'es' | 'en';

export const REPO = 'https://github.com/Chaska-dev/Markflare';
export const ZIP = `${REPO}/archive/refs/heads/main.zip`;
export const CLONE = `git clone ${REPO}.git`;
export const readme = (anchor: string) => `${REPO}#${anchor}`;

const es = {
  meta: {
    title: 'Markflare: un Notion auto-hospedado en tu Cloudflare',
    description:
      'Editor de notas por bloques que corre en tu propia cuenta de Cloudflare: Pages sirve la app, D1 guarda tus notas y R2 tus archivos. Código abierto, licencia MIT.',
  },
  nav: {
    home: '/',
    contents: 'Contenido',
    instructions: 'Instrucciones',
    specs: 'Especificaciones',
    readme: 'README',
    otherLang: { href: '/en', label: 'EN', name: 'English' },
    thisLang: 'ES',
    github: 'GitHub',
  },
  copy: { action: 'Copiar', done: 'Copiado', failed: 'Selecciónalo y cópialo' },
  hero: {
    headline: 'Un Notion que es tuyo, en tu cuenta de Cloudflare.',
    lead:
      'Editor por bloques con menú /, páginas anidadas, tareas, código, fórmulas, tablas y enlaces públicos. Sin servidor que mantener, sin Docker, sin suscripción.',
    contents: [
      { part: 'Pages', role: 'Sirve la app y la API' },
      { part: 'D1', role: 'Guarda tus notas, en SQLite' },
      { part: 'R2', role: 'Guarda tus archivos, hasta 25 MB' },
      { part: 'MIT', role: 'Código abierto, sin cuota mensual' },
    ],
    zip: 'Descargar ZIP',
    github: 'Ver en GitHub',
    plate: 'Captura real del editor. No es una maqueta.',
    plateAlt:
      'El editor de Markflare con el árbol de páginas a la izquierda y una página con títulos, listas, una tabla, bloques de código y tareas.',
  },
  contents: {
    title: 'Qué hay dentro',
    intro:
      'Todo lo que trae el ZIP, sin plugins ni planes de pago. Lo que no está en esta lista, no lo promete.',
    items: [
      {
        name: 'Editor de bloques',
        body: 'Escribe / y elige: títulos, listas, tareas, código, fórmulas, tablas, citas, callouts, imágenes, archivos y subpáginas.',
        tag: '/',
      },
      {
        name: 'Páginas anidadas',
        body: 'Una página guarda subpáginas. Borrar una se lleva a sus hijas a la papelera, y desde ahí se restauran.',
        tag: 'árbol',
        plain: true,
      },
      {
        name: 'Arrastrar y soltar',
        body: 'Mueve y anida bloques. Suelta una imagen o un documento en la página y se sube solo.',
        tag: '≤ 25 MB',
      },
      {
        name: 'Enlaces públicos',
        body: 'Un clic publica una página y sus subpáginas en solo lectura. Otro clic lo revoca.',
        tag: '128 bits',
      },
      {
        name: 'Markdown',
        body: 'Importa un archivo .md como página y exporta cualquier página de vuelta a Markdown.',
        tag: '.md',
      },
      {
        name: 'Servidor MCP',
        body: 'Conecta Claude Desktop, Cursor o Zed a tu espacio de trabajo para leer, buscar e importar notas.',
        tag: 'pnpm run mcp',
      },
      {
        name: 'Bilingüe',
        body: 'Interfaz en español e inglés, con tema claro y oscuro. Se cambia al vuelo.',
        tag: 'ES · EN',
        plain: true,
      },
    ],
    plates: [
      {
        src: 'app-arquitectura',
        caption: 'Tablas y bloques de código',
        alt: 'Una página de Markflare con una tabla de servicios y un bloque de código SQL.',
      },
      {
        src: 'app-pendientes',
        caption: 'Listas de tareas',
        alt: 'Una página de Markflare con listas de pendientes agrupadas por sprint.',
      },
      {
        src: 'app-mobile',
        caption: 'En el teléfono',
        alt: 'Markflare en la pantalla de un teléfono.',
      },
    ],
  },
  instructions: {
    title: 'Instrucciones',
    method: 'Método 1 de 3: el panel de Cloudflare. Unos 15 minutos.',
    needs: 'Necesitas una cuenta de Cloudflare, node y pnpm.',
    steps: [
      {
        icon: 'download',
        title: 'Consigue el código',
        body: 'Clónalo y compílalo. Sale una carpeta dist/.',
        code: `${CLONE}\ncd Markflare\npnpm install\npnpm run build`,
      },
      {
        icon: 'storage',
        title: 'Crea D1 y R2',
        body: 'En el panel: una base D1 llamada markflare-db y un bucket R2 llamado markflare-files. Deja el bucket privado.',
      },
      {
        icon: 'table',
        title: 'Crea las tablas',
        body: 'Abre markflare-db, pestaña Console, y pega los bloques SQL en orden. Todos usan IF NOT EXISTS.',
        link: { href: readme('13-create-the-tables'), label: 'Bloques SQL en el README' },
      },
      {
        icon: 'plug',
        title: 'Conecta y protege',
        body: 'Crea el proyecto Pages y sube dist/. Enlaza DB y BUCKET, y añade tres secretos cifrados.',
        code: 'DB      → markflare-db\nBUCKET  → markflare-files\nAUTH_USERNAME · AUTH_PASSWORD · AUTH_SECRET',
        note: 'Genera AUTH_SECRET con openssl rand -hex 32',
      },
      {
        icon: 'flare',
        title: 'Enciéndelo',
        body: 'Tu espacio queda en markflare.pages.dev. Si el login responde 503, vuelve a desplegar: los secretos entran en el siguiente deploy.',
      },
    ],
    others: 'Los otros dos métodos',
    alt: [
      {
        name: 'Local',
        body: 'Sin Cloudflare: SQLite y una carpeta en disco.',
        code: 'pnpm run db:migrate:all && pnpm run dev',
        href: readme('2-local-only-no-deploy'),
      },
      {
        name: 'Terminal',
        body: 'Todo con wrangler y un wrangler.toml local.',
        code: 'pnpm run db:migrate:prod && pnpm run deploy',
        href: readme('3-terminal-wrangler-cli'),
      },
    ],
    full: 'Guía completa en el README',
  },
  specs: {
    title: 'Especificaciones',
    rows: [
      ['Frontend', 'React 18, Vite 5, TypeScript'],
      ['API', 'Pages Functions con Hono. En local, Express 5 con las mismas rutas'],
      ['Notas', 'Cloudflare D1. En local, un archivo SQLite'],
      ['Archivos', 'Cloudflare R2, bucket privado, máx. 25 MB. En local, uploads/'],
      ['Acceso', 'Un usuario. Tokens HMAC-SHA256 de 24 h'],
      ['Login', 'Máx. 5 intentos por minuto por IP'],
      ['Compartir', 'Tokens de 128 bits, limitados al subárbol compartido'],
      ['MCP', '@modelcontextprotocol/sdk, con tokens por cliente'],
      ['Paquetes', 'pnpm'],
      ['Licencia', 'MIT'],
    ],
    links: [
      { label: 'Esquema SQL', href: readme('database-schema') },
      { label: 'Rutas de la API', href: readme('api') },
      { label: 'Variables de entorno', href: readme('configuration') },
      { label: 'Configurar MCP', href: readme('model-context-protocol-mcp') },
    ],
  },
  close: {
    title: 'Enciende el tuyo.',
    body: 'Clónalo, crea D1 y R2, pon tres secretos. Tus notas viven en tu cuenta desde el primer minuto.',
    footer: 'Hecho para Cloudflare Pages, D1 y R2. Proyecto independiente, sin relación con Cloudflare.',
    license: 'Licencia MIT',
  },
};

const en: typeof es = {
  meta: {
    title: 'Markflare: a self-hosted Notion on your own Cloudflare',
    description:
      'A block-based notes editor that runs in your own Cloudflare account: Pages serves the app, D1 holds your notes, R2 your files. Open source, MIT licensed.',
  },
  nav: {
    home: '/en',
    contents: 'Contents',
    instructions: 'Instructions',
    specs: 'Specifications',
    readme: 'README',
    otherLang: { href: '/', label: 'ES', name: 'Español' },
    thisLang: 'EN',
    github: 'GitHub',
  },
  copy: { action: 'Copy', done: 'Copied', failed: 'Select it and copy' },
  hero: {
    headline: 'A Notion you own, in your own Cloudflare account.',
    lead:
      'A block editor with a / menu, nested pages, to-dos, code, math, tables and public share links. No server to maintain, no Docker, no subscription.',
    contents: [
      { part: 'Pages', role: 'Serves the app and the API' },
      { part: 'D1', role: 'Holds your notes, in SQLite' },
      { part: 'R2', role: 'Holds your files, up to 25 MB' },
      { part: 'MIT', role: 'Open source, no monthly fee' },
    ],
    zip: 'Download ZIP',
    github: 'View on GitHub',
    plate: 'A real capture of the editor. Not a mockup.',
    plateAlt:
      'The Markflare editor with the page tree on the left and a page holding headings, lists, a table, code blocks and to-dos.',
  },
  contents: {
    title: "What's inside",
    intro:
      'Everything the ZIP carries, with no plugins and no paid tier. If it is not on this list, the app does not promise it.',
    items: [
      {
        name: 'Block editor',
        body: 'Type / and pick: headings, lists, to-dos, code, math, tables, quotes, callouts, images, files and subpages.',
        tag: '/',
      },
      {
        name: 'Nested pages',
        body: 'A page holds subpages. Deleting one moves its children to the Trash, where they can be restored.',
        tag: 'tree',
        plain: true,
      },
      {
        name: 'Drag and drop',
        body: 'Move and nest blocks. Drop an image or a document onto the page and it uploads.',
        tag: '≤ 25 MB',
      },
      {
        name: 'Public links',
        body: 'One click publishes a page and its subpages read-only. Another click revokes it.',
        tag: '128-bit',
      },
      {
        name: 'Markdown',
        body: 'Import a .md file as a page and export any page back to Markdown.',
        tag: '.md',
      },
      {
        name: 'MCP server',
        body: 'Connect Claude Desktop, Cursor or Zed to your workspace to read, search and import notes.',
        tag: 'pnpm run mcp',
      },
      {
        name: 'Bilingual',
        body: 'English and Spanish interface, light and dark themes, switched on the fly.',
        tag: 'EN · ES',
        plain: true,
      },
    ],
    plates: [
      {
        src: 'app-arquitectura',
        caption: 'Tables and code blocks',
        alt: 'A Markflare page with a table of services and an SQL code block.',
      },
      {
        src: 'app-pendientes',
        caption: 'To-do lists',
        alt: 'A Markflare page with to-do lists grouped by sprint.',
      },
      {
        src: 'app-mobile',
        caption: 'On a phone',
        alt: 'Markflare on a phone screen.',
      },
    ],
  },
  instructions: {
    title: 'Instructions',
    method: 'Method 1 of 3: the Cloudflare dashboard. About 15 minutes.',
    needs: 'You need a Cloudflare account, node and pnpm.',
    steps: [
      {
        icon: 'download',
        title: 'Get the code',
        body: 'Clone it and build it. You get a dist/ folder.',
        code: `${CLONE}\ncd Markflare\npnpm install\npnpm run build`,
      },
      {
        icon: 'storage',
        title: 'Create D1 and R2',
        body: 'In the dashboard: a D1 database named markflare-db and an R2 bucket named markflare-files. Keep the bucket private.',
      },
      {
        icon: 'table',
        title: 'Create the tables',
        body: 'Open markflare-db, Console tab, and paste the SQL blocks in order. Every one uses IF NOT EXISTS.',
        link: { href: readme('13-create-the-tables'), label: 'SQL blocks in the README' },
      },
      {
        icon: 'plug',
        title: 'Wire it and lock it',
        body: 'Create the Pages project and upload dist/. Bind DB and BUCKET, and add three encrypted secrets.',
        code: 'DB      → markflare-db\nBUCKET  → markflare-files\nAUTH_USERNAME · AUTH_PASSWORD · AUTH_SECRET',
        note: 'Generate AUTH_SECRET with openssl rand -hex 32',
      },
      {
        icon: 'flare',
        title: 'Light it',
        body: 'Your workspace is live at markflare.pages.dev. If login answers 503, redeploy: secrets land on the next deploy.',
      },
    ],
    others: 'The other two methods',
    alt: [
      {
        name: 'Local',
        body: 'No Cloudflare: SQLite and a folder on disk.',
        code: 'pnpm run db:migrate:all && pnpm run dev',
        href: readme('2-local-only-no-deploy'),
      },
      {
        name: 'Terminal',
        body: 'Everything through wrangler and a local wrangler.toml.',
        code: 'pnpm run db:migrate:prod && pnpm run deploy',
        href: readme('3-terminal-wrangler-cli'),
      },
    ],
    full: 'Full guide in the README',
  },
  specs: {
    title: 'Specifications',
    rows: [
      ['Frontend', 'React 18, Vite 5, TypeScript'],
      ['API', 'Pages Functions with Hono. Locally, Express 5 with the same routes'],
      ['Notes', 'Cloudflare D1. Locally, a SQLite file'],
      ['Files', 'Cloudflare R2, private bucket, 25 MB max. Locally, uploads/'],
      ['Access', 'Single user. 24 h HMAC-SHA256 tokens'],
      ['Login', '5 attempts per minute per IP, max'],
      ['Sharing', '128-bit tokens, scoped to the shared subtree'],
      ['MCP', '@modelcontextprotocol/sdk, with per-client tokens'],
      ['Packages', 'pnpm'],
      ['License', 'MIT'],
    ],
    links: [
      { label: 'SQL schema', href: readme('database-schema') },
      { label: 'API routes', href: readme('api') },
      { label: 'Environment variables', href: readme('configuration') },
      { label: 'Set up MCP', href: readme('model-context-protocol-mcp') },
    ],
  },
  close: {
    title: 'Light your own.',
    body: 'Clone it, create D1 and R2, set three secrets. Your notes live in your account from the first minute.',
    footer: 'Built for Cloudflare Pages, D1 and R2. An independent project, not affiliated with Cloudflare.',
    license: 'MIT License',
  },
};

export const copy = { es, en };
export type Copy = typeof es;
