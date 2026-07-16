#!/bin/sh
# Arranque de producción (FASE-14). Se invoca como `sh docker-entrypoint.sh`
# (dos tokens, SIN operadores de shell) para que funcione aunque Railway ejecute
# el start command con exec directo en vez de a través de un shell — con
# `node migrate.js && node main.js` el `&&` no se interpretaba y main.js nunca
# arrancaba. Aquí el shell del script SÍ ejecuta ambos pasos en orden.
set -e
echo "→ Aplicando migraciones…"
node dist/db/migrate.js
echo "→ Arrancando API…"
exec node dist/main.js
