# FASE-05 · Finanzas: exportaciones

> Parte de `PLAN-PILOTO.md`. Abre ese archivo + este. Prioridad 🟡: antes del cierre de
> quincena del **dom 15-nov** si alcanza; si no, antes del 30-nov.

## Problema
1. **El CSV descarga con nombre `download` y sin extensión** (E2E
   `09-finanzas/analisis.spec.ts` en rojo). En `AnalisisScreen.tsx` (línea ~55) y
   `LiquidacionScreen.tsx` (línea ~40) se crea un `<a>` fuera del documento, se le hace
   `click()` y se llama a `URL.revokeObjectURL` en la misma línea. El navegador puede
   perder el nombre del archivo o el contenido.
2. **Celdas CSV sin escapar.** `liquidaciones.service.ts` (línea ~153) arma filas con
   `"${r.nombre}",...`. Un nombre con comillas rompe el archivo, y uno que empiece por
   `=`, `+`, `-` o `@` se ejecuta como fórmula al abrirlo en Excel ("CSV injection").
   El riesgo es bajo porque los nombres los escribe el admin, pero se cierra ya.

## Alcance
- `apps/web/src/lib/descargar.ts` (nuevo helper)
- `apps/web/src/pages/admin/AnalisisScreen.tsx`, `LiquidacionScreen.tsx`,
  `config-reservas.tsx` (descarga del QR, mismo patrón)
- `apps/api/src/operacion/liquidaciones.service.ts` y cualquier otro generador CSV del
  backend (buscar `csv` en `apps/api/src`)
- Pruebas: spec de la API para el CSV; E2E `09-finanzas/*` y `10-config/reservas.spec.ts`.

## Pasos 🤖
1. **Pruebas primero:**
   - API: el CSV de liquidaciones con un especialista llamado `Ana "La Jefa"` y otro
     llamado `=1+1` produce celdas válidas (`"Ana ""La Jefa"""` y `"'=1+1"`).
   - E2E: agregar al spec de liquidaciones la misma comprobación de nombre de archivo que
     ya tiene el del análisis (`/liquidacion-.*\.csv/`).
2. **Helper `descargarArchivo(datos: Blob | string, nombre: string)`:** si es un
   `string` que empieza por `data:`, usarlo directo; si no, `URL.createObjectURL`. Agregar
   el `<a>` al `document.body`, hacer `click()`, quitarlo y liberar la URL con
   `setTimeout(..., 1000)`. Limpiar el nombre: sin `/ \ : * ? " < > |`, espacios a `-`.
3. Usar el helper en las tres pantallas.
4. **Helper `csvCelda(valor)` en el backend:** convierte a texto, duplica las comillas,
   antepone `'` si empieza por `= + - @` o tabulador, y envuelve en comillas. Usarlo en
   todos los generadores CSV. El BOM UTF-8 se conserva.
5. Gate + `pnpm --filter web e2e -- e2e/specs/09-finanzas e2e/specs/10-config/reservas.spec.ts`.

## ✅ Criterio de hecho
- `09-finanzas/analisis.spec.ts › exporta el análisis a CSV` en verde.
- Pruebas nuevas en verde.
- 🧑‍💻 En la prueba de humo, Andrés descarga los dos CSV en su Chrome y los abre en Excel
  (`_GUIA-MANUAL.md`, Parte H).

## Qué quedó hecho
_(Claude lo completa.)_

## Hallazgos para fases futuras
_(Claude anota aquí.)_
