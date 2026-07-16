/* Orkalis — Panel Admin · Gestión 4.0 (contenedor con pestañas).
   Envuelve Inventario · Servicios · Equipo y respeta la configurabilidad:
   - Inventario sólo si el módulo de inventario está activo.
   - Equipo siempre presente; su sub-sección Liquidación vive dentro de Equipo
     y sólo aparece si la partición por especialista está activa.
   Recuerda la pestaña destino al llegar desde un acceso directo (initialTab). */

function GestionTabBar({ tabs, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 22, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 0 }}>
      {tabs.map((t) => {
        const on = t.id === value;
        return (
          <button key={t.id} type="button" onClick={() => onChange(t.id)} style={{
            display: "inline-flex", alignItems: "center", gap: 9, height: 44, padding: "0 16px", marginBottom: -1,
            border: "none", borderBottom: `2px solid ${on ? "var(--brand)" : "transparent"}`, background: "transparent", cursor: "pointer",
            color: on ? "var(--text-primary)" : "var(--text-secondary)", fontFamily: "var(--font-body)", fontSize: "var(--text-base)", fontWeight: 600,
            transition: "color var(--dur-fast) var(--ease-out)",
          }}>
            <Icon name={t.icon} size={18} color={on ? "var(--brand)" : "var(--text-tertiary)"} />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function ScreenGestion({ vertical, consolidated, branch, state, inventoryOn, particion, initialTab, onTabChange, onToast, onRetry }) {
  const tabs = [
    ...(inventoryOn ? [{ id: "inventario", label: "Inventario", icon: "package" }] : []),
    { id: "servicios", label: "Servicios", icon: "scissors" },
    { id: "equipo", label: "Equipo", icon: "users" },
  ];
  const valid = (id) => tabs.some((t) => t.id === id);
  const [tab, setTab] = React.useState(() => (valid(initialTab) ? initialTab : tabs[0].id));

  // recuerda el acceso directo entrante
  React.useEffect(() => { if (initialTab && valid(initialTab)) setTab(initialTab); }, [initialTab]);
  // si Inventario se desactiva estando activo, cae a Servicios
  React.useEffect(() => { if (!valid(tab)) setTab(tabs[0].id); }, [inventoryOn]);

  const change = (id) => { setTab(id); if (onTabChange) onTabChange(id); };
  const shared = { vertical, consolidated, branch, state, onToast, onRetry };

  return (
    <div>
      <GestionTabBar tabs={tabs} value={tab} onChange={change} />
      {tab === "inventario" && <ScreenInventario {...shared} />}
      {tab === "servicios" && <ScreenServicios {...shared} />}
      {tab === "equipo" && <ScreenEquipo {...shared} particion={particion} />}
    </div>
  );
}

Object.assign(window, { ScreenGestion });
