# Despliegue en Vercel y tareas posteriores

Este documento asume que el despliegue se hace en el plan gratuito de Vercel.
La app sigue siendo 100% cliente para tus datos personales. El unico backend
son dos funciones serverless: un proxy de TMDB y la cola compartida.

Nota: el antiguo `plan_de_despliegue_y_seo.md` describia una version en Python
y descartaba Vercel. Ese documento ya no aplica a este proyecto Vite + React.

## Que se ha implementado

- `api/tmdb/[...path].js`: proxy serverless de TMDB. La API key vive en el
  servidor y nunca se envia al navegador. Solo permite los endpoints que usa la
  app y deja que la CDN de Vercel cachee las respuestas para compartirlas entre
  usuarios.
- `api/queue.js`: cola global opcional. Limita cuantas personas enriquecen a la
  vez para no reventar el limite de TMDB. Muestra cuanta gente tienes delante en
  la pantalla de carga. Usa Redis (Upstash) si esta configurado y, si no, se
  desactiva sola sin romper la app.
- `api/_lib/redis.js`: cliente minimo de Upstash por REST.
- `vercel.json`: configuracion de build, rewrites, cache y cabeceras de
  seguridad.
- SEO tecnico: titulo y descripcion, canonical, Open Graph, Twitter Cards,
  JSON-LD de aplicacion y FAQ, `robots.txt`, `sitemap.xml`, `site.webmanifest`,
  icono para iOS y una imagen Open Graph de 1200x630.
- La URL canonica y el sitemap se generan en build con el dominio real de
  Vercel, o con `VITE_SITE_URL` si lo defines.

## Antes de desplegar

1. Comprueba que `.env` no esta en Git. Ya esta ignorado, pero asegurate:
   ```powershell
   git status --porcelain
   git check-ignore -v .env
   ```
2. Crea una API key de TMDB para produccion en
   <https://www.themoviedb.org/settings/api>.
   No uses la misma que tengas en el `.env` local si ese arichvo se ha
   compartido alguna vez. Si tienes dudas, revoca la antigua.
3. Sube el proyecto a GitHub si aun no lo has hecho.
4. Entra en <https://vercel.com>, inicia sesion con GitHub e importa el
   repositorio.
5. Deja que Vercel detecte Vite. Los valores correctos son:
   - Build command: `npm run build`
   - Output directory: `dist`
   - Install command: `npm install`
   - Node.js: 20 o superior

## Variables de entorno en Vercel

Ve a Project Settings, Environment Variables. Configura al menos esta:

| Variable | Valor | Entorno |
| --- | --- | --- |
| `TMDB_API_KEY` | Tu API key de TMDB | Production, Preview, Development |

Importante: no configures `VITE_TMDB_API_KEY` en Vercel. El codigo ya ignora la
key directa cuando el proxy esta activo, pero mejor no tenerla ahi. Si algun dia
haces un build fuera de Vercel y quieres usar la key directa, entonces si, pero
seria una app estatica sin proxy.

Variables opcionales:

| Variable | Para que sirve |
| --- | --- |
| `VITE_SITE_URL` | Fuerza la URL canonica y el sitemap, por ejemplo `https://tudominio.com` |
| `TMDB_QUEUE_MAX_ACTIVE` | Personas que enriquecen a la vez. Por defecto `2` |
| `TMDB_QUEUE_LEASE_SECONDS` | Segundos de vida del turno activo. Por defecto `120` |

## Activar la cola con Upstash en el plan gratis

La cola es opcional. Sin Redis la app funciona igual, solo que sin limite global
y sin el aviso de "cuanta gente hay delante". Para activarla:

1. En el dashboard de Vercel ve a Storage o Marketplace.
2. Crea una base de datos de Upstash for Redis en el plan gratuito.
3. Conectala al proyecto. Vercel inyectara automaticamente
   `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`, o las equivalentes
   `KV_REST_API_URL` y `KV_REST_API_TOKEN`.
4. Redeploy para que las funciones reciban las variables.

Tambien puedes crearla en <https://upstash.com> y pegar manualmente la URL REST
y el token en las variables de entorno de Vercel.

El plan gratuito de Upstash tiene un limite diario de comandos. La cola hace
muy pocas operaciones por persona, y la cache de TMDB vive en la CDN de Vercel,
no en Redis. Si se agota la cuota, la cola se desactiva sola y la app sigue
funcionando.

## Despues del primer deploy

