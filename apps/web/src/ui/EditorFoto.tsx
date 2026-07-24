import { useEffect, useRef, useState } from 'react';
import { CALIDAD, LADO, cargarImagen } from '../lib/imagen';
import { Button, Icon, Modal } from './ui';

/**
 * Editor de la foto de perfil, al estilo de WhatsApp: la imagen se puede
 * arrastrar, hacer zoom (rueda/pellizco/deslizador) y girar antes de recortarla.
 *
 * Antes la foto se recortaba a ciegas por el centro (`prepararFoto`), lo que
 * dejaba muchas caras descentradas o de lado. Aquí el usuario encuadra a su
 * gusto y confirma; la salida sigue siendo un JPEG cuadrado de {@link LADO}px
 * (el `Avatar` lo muestra en círculo), así que nada cambia aguas abajo.
 *
 * Todo el encuadre se guarda **normalizado al lado del lienzo** (desplazamiento
 * en fracción del lado, escala relativa al "cover"): así el mismo cálculo pinta
 * la vista previa a un tamaño y exporta el recorte final a otro, y lo que se ve
 * es exactamente lo que se guarda.
 */

/** Lado en píxeles CSS del lienzo de vista previa. */
const PREVIEW = 264;

interface Encuadre {
  /** Escala relativa al "cover" (1 = la imagen justo cubre el círculo). */
  escala: number;
  /** Giro en grados. */
  giro: number;
  /** Desplazamiento horizontal, en fracción del lado del lienzo. */
  tx: number;
  /** Desplazamiento vertical, en fracción del lado del lienzo. */
  ty: number;
}

const INICIAL: Encuadre = { escala: 1, giro: 0, tx: 0, ty: 0 };
const ESCALA_MIN = 1;
const ESCALA_MAX = 5;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

type Fuente = ImageBitmap | HTMLImageElement;

/**
 * Pinta la imagen encuadrada en un contexto de lado `S`.
 *
 * `cover` = escala mínima para que el lado menor de la imagen cubra el lienzo;
 * a partir de ahí manda `escala`. Como todo va normalizado a `S`, la misma
 * función sirve para la vista previa y para la exportación.
 */
function pintar(ctx: CanvasRenderingContext2D, S: number, img: Fuente, e: Encuadre, fondo: string) {
  const iw = img.width;
  const ih = img.height;
  const cover = S / Math.min(iw, ih);
  const escala = cover * e.escala;

  ctx.save();
  ctx.fillStyle = fondo;
  ctx.fillRect(0, 0, S, S);
  ctx.translate(S / 2 + e.tx * S, S / 2 + e.ty * S);
  ctx.rotate((e.giro * Math.PI) / 180);
  ctx.scale(escala, escala);
  ctx.drawImage(img, -iw / 2, -ih / 2, iw, ih);
  ctx.restore();
}

