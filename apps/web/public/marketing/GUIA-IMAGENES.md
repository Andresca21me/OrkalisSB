# Guía de imágenes de la landing (Orkalis)

Coloca aquí las imágenes con **estos nombres exactos**. Vite sirve esta carpeta
en la raíz del sitio, así que `apps/web/public/marketing/captura-agenda.png` se
carga como `/marketing/captura-agenda.png` (ya referenciado en el código).

Mientras un archivo no exista, la landing muestra un **placeholder guiado** con la
instrucción, así que la página se ve bien desde ya y tú ves dónde va cada foto.

> Optimiza el peso: JPG para fotos (calidad ~80), PNG para capturas de pantalla.
> Ideal < 300 KB por imagen (usa squoosh.app o tinypng.com). Formato WebP también sirve.

## Capturas del producto (screenshots reales del panel)

| Archivo | Dónde aparece | Qué debe mostrar | Medida |
|---|---|---|---|
| `captura-agenda.png` | Showcase · fila "Agenda" | La pestaña **Agenda** del panel admin, con citas del día y estados. Fondo claro, sin datos sensibles reales. | ~1600×1000 (16:10) |
| `captura-finanzas.png` | Showcase · fila "Finanzas" | **Finanzas → liquidaciones o reportes**: repartición por especialista / cierre. | ~1600×1000 (16:10) |

Consejo: toma la captura con la ventana ancha (zoom del navegador al 90–100 %),
recorta bordes y deja algo de aire. Si quieres, enmarca en un "mock" de navegador.

## Foto lifestyle (personas reales — la de mayor impacto)

| Archivo | Dónde | Qué | Medida |
|---|---|---|---|
| `lifestyle-barberia.jpg` | Banda a lo ancho (modo Barbería) | Un **barbero atendiendo** o el interior del local, cálido y profesional. Deja espacio a la **izquierda** (ahí va el texto sobre un degradado oscuro). | ~2000×860 (21:9) |
| `lifestyle-salon.jpg` | Banda a lo ancho (modo Salón) | Igual, pero **salón de belleza / estilista**. | ~2000×860 (21:9) |

El sitio cambia la foto según el toggle Barbería/Salón del menú. La banda aplica un
leve *ken-burns* (zoom lento) y un degradado a la izquierda para legibilidad.

## Avatares (prueba social)

Retratos **cuadrados**, de rostro, buena luz. Se recortan en círculo.

| Archivos | Dónde | Medida |
|---|---|---|
| `avatar-barberia-1.jpg` … `avatar-barberia-4.jpg` | Pila del hero ("+500 negocios") y testimonios (modo Barbería) | ~200×200 (1:1) |
| `avatar-salon-1.jpg` … `avatar-salon-4.jpg` | Ídem (modo Salón) | ~200×200 (1:1) |

Los testimonios usan los avatares 1–3; el hero muestra los 4. Pueden ser fotos de
stock con licencia (Unsplash/Pexels) o de clientes reales con permiso.

## Notas de estilo
- **Coherencia de color**: tonos cálidos/neutros que combinen con el azul marino de marca.
- **Sin texto incrustado** en las fotos (el texto lo pone el sitio).
- **Personas reales** > ilustraciones para la banda lifestyle y avatares.
- Respeta derechos de autor; usa banco de imágenes con licencia comercial.
