import react from '@vitejs/plugin-react'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

/**
 * Resolves the public URL of the deployed site.
 *
 * Vercel injects its own environment variables during the build, so the
 * canonical URL and sitemap point at the real domain without hardcoding it.
 *
 * Returns:
 *   string: Site origin without a trailing slash.
 */
function resolveSiteUrl() {
  const explicit = process.env.VITE_SITE_URL
  if (explicit) return explicit.replace(/\/+$/, '')

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL
  if (vercel) return `https://${vercel.replace(/\/+$/, '')}`

  return 'http://localhost:5173'
}

/**
 * Injects the site URL into the HTML and writes robots and sitemap files.
 *
 * Returns:
 *   Object: Vite plugin.
 */
function seoFiles() {
  let siteUrl = 'http://localhost:5173'

  return {
    name: 'letterboxd-stats-seo',
    configResolved() {
      siteUrl = resolveSiteUrl()
    },
    transformIndexHtml(html) {
      return html.replaceAll('__SITE_URL__', siteUrl)
    },
    closeBundle() {
      const dist = resolve(process.cwd(), 'dist')
      const today = new Date().toISOString().slice(0, 10)

      mkdirSync(dist, { recursive: true })
      writeFileSync(
        resolve(dist, 'robots.txt'),
        `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`,
      )
      writeFileSync(
        resolve(dist, 'sitemap.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${siteUrl}/</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>1.0</priority>\n  </url>\n</urlset>\n`,
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), seoFiles()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('react') || id.includes('scheduler')) return 'react'
          if (id.includes('jszip') || id.includes('papaparse')) return 'parsing'
          if (id.includes('world-atlas') || id.includes('topojson')) return 'map'
          return 'vendor'
        },
      },
    },
  },
})
