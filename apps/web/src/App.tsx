import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { RolUsuario } from '@orkalis/shared';
import { useAuth } from './lib/auth';
import { applyVertical, loadLandingVertical, normalizeVertical } from './lib/theme';
import { Button, Spinner } from './ui/ui';
import { ChunkErrorBoundary } from './lib/ChunkErrorBoundary';
import { LoginPage } from './pages/LoginPage';

/**
 * Code-splitting por ruta/rol (FASE-14, RNF). Cada app de rol y el sitio público
 * cargan en su propio chunk bajo demanda → el primer paint (login) no arrastra
 * el panel admin ni el shader del marketing. `LoginPage` queda eager: es la
 * pantalla de entrada sin sesión.
 */
const BookingPage = lazy(() => import('./pages/public/BookingPage').then((m) => ({ default: m.BookingPage })));
const AdminApp = lazy(() => import('./pages/admin/AdminApp').then((m) => ({ default: m.AdminApp })));
const SpecApp = lazy(() => import('./pages/spec/SpecApp').then((m) => ({ default: m.SpecApp })));
const RecepcionApp = lazy(() => import('./pages/recepcion/RecepcionApp').then((m) => ({ default: m.RecepcionApp })));
const PlataformaApp = lazy(() => import('./pages/plataforma/PlataformaApp').then((m) => ({ default: m.PlataformaApp })));
const OnboardingApp = lazy(() => import('./pages/onboarding/OnboardingApp').then((m) => ({ default: m.OnboardingApp })));
const SiteApp = lazy(() => import('./pages/site/SiteApp').then((m) => ({ default: m.SiteApp })));
const UiCatalog = lazy(() => import('./pages/_ui/UiCatalog').then((m) => ({ default: m.UiCatalog })));
const RecuperarAcceso = lazy(() => import('./pages/RecuperarAcceso').then((m) => ({ default: m.RecuperarAcceso })));
const VerificarCorreoPage = lazy(() => import('./pages/public/VerificarCorreoPage').then((m) => ({ default: m.VerificarCorreoPage })));
const RestablecerPage = lazy(() => import('./pages/public/RestablecerPage').then((m) => ({ default: m.RestablecerPage })));
const InvitacionPage = lazy(() => import('./pages/public/InvitacionPage').then((m) => ({ default: m.InvitacionPage })));

function Pantalla({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>{children}</div>
  );
}

