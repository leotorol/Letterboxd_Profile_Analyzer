# Checklist de publicacion

Todo lo que queda depende de cuentas, paneles o decisiones que no se pueden
resolver desde el codigo. Marca cada punto antes de compartir el proyecto.

## 1. Despliegue en Vercel

- [ ] Crear el proyecto en Vercel importando el repositorio de GitHub.
- [ ] Confirmar build command `npm run build`, output `dist`, Node 20 o superior.
- [ ] Configurar `TMDB_API_KEY` en Production, Preview y Development.
- [ ] No configurar `VITE_TMDB_API_KEY` en Vercel.
- [ ] Definir `VITE_SITE_URL` con el dominio final, o dejar que Vercel lo detecte.
- [ ] Opcional: conectar Upstash Redis para activar la cola compartida.
- [ ] Si usas Upstash, verificar `TMDB_QUEUE_MAX_ACTIVE` y `TMDB_QUEUE_LEASE_SECONDS`.
- [ ] Redeploy despues de cambiar variables de entorno.

## 2. Verificacion post deploy

- [ ] Abrir la home y comprobar que carga la pantalla de subida.
- [ ] Probar **Try the demo** y recorrer las nueve secciones.
- [ ] Comprobar que no hay errores en la consola del navegador.
- [ ] Probar con un ZIP propio grande y con un export de watchlist vacia.
- [ ] Probar en movil real, no solo en el emulador.
- [ ] Comprobar `/api/tmdb/search/multi?query=Inception` desde el navegador o con la cabecera `Sec-Fetch-Site: same-origin`.
- [ ] Comprobar `/api/queue` con `{ "action": "probe" }` y la cabecera `Sec-Fetch-Site: same-origin`.
- [ ] Abrir dos pestanas e importar a la vez para ver la cola si Upstash esta activo.
- [ ] Revisar `https://TU-DOMINIO/robots.txt` y `https://TU-DOMINIO/sitemap.xml`.
- [ ] Validar la tarjeta social en opengraph.xyz y en el validador de Twitter.
- [ ] Ejecutar Lighthouse en la pantalla de subida y en la demo.

## 3. Repositorio de GitHub

- [ ] Anadir la URL desplegada en el README, justo debajo del titulo.
- [ ] Poner esa misma URL en el campo Website del repositorio.
- [ ] Escribir una descripcion corta del repo y anadir topics (`letterboxd`, `react`, `vite`, `tmdb`, `data-visualization`).
- [ ] Decidir si renombrar el repo a `letterboxd-stats-analyser`. Si lo haces, actualiza la URL de `package.json`, README y footer.
- [ ] Fijar el repo en tu perfil (pinned repositories).
- [ ] Activar branch protection en `main` y exigir que pase el workflow de CI.
- [ ] Revisar que ningun archivo de configuracion local del editor ni el `.env` aparecen en el repo.
- [ ] Confirmar que la licencia MIT aparece en la pagina del repo.
- [ ] Anadir 2 o 3 capturas reales al README (subida, Quick Facts, A to Z).

## 4. Legal y atribucion

- [ ] Ya esta el texto de atribucion de TMDB en el footer y en el README.
- [ ] Opcional pero recomendado: anadir el logo oficial de TMDB junto al texto, siguiendo sus brand guidelines.
- [ ] Ya esta el disclaimer de que el proyecto no esta afiliado a Letterboxd.
- [ ] Revisar que el nombre del producto es coherente en toda la app y el repo.

## 5. SEO y dominio

- [ ] Enviar `sitemap.xml` en Google Search Console.
- [ ] Enviar `sitemap.xml` en Bing Webmaster Tools.
- [ ] Pedir indexacion de la home desde Search Console.
- [ ] Configurar dominio propio si lo vas a usar y actualizar `VITE_SITE_URL`.
- [ ] Volver a enviar el sitemap despues de cambiar de dominio.
- [ ] Revisar que canonical, Open Graph y sitemap apuntan al dominio final.

## 6. Seguridad y mantenimiento

- [ ] Revisar que `TMDB_API_KEY` no aparece en el bundle ni en el repo.
- [ ] Considerar activar reglas de Vercel Firewall o un rate limit de plataforma si el trafico crece. El limitador actual es por instancia y sirve como freno de emergencia, no como proteccion global.
- [ ] Ejecutar `npm audit` y valorar actualizar dependencias de desarrollo.
- [ ] Activar Dependabot para actualizaciones semanales si quieres mantenerlo al dia.
- [ ] Si cambias el formato de la cache de TMDB, sube `CACHE_VERSION` en `src/services/tmdbApi.js`.
- [ ] Revisar los logs de Functions despues del primer dia de trafico.

## 7. Antes de ensenar el proyecto

- [ ] Probar la demo en incognito, sin cache previa.
- [ ] Comprobar que la demo no muestra datos personales que no quieras publicar.
- [ ] Leer el README como si fueras un reclutador: que se entienda que hace, con que esta hecho y donde probarlo en menos de un minuto.
- [ ] Comprobar que el primer commit no incluye archivos de configuracion local.