/** Oscurece todo salvo el círculo interior, para señalar el recorte. */
function mascara(ctx: CanvasRenderingContext2D, S: number) {
  ctx.save();
  ctx.fillStyle = 'rgba(10,15,20,0.46)';
  ctx.beginPath();
  ctx.rect(0, 0, S, S);
  ctx.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2, true);
  ctx.fill('evenodd');
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function EditorFoto({ archivo, onConfirmar, onCancelar }: { archivo: File; onConfirmar: (dataUrl: string) => void; onCancelar: () => void }) {
  const [img, setImg] = useState<Fuente | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enc, setEnc] = useState<Encuadre>(INICIAL);
  const lienzo = useRef<HTMLCanvasElement>(null);

  // Punteros activos (para pellizco multitáctil) y el estado del gesto anterior.
  const punteros = useRef(new Map<number, { x: number; y: number }>());
  const previo = useRef<{ cx: number; cy: number; dist: number } | null>(null);

  useEffect(() => {
    let vivo = true;
    setImg(null);
    setError(null);
    setEnc(INICIAL);
    cargarImagen(archivo)
      .then((bitmap) => vivo && setImg(bitmap))
      .catch((e: unknown) => vivo && setError((e as Error).message || 'No pudimos leer la imagen.'));
    return () => {
      vivo = false;
    };
  }, [archivo]);

  // Redibuja la vista previa ante cualquier cambio de encuadre.
  useEffect(() => {
    const c = lienzo.current;
    if (!c || !img) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const S = PREVIEW * dpr;
    if (c.width !== S) {
      c.width = S;
      c.height = S;
    }
    const ctx = c.getContext('2d');
    if (!ctx) return;
    pintar(ctx, S, img, enc, '#0b0f14');
    mascara(ctx, S);
  }, [img, enc]);

  function centroide() {
    const pts = [...punteros.current.values()];
    const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
    const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    const dist = pts.length >= 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    return { cx, cy, dist };
  }

  function onDown(ev: React.PointerEvent<HTMLCanvasElement>) {
    ev.currentTarget.setPointerCapture(ev.pointerId);
    punteros.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    previo.current = centroide();
  }

  function onMove(ev: React.PointerEvent<HTMLCanvasElement>) {
    if (!punteros.current.has(ev.pointerId)) return;
    punteros.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    const ahora = centroide();
    const antes = previo.current;
    if (antes) {
      const dx = (ahora.cx - antes.cx) / PREVIEW;
      const dy = (ahora.cy - antes.cy) / PREVIEW;
      if (dx || dy) setEnc((e) => ({ ...e, tx: e.tx + dx, ty: e.ty + dy }));
      if (punteros.current.size >= 2 && antes.dist > 0 && ahora.dist > 0) {
        const r = ahora.dist / antes.dist;
        setEnc((e) => ({ ...e, escala: clamp(e.escala * r, ESCALA_MIN, ESCALA_MAX) }));
      }
    }
    previo.current = ahora;
  }

  function onUp(ev: React.PointerEvent<HTMLCanvasElement>) {
    punteros.current.delete(ev.pointerId);
    previo.current = punteros.current.size ? centroide() : null;
  }

  function onWheel(ev: React.WheelEvent<HTMLCanvasElement>) {
    const r = ev.deltaY < 0 ? 1.08 : 1 / 1.08;
    setEnc((e) => ({ ...e, escala: clamp(e.escala * r, ESCALA_MIN, ESCALA_MAX) }));
  }

  function confirmar() {
    if (!img) return;
    const c = document.createElement('canvas');
    c.width = LADO;
    c.height = LADO;
    const ctx = c.getContext('2d');
    if (!ctx) {
      setError('Tu navegador no permite procesar la imagen.');
      return;
    }
    // Fondo blanco: JPEG no admite transparencia y los huecos por giro no deben
    // salir en negro. El Avatar recorta el cuadrado en círculo igualmente.
    pintar(ctx, LADO, img, enc, '#ffffff');
    onConfirmar(c.toDataURL('image/jpeg', CALIDAD));
  }

  return (
    <Modal
      open
      onClose={onCancelar}
      title="Ajusta tu foto"
      ancho={360}
      footer={
        <>
          <Button variant="secondary" onClick={onCancelar}>Cancelar</Button>
          <Button onClick={confirmar} disabled={!img} iconLeft="check">Usar foto</Button>
        </>
      }
    >
      {error ? (
        <div style={{ padding: '24px 8px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>{error}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: '19px' }}>
            Arrastra para mover · pellizca o usa la rueda para acercar
          </div>
          <canvas
            ref={lienzo}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onWheel={onWheel}
            style={{ width: PREVIEW, height: PREVIEW, maxWidth: '100%', borderRadius: 12, background: '#0b0f14', touchAction: 'none', cursor: 'grab', flex: 'none' }}
          />

          {/* Zoom */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
            <Icon name="minus" size={16} color="var(--text-tertiary)" />
            <input
              type="range"
              min={ESCALA_MIN}
              max={ESCALA_MAX}
              step={0.01}
              value={enc.escala}
              onChange={(ev) => setEnc((e) => ({ ...e, escala: Number(ev.target.value) }))}
              aria-label="Zoom"
              style={{ flex: 1, accentColor: 'var(--brand)' }}
            />
            <Icon name="plus" size={16} color="var(--text-tertiary)" />
          </div>

          {/* Giro */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
            <input
              type="range"
              min={-180}
              max={180}
              step={1}
              value={enc.giro}
              onChange={(ev) => setEnc((e) => ({ ...e, giro: Number(ev.target.value) }))}
              aria-label="Giro"
              style={{ flex: 1, accentColor: 'var(--brand)' }}
            />
            <Button size="sm" variant="secondary" iconLeft="rotate-cw" onClick={() => setEnc((e) => ({ ...e, giro: (((e.giro + 90 + 180) % 360) + 360) % 360 - 180 }))}>
              90°
            </Button>
          </div>

          <button
            type="button"
            onClick={() => setEnc(INICIAL)}
            style={{ border: 'none', background: 'transparent', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Icon name="refresh-cw" size={14} color="var(--text-tertiary)" /> Restablecer
          </button>
        </div>
      )}
    </Modal>
  );
}