export function App() {
  const { usuario, cargando, cuentaSuspendida } = useAuth();

  // Tema visual de la plataforma = tipo de negocio de la cuenta. Se aplica al
  // iniciar sesión y tras recargar (usuario viene de /auth/me), de forma que el
  // tema NO depende solo del estado del front. La landing gestiona el suyo.
  useEffect(() => {
    if (usuario) applyVertical(normalizeVertical(usuario.negocio.perfil));
    else applyVertical(loadLandingVertical());
  }, [usuario]);

  if (cargando) {
    return (
      <Pantalla>
        <Spinner size={28} />
      </Pantalla>
    );
  }

  // Sesión con la cuenta del negocio suspendida: bloquea el acceso al panel.
  const enSesion = usuario && !cuentaSuspendida;
  // Sesión LIMITADA de recuperación (FASE-11): hay tokens pero la cuenta está
  // bloqueada → solo puede ver/pagar la facturación en /recuperar.
  const limitada = cuentaSuspendida;

  return (
    <ChunkErrorBoundary fallback={(reintentar, esVersionNueva) => <PantallaError onReintentar={reintentar} esVersionNueva={esVersionNueva} />}>
      <Suspense
        fallback={
          <Pantalla>
            <Spinner size={28} />
          </Pantalla>
        }
      >
      <Routes>
        {/* Catálogo del Design System — solo en desarrollo (FASE-01). */}
        {import.meta.env.DEV && <Route path="/_ui" element={<UiCatalog />} />}

        {/* Enlace público de reservas — sin sesión. */}
        <Route path="/reservar/:sucursalId" element={<BookingPage />} />

        {/* Enlaces que llegan por correo (Plan-Correo): funcionan con o sin
            sesión — pueden abrirse en otro dispositivo. */}
        <Route path="/verificar-correo" element={<VerificarCorreoPage />} />
        <Route path="/restablecer" element={<RestablecerPage />} />
        <Route path="/invitacion" element={<InvitacionPage />} />

        <Route
          path="/login"
          element={enSesion ? <Navigate to="/" replace /> : limitada ? <Navigate to="/recuperar" replace /> : <LoginPage />}
        />

        {/* Recuperación de acceso (FASE-11): sesión limitada paga aquí. */}
        <Route
          path="/recuperar"
          element={limitada ? <RecuperarAcceso /> : <Navigate to={enSesion ? '/' : '/login'} replace />}
        />

        {/* Onboarding del negocio (admin). */}
        <Route path="/onboarding/*" element={<Protegido rol={[RolUsuario.Admin]}><OnboardingApp /></Protegido>} />

        {/* Paneles internos por rol. */}
        <Route path="/admin/*" element={<Protegido rol={[RolUsuario.Admin]}><AdminApp /></Protegido>} />
        <Route path="/especialista/*" element={<Protegido rol={[RolUsuario.Especialista]}><SpecApp /></Protegido>} />
        <Route path="/recepcion/*" element={<Protegido rol={[RolUsuario.Recepcionista]}><RecepcionApp /></Protegido>} />
        <Route path="/plataforma/*" element={<Protegido rol={[RolUsuario.OperadorPlataforma]}><PlataformaApp /></Protegido>} />

        {/* Sitio público de marketing (FASE-12, solo visual). Para sesiones
            activas, cualquier ruta desconocida redirige al panel por rol;
            una sesión bloqueada va a la recuperación de acceso. */}
        <Route path="/*" element={enSesion ? <Inicio /> : limitada ? <Navigate to="/recuperar" replace /> : <SiteApp />} />
      </Routes>
      </Suspense>
    </ChunkErrorBoundary>
  );
}

/**
 * Pantalla de rescate: sustituye a la ventana en blanco cuando el árbol de React
 * se cae. El caso frecuente es "hay una versión nueva desplegada" y el
 * ErrorBoundary ya habrá recargado solo; si aun así se llega aquí, al menos hay
 * un mensaje y un botón en vez de nada.
 */
function PantallaError({ onReintentar, esVersionNueva }: { onReintentar: () => void; esVersionNueva: boolean }) {
  return (
    <Pantalla>
      <div style={{ textAlign: 'center', maxWidth: 380, padding: 24 }}>
        <h1 style={{ fontSize: 'var(--text-lg)', marginBottom: 8 }}>
          {esVersionNueva ? 'Hay una versión nueva' : 'Algo salió mal'}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 20 }}>
          {esVersionNueva
            ? 'Actualizamos la aplicación mientras la tenías abierta. Recarga para continuar; no perdiste nada de lo que ya habías guardado.'
            : 'No pudimos cargar esta pantalla. Recarga la página para volver a intentarlo.'}
        </p>
        <Button onClick={onReintentar} iconLeft="refresh-cw">Recargar</Button>
      </div>
    </Pantalla>
  );
}

function Inicio() {
  const { usuario } = useAuth();
  if (!usuario) return <Navigate to="/login" replace />;
  const destino: Record<string, string> = {
    [RolUsuario.Admin]: '/admin',
    [RolUsuario.Especialista]: '/especialista',
    [RolUsuario.Recepcionista]: '/recepcion',
    [RolUsuario.OperadorPlataforma]: '/plataforma',
  };
  return <Navigate to={destino[usuario.rol] ?? '/login'} replace />;
}

function Protegido({ rol, children }: { rol: RolUsuario[]; children: ReactNode }) {
  const { usuario, cuentaSuspendida } = useAuth();
  if (cuentaSuspendida) return <Navigate to="/recuperar" replace />;
  if (!usuario) return <Navigate to="/login" replace />;
  if (!rol.includes(usuario.rol)) return <Inicio />;
  return <>{children}</>;
}
