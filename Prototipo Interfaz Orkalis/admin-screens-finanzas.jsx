/* Orkalis — Panel Admin · Finanzas 5.0 (contenedor con pestañas).
   Envuelve Análisis · Control quincenal · Reportes.
   Configurabilidad: la pestaña Control quincenal solo aparece si el módulo de
   cierre de período está activo; si está apagado, la operación es acumulada. */

function FinanzasTabBar({ tabs, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid var(--border-subtle)" }}>
      {tabs.map((t) => {
        const on = t.id === value;
        return (
          <button key={t.id} type="button" onClick={() => onChange(t.id)} style={{
            display: "inline-flex", alignItems: "center", gap: 9, height: 44, padding: "0 16px", marginBottom: -1,
            border: "none", borderBottom: `2px solid ${on ? "var(--brand)" : "transparent"}`, background: "transparent", cursor: "pointer",
            color: on ? "var(--text-primary)" : "var(--text-secondary)", fontFamily: "var(--font-body)", fontSize: "var(--text-base)", fontWeight: 600,
            transition: "color var(--dur-fast) var(--ease-out)",
          }}>
            <Icon name={t.icon} size={18} color={on ? "var(--brand)" : "var(--text-tertiary)"} />{t.label}
          </button>
        );
      })}
    </div>
  );
}

function ScreenFinanzas({ vertical, consolidated, branch, state, inventoryOn, cierreOn, particion, scenario, onNav, onToast, onRetry }) {
  const tabs = [
    { id: "analisis", label: "Análisis", icon: "bar-chart-2" },
    ...(cierreOn ? [{ id: "quincenal", label: "Control quincenal", icon: "calendar" }] : []),
    { id: "reportes", label: "Reportes", icon: "pie-chart" },
  ];
  const valid = (id) => tabs.some((t) => t.id === id);
  const [tab, setTab] = React.useState("analisis");
  React.useEffect(() => { if (!valid(tab)) setTab("analisis"); }, [cierreOn]);

  const shared = { vertical, consolidated, branch, state, onToast, onRetry };
  return (
    <div>
      <FinanzasTabBar tabs={tabs} value={tab} onChange={setTab} />
      {tab === "analisis" && <ScreenAnalisis {...shared} inventoryOn={inventoryOn} scenario={scenario} onNav={onNav} />}
      {tab === "quincenal" && cierreOn && <ScreenQuincenal {...shared} />}
      {tab === "reportes" && <ScreenReportes {...shared} particion={particion} />}
    </div>
  );
}

Object.assign(window, { ScreenFinanzas });
