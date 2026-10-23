---
description: Regla de diseño y desarrollo frontend para la Landing Page de Markflare con Astro, basada en la skill frontend-design de Claude y los tokens de diseño de Markflare.
globs: ["landing/**", "src/**"]
---

# Regla de Diseño y Desarrollo: Landing Page Markflare (Astro)

Esta regla adapta la filosofía de diseño distintivo e intencional de la skill `frontend-design` de Claude Code específicamente para **Markflare**: un espacio de trabajo de notas por bloques auto-hospedado sobre Cloudflare Pages + Cloudflare D1 (SQLite serverless en el edge).

---

## 1. Identidad y Filosofía de Diseño

### 1.1 El Producto y su Sujeto Real
- **Qué es**: Un clon ligero, veloz y auto-hospedado de Notion que corre al 100% en la infraestructura edge de Cloudflare (Pages Functions + D1), o en local con Express + SQLite (`better-sqlite3`).
- **Para quién es**: Desarrolladores, entusiastas de la privacidad y creadores que quieren control total de sus notas sin pagar suscripciones mensuales ni lidiar con servidores pesados de Docker o bases de datos lentas.
- **La Promesa**: Cero vendor lock-in, despliegue en un clic o un comando (`wrangler`), soporte offline/local instantáneo y coste prácticamente nulo en el free tier de Cloudflare.

### 1.2 Regla de Oro: Evitar Clichés de IA ("AI Tells")
Siguiendo las directrices estrictas de Claude Code `frontend-design`:
1. **NO usar gradientes genéricos de texto**: No poner palabras sueltas en cursiva/negrita con degradados violeta/rosa de plantilla SaaS.
2. **NO abusar de "SaaS Cards Kit"**: No cortar todo el contenido en tarjetas redondeadas idénticas con sombra `rgba(0,0,0,0.1)`. Usar bordes sutiles, divisiones tipográficas, jerarquías de contenido y tablas estructuradas.
3. **NO poner prefijos "01 / 02 / 03"**: Únicamente permitidos si el contenido es genuinamente secuencial (como los pasos del despliegue o la ejecución de migraciones SQL).
4. **NO saturar con etiquetas en mayúsculas espaciadas**: Evitar los *eyebrows* `TRACKED-OUT ALL-CAPS` sobre cada subtítulo.
5. **NO terminar todos los botones con flechas `→`**: El botón debe tener texto de acción claro y específico ("Descargar ZIP (v1.0)", "Ver repositorio en GitHub", "Probar demo interactiva").
6. **Contención y foco**: Gastar la audacia visual en un solo lugar protagónico: el **visor interactivo del editor de bloques y la arquitectura edge en tiempo real**. El resto de la página debe mantenerse sobrio, pulido y tipográficamente disciplinado.

---

## 2. Sistema de Tokens de Diseño

La landing page debe sincronizar al 100% la paleta de colores oficial de Markflare (`src/index.css`):

### 2.1 Paleta Modo Oscuro (Predeterminado)
- **Fondo primario (`--bg-primary`)**: `#191919`
- **Fondo secundario / Superficies (`--bg-secondary`)**: `#202020`
- **Fondo terciario / Hover sutil (`--bg-tertiary`)**: `#2f2f2f`
- **Hover de elementos (`--bg-hover`)**: `#353535`
- **Fondo de bloques de código / Terminal (`--bg-code`)**: `#141417`
- **Bordes (`--border-color`)**: `#2f2f2f`
- **Texto principal (`--text-primary`)**: `#e8e8e8`
- **Texto secundario (`--text-secondary`)**: `#9b9b9b`
- **Texto atenuado (`--text-tertiary`)**: `#5a5a5a`
- **Acento Cloudflare (`--accent`)**: `#F38020`
- **Acento hover (`--accent-hover`)**: `#e0731a`
- **Alerta / Peligro (`--danger`)**: `#eb5757`

### 2.2 Paleta Modo Claro
- **Fondo primario (`--bg-primary`)**: `#ffffff`
- **Fondo secundario / Superficies (`--bg-secondary`)**: `#f7f7f5`
- **Fondo terciario (`--bg-tertiary`)**: `#efefec`
- **Hover de elementos (`--bg-hover`)**: `#e8e8e5`
- **Fondo de código (`--bg-code`)**: `#f8f8f6`
- **Bordes (`--border-color`)**: `#e5e5e2`
- **Texto principal (`--text-primary`)**: `#202428`
- **Texto secundario (`--text-secondary`)**: `#6b7280`
- **Texto atenuado (`--text-tertiary`)**: `#9ca3af`
- **Acento Cloudflare (`--accent`)**: `#F38020`
- **Acento hover (`--accent-hover`)**: `#e0731a`

