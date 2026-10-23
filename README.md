# Markflare Landing Page (Astro)

Esta es la landing page oficial de **Markflare**, construida con [Astro](https://astro.build) siguiendo la regla de diseño inspirada en la skill `frontend-design` de Claude Code y la paleta de colores nativa de Markflare (`#F38020`, `#191919`, `#202020`).

---

## 🎨 Características de Diseño

- **Alineación con Markflare**: Misma paleta de colores CSS, modo oscuro (`#191919`) y modo claro (`#ffffff`), tipografía del sistema y fuentes monospace para código/terminal.
- **Showcase Interactivo en Vivo**: Simulador del editor de bloques con checkbox funcionales, bloque de código multilenguaje, fórmulas KaTeX y menú de comando slash (`/`).
- **Cobertura total del README**:
  1. Propuesta de valor, badges y enlaces directos de descarga y repositorio.
  2. 8 Capacidades completas del editor y ecosistema (bloques, árbol anidado, KaTeX, compartir 128-bit, archivos, Markdown import/export).
  3. Comparativa de Arquitectura: Cloudflare Edge (Pages + D1) vs Local (Express + better-sqlite3).
  4. Los 5 métodos de despliegue con matriz comparativa y pestañas interactivas paso a paso.
  5. Los 4 bloques SQL de migraciones con botón de copia rápida para la consola de Cloudflare D1.
  6. Tabla completa de la API REST (/api/...) con filtrado interactivo por categorías.
  7. Tabla de configuración de variables de entorno (`AUTH_USERNAME`, `AUTH_PASSWORD`, `AUTH_SECRET`) y aviso sobre Pages.
  8. CTA final con descarga directa de ZIP (`https://github.com/Chaska-dev/Markflare/archive/refs/heads/main.zip`) y redirección al repositorio GitHub (`https://github.com/Chaska-dev/Markflare`).
- **Soporte Bilingüe Completo**:
  - Español: `/`
  - English: `/en`
- **Theme Switcher**: Soporte para tema claro y oscuro persistente en `localStorage`.

---

## 🚀 Comandos

Para ejecutar la landing page de forma independiente sin tocar el proyecto principal:

```bash
cd landing

# Instalar dependencias
pnpm install

# Servidor de desarrollo local (puerto 4321 por defecto)
pnpm run dev

# Compilar para producción (genera landing/dist/)
pnpm run build

# Previsualizar la compilación estática
pnpm run preview
```

---

## 📁 Aislamiento del Repositorio

Este directorio `landing/` es completamente autónomo:
- Posee su propio `package.json` y `node_modules/`.
- No modifica ni contamina las dependencias del proyecto raíz `Markflare` (React 18 + Vite 5 + Cloudflare Functions).
- Puede desplegarse en Cloudflare Pages, Vercel, Netlify o GitHub Pages apuntando a la subcarpeta `landing/`.