1. Abre la URL que te da Vercel y comprueba que carga la pantalla de subida.
2. Prueba el proxy de TMDB. En produccion el endpoint exige que la peticion
   venga de la propia app, asi que anade la cabecera de same origin:
   ```powershell
   Invoke-RestMethod -Uri "https://letterboxd-unwrapped.vercel.app/api/tmdb/search/multi?query=Inception" `
     -Headers @{ "Sec-Fetch-Site" = "same-origin" }
   ```
   Debe devolver JSON con resultados. Si devuelve 503, falta `TMDB_API_KEY`.
   Si devuelve 403, la cabecera no ha llegado.
3. Prueba la cola:
   ```powershell
   Invoke-RestMethod -Method Post -Uri "https://letterboxd-unwrapped.vercel.app/api/queue" `
     -Headers @{ "Sec-Fetch-Site" = "same-origin" } `
     -ContentType "application/json" -Body '{"action":"probe"}'
   ```
   Debe devolver `enabled:true` si Upstash esta conectado y `tmdbReady:true` si
   la key esta bien. Si `enabled` es `false`, la cola esta desactivada pero la
   app funciona.
4. Sube un ZIP de ejemplo y comprueba que las estadisticas aparecen y que la
   consola del navegador no tiene errores.
5. Abre dos pestañas y sube dos ZIPs a la vez. Con Redis configurado, la segunda
   debe mostrar la cola y el numero de personas por delante.
6. Comprueba la imagen social:
   - <https://www.opengraph.xyz/>
   - <https://cards-dev.twitter.com/validator>
   La imagen debe ser `https://letterboxd-unwrapped.vercel.app/og-image.png`.
7. Comprueba `https://letterboxd-unwrapped.vercel.app/robots.txt` y
   `https://letterboxd-unwrapped.vercel.app/sitemap.xml`.
8. Ejecuta Lighthouse en Chrome DevTools sobre la pantalla de subida. Revisa
   sobre todo rendimiento, accesibilidad y SEO.

## Google Search Console

1. Entra en <https://search.google.com/search-console>.
2. Anade la propiedad de tu dominio. La forma mas facil es el registro DNS de
   tipo TXT si usas un dominio propio. Si usas `tu-proyecto.vercel.app`, usa la
   verificacion por etiqueta HTML o por DNS.
3. En Sitemaps, envia `https://letterboxd-unwrapped.vercel.app/sitemap.xml`.
4. Usa Inspeccion de URL para pedir la indexacion de la home.
5. Repite el envio del sitemap en Bing Webmaster Tools:
   <https://www.bing.com/webmasters>

No esperes aparecer el primero de Google en un dia. El SEO depende de contenido,
enlaces y tiempo. Lo que ya esta hecho es toda la parte tecnica.

## Dominio propio opcional

1. Consigue un dominio gratis con el GitHub Student Developer Pack si lo tienes.
2. Anadelo en Vercel, en Project Settings, Domains.
3. Configura los DNS que te indique Vercel.
4. Define `VITE_SITE_URL=https://tudominio.com` en Vercel y redeploy. Esto
   actualiza canonical, Open Graph y sitemap al dominio nuevo.
5. Vuelve a enviar el sitemap en Search Console.

## Mantenimiento y ajustes

- Cada push a la rama principal despliega automaticamente.
- Si ves errores 429 de TMDB, baja `TMDB_QUEUE_MAX_ACTIVE` a `1` o sube
  `TMDB_QUEUE_LEASE_SECONDS` si las sesiones largas pierden el turno.
- Si la cola no aparece nunca, revisa que Upstash este conectado y que las
  variables existan en el entorno Production.
- Si el canonical sigue apuntando a localhost, define `VITE_SITE_URL` y
  redeploy. En Vercel normalmente se detecta solo con
  `VERCEL_PROJECT_PRODUCTION_URL`.
- La cache de TMDB en el navegador se invalida cambiando `CACHE_VERSION` en
  `src/services/tmdbApi.js`.
- La cache de la CDN de Vercel se controla con las cabeceras de
  `api/tmdb/[...path].js`.

## Limites del plan gratuito que conviene conocer

- Vercel Hobby es para proyectos personales, no comerciales.
- Hay limites mensuales de ancho de banda, invocaciones y tiempo de ejecucion.
  Consulta la pagina oficial de precios porque cambian con el tiempo.
- Upstash gratis tiene un limite diario de comandos.
- TMDB pide mantenerse por debajo de unas 50 peticiones por segundo. La cola y
  el tamano de lote actual estan pensados para respetarlo con dos sesiones
  activas.

## Checklist rapido

- [ ] `npm run lint`, `npm test` y `npm run build` pasan en local
- [ ] Repositorio en GitHub
- [ ] Proyecto importado en Vercel
- [ ] `TMDB_API_KEY` configurada en Vercel
- [ ] `VITE_TMDB_API_KEY` NO configurada en Vercel
- [ ] Upstash conectado si quieres cola
- [ ] Deploy correcto
- [ ] `/api/tmdb/search/multi?query=Inception` responde JSON
- [ ] `/api/queue` con `probe` responde `tmdbReady:true`
- [ ] ZIP de ejemplo funciona
- [ ] Dos pestanas muestran la cola
- [ ] `robots.txt` y `sitemap.xml` cargan
- [ ] Open Graph se ve bien
- [ ] Search Console y Bing configurados
- [ ] Dominio propio y `VITE_SITE_URL` si aplica
- [ ] Lighthouse revisado