### 2.3 Tipografía
- **Sans-serif (UI y cuerpo)**: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`
  - Longitud de línea para párrafos: `< 75 caracteres`
  - Escala de tipos proporcional y legible.
- **Monospace (Terminal, SQL, API y variables)**: `'SFMono-Regular', Menlo, Consolas, 'PT Mono', 'Liberation Mono', Courier, monospace`
  - Uso estricto para rutas de endpoints, snippets de código, variables de entorno y comandos `pnpm`.

---

## 3. Estructura y Secciones Requeridas (README Coverage)

La landing page debe cubrir rigurosamente todas las características del README de Markflare:

1. **Barra de Navegación / Header**:
   - Logo oficial de Markflare (SVG fiel al del repositorio) + Versión `v1.0.0`.
   - Enlaces de salto: Características, Arquitectura, 5 Métodos de Despliegue, Migraciones, API.
   - Switcher de tema (Dark / Light).
   - Selector de idioma (EN / ES).
   - Acceso rápido a GitHub y botón de Descarga ZIP.

2. **Hero Section**:
   - Título sobrio y de alto impacto sobre el valor central: "Tus notas por bloques en el edge de Cloudflare".
   - Subtítulo explicativo sin relleno: "Auto-hospedado, privado, instantáneo. Páginas infinitas, fórmulas KaTeX, código con resaltado y soporte bilingüe sobre Cloudflare Pages + D1."
   - Acciones principales:
     * Botón primario de descarga de código: Enlace directo al ZIP de GitHub (`https://github.com/Chaska-dev/Markflare/archive/refs/heads/main.zip`).
     * Botón secundario: Enlace al repositorio GitHub (`https://github.com/Chaska-dev/Markflare`) con contador de estrellas/forks.
     * Comando rápido de clonación con botón interactivo de copiar al portapapeles: `git clone https://github.com/Chaska-dev/Markflare.git`.
   - **Showcase Interactivo en Vivo**: Un simulador interactivo del editor de bloques de Markflare que permite probar:
     * Menú flotante de comando slash (`/`).
     * Bloques interactivos: Tarea (checkbox funcional), Bloque de código con pestaña de lenguaje, Ecuación KaTeX, Cita/Callout.
     * Alternador de vista previa de árbol de páginas (sidebar).

3. **Sección: Capacidades del Editor & Ecosistema**:
   - Páginas y subpáginas infinitas en árbol jerárquico.
   - Bloques ricos: Párrafos, Encabezados H1-H3, Listas de tareas, Bloques de código con detección de sintaxis, Fórmulas matemáticas LaTeX/KaTeX, Tablas, Citas, Imágenes y archivos subidos (hasta 10 MB).
   - Enlaces de compartir públicos con tokens seguros de 128-bit y revocación instantánea.
   - Interfaz bilingüe nativa (Español e Inglés sin librerías pesadas).
   - Almacenamiento dual: D1 en Cloudflare o SQLite local.

4. **Sección: Arquitectura y Stack Tecnológico**:
   - Diagrama interactivo/visual que contrasta:
     * **Entorno de Producción**: Cloudflare Pages + Pages Functions (Hono Router) + Cloudflare D1 SQL.
     * **Entorno de Desarrollo Local**: Vite 5 + React 18 + TypeScript + Express 5 + `better-sqlite3`.
   - Por qué esta arquitectura: cero mantenimiento de servidores, latencia de milisegundos en todo el mundo, SQLite con soporte de transacciones y llaves foráneas (`PRAGMA foreign_keys = ON`).

5. **Sección: Los 5 Métodos de Despliegue (Interactivo)**:
   Un componente interactivo por pestañas con la tabla comparativa del README:
   - **Método 1**: Desarrollo Local (`pnpm run dev` en `:5173` y `:3000`).
   - **Método 2**: Cloudflare Dashboard — Clonar repo y compilar (`pnpm run build` -> subir `dist/`).
   - **Método 3**: Cloudflare Dashboard — Descargar ZIP (sin necesidad de Git).
   - **Método 4**: Terminal CLI — Script automatizado con `wrangler` (`pnpm run deploy` y `pnpm run db:migrate:prod`).
   - **Método 5**: Cloudflare Dashboard — Conectado a Git (CI/CD automático en cada `git push`).
   * Cada método incluye sus instrucciones exactas, configuración de variables de entorno (`AUTH_USERNAME`, `AUTH_PASSWORD`, `AUTH_SECRET`) y comandos de terminal.

6. **Sección: Migraciones de Base de Datos (SQL Interactivo)**:
   - Los 4 bloques de migraciones idempotentes (`IF NOT EXISTS`):
     * Bloque 1: `0001_initial.sql` (`pages`, `blocks`, índices).
     * Bloque 2: `0002_files.sql` (`files` blob base64).
     * Bloque 3: `0003_workspace.sql` (`workspace` metadata).
     * Bloque 4: `0004_shares.sql` (`page_shares` tokens).
   - Botón individual "Copiar bloque SQL" para pegar directamente en la consola de Cloudflare D1.

7. **Sección: Referencia de API REST**:
   - Tabla clara con métodos HTTP, endpoints (`/api/...`), requisito de autenticación Bearer 🔒 y descripción de propósito.

8. **Sección: Variables de Entorno & Seguridad**:
   - Tabla de `AUTH_USERNAME`, `AUTH_PASSWORD`, `AUTH_SECRET` con instrucción para generarlo con `openssl rand -hex 32`.

9. **Footer & Call to Action Final**:
   - Recordatorio de licencia MIT y enlaces oficiales al repositorio de GitHub: `https://github.com/Chaska-dev/Markflare`.
   - Enlace directo a la descarga del código fuente en formato `.zip`.

---

## 4. Reglas Técnicas de Implementación en Astro

1. **Ubicación Aislada**: El proyecto de Astro debe residir exclusivamente dentro de la subcarpeta `landing/` para mantener limpio el repositorio raíz de Markflare.
2. **Sin dependencias pesadas innecesarias**: Aprovechar los componentes `.astro` para renderizado estático rápido, con interactividad en islas de cliente (`client:load` o vanilla TypeScript/Web Components ligeros) para tabs, theme toggle y copy buttons.
3. **Estilos**: Usar CSS moderno con variables CSS coincidentes con Markflare para cambios de tema instantáneos sin parpadeo (FOUC).
4. **Accesibilidad y Rendimiento**:
   - Semántica HTML rigurosa (`<header>`, `<main>`, `<section>`, `<article>`, `<footer>`).
   - Soporte total de teclado (focus visible) y contraste WCAG AAA.
   - Totalmente responsivo en móviles, tablets y monitores ultrawide.
