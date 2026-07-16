/* Orkalis — Panel Admin · Gestión 4.1 Inventario (módulo opcional).
   Dos tipos de producto: de servicio (consumo) y de venta (retail). */

const INV_UNITS = ["unidades", "frascos", "tubos", "ml", "gramos", "litros", "paquetes", "rollos"];

// ── Panel de alertas de stock bajo ───────────────────────────────────
function LowStockPanel({ items, onMove }) {
  if (!items.length) return null;
  return (
    <div style={{ display: "flex", gap: 14, padding: "16px 18px", borderRadius: "var(--radius-md)", marginBottom: 20,
      background: "var(--warning-tint)", border: "1px solid rgba(245,158,11,0.30)" }}>
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: "var(--radius-sm)", background: "rgba(245,158,11,0.18)", flex: "none" }}>
        <Icon name="alert-triangle" size={20} color="#B45309" />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "#92400E" }}>
          {items.length} {items.length === 1 ? "producto necesita" : "productos necesitan"} reposición
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
          {items.map((p) => (
            <button key={p.id} type="button" onClick={() => onMove(p)} style={{
              display: "inline-flex", alignItems: "center", gap: 8, height: 30, padding: "0 10px", cursor: "pointer",
              background: "var(--surface-card)", border: "1px solid rgba(245,158,11,0.35)", borderRadius: "var(--radius-pill)",
              fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-primary)" }}>
              <StockDot status={p.status} withLabel={false} />
              {p.name}
              <span className="data" style={{ color: p.qty === 0 ? "var(--error)" : "#B45309", fontWeight: 700 }}>{p.qty} {p.unit}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Tabla de productos ───────────────────────────────────────────────
function ProductTable({ rows, tipo, onMove, onEdit, onDelete }) {
  const th = { textAlign: "left", padding: "0 14px 10px", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" };
  const td = { padding: "14px", fontSize: "var(--text-sm)", color: "var(--text-primary)", borderTop: "1px solid var(--border-subtle)", verticalAlign: "middle" };
  const num = { ...td, textAlign: "right", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" };
  return (
    <Card padding={0} style={{ overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
          <thead><tr>
            <th style={{ ...th, paddingLeft: 18 }}>Producto</th>
            <th style={th}>Estado</th>
            <th style={{ ...th, textAlign: "right" }}>Cantidad</th>
            <th style={{ ...th, textAlign: "right" }}>Costo</th>
            <th style={{ ...th, textAlign: "right" }}>{tipo === "venta" ? "Precio venta" : "Uso en servicio"}</th>
            <th style={{ ...th, textAlign: "right" }}>Mínimo</th>
            <th style={{ ...th, textAlign: "right" }}>Valor total</th>
            <th style={{ ...th, textAlign: "right", paddingRight: 18 }}></th>
          </tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} style={{ transition: "background var(--dur-fast)" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--gray-50)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                <td style={{ ...td, paddingLeft: 18 }}>
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 2 }}>{p.cat} · {p.supplier}</div>
                </td>
                <td style={td}><StockDot status={p.status} /></td>
                <td style={num}>{p.qty} <span style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-body)", fontSize: "var(--text-xs)" }}>{p.unit}</span></td>
                <td style={num}>{AdminData.COP(p.cost)}</td>
                <td style={num}>{tipo === "venta" ? AdminData.COP(p.sale) : AdminData.COP(p.use)}</td>
                <td style={{ ...num, color: "var(--text-tertiary)" }}>{p.min}</td>
                <td style={{ ...num, fontWeight: 700 }}>{AdminData.COP(p.totalValue)}</td>
                <td style={{ ...td, textAlign: "right", paddingRight: 12 }}>
                  <div style={{ display: "inline-flex", justifyContent: "flex-end" }}>
                    <RowMenu items={[
                      { icon: "repeat", label: "Registrar movimiento", onClick: () => onMove(p) },
                      { icon: "edit", label: "Editar", onClick: () => onEdit(p) },
                      { divider: true },
                      { icon: "trash-2", label: "Eliminar", danger: true, onClick: () => onDelete(p) },
                    ]} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── Modal: Producto de inventario ────────────────────────────────────
function ProductModal({ open, product, vertical, onClose, onSave }) {
  const blank = { name: "", cat: "", unit: "unidades", tipo: "venta", loadMode: "total", lotes: 1, perLote: 1, qty: 0, cost: "", use: "", sale: "", min: 5, supplier: "", notes: "" };
  const [f, setF] = React.useState(blank);
  const [touched, setTouched] = React.useState(false);
  const cats = AdminData.invCategories(vertical);
  React.useEffect(() => {
    if (!open) return; setTouched(false);
    setF(product ? { loadMode: "total", lotes: 1, perLote: product.qty, notes: "", ...product, cost: product.cost, use: product.use || "", sale: product.sale || "" }
      : { ...blank, cat: cats[0] });
  }, [open, product]);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  const computedQty = f.loadMode === "lotes" ? (Number(f.lotes) || 0) * (Number(f.perLote) || 0) : Number(f.qty) || 0;
  const nameErr = touched && !f.name.trim() ? "Escribe un nombre" : null;
  const costErr = touched && (f.cost === "" || f.cost == null) ? "Indica el costo de compra" : null;
  const valid = f.name.trim() && f.cost !== "" && f.cost != null;
  const save = () => { setTouched(true); if (valid) onSave({ ...f, qty: computedQty }); };

  return (
    <Dialog open={open} onClose={onClose} width={600}
      title={product ? "Editar producto" : "Nuevo producto"}
      subtitle={product ? product.name : "Registra un producto de consumo interno o de venta al público."}
      footer={<>
        <Button variant="ghost" size="md" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" size="md" onClick={save}>{product ? "Guardar cambios" : "Crear producto"}</Button>
      </>}>
      <div style={{ padding: "8px 0 18px", display: "flex", flexDirection: "column", gap: 18 }}>
        {/* identidad */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <GField label="Nombre del producto" span={2} error={nameErr}><GInput value={f.name} onChange={set("name")} placeholder="Ej.: Pomada mate" invalid={!!nameErr} /></GField>
          <GField label="Categoría"><GSelect value={f.cat} onChange={set("cat")} options={cats} /></GField>
          <GField label="Unidad de medida"><GSelect value={f.unit} onChange={set("unit")} options={INV_UNITS} /></GField>
        </div>

        {/* tipo */}
        <GField label="Tipo de producto">
          <GSegmented value={f.tipo} onChange={set("tipo")} options={[
            { value: "servicio", label: "De servicio", icon: "scissors" },
            { value: "venta", label: "De venta", icon: "store" },
          ]} />
        </GField>

        {/* carga */}
        <div style={{ padding: 16, borderRadius: "var(--radius-md)", background: "var(--surface-sunken)", border: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>Carga de inventario</span>
            <GSegmented size="sm" value={f.loadMode} onChange={set("loadMode")} options={[
              { value: "total", label: "Cantidad total" },
              { value: "lotes", label: "Por lotes" },
            ]} />
          </div>
          {f.loadMode === "lotes" ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 14, alignItems: "end" }}>
              <GField label="Nº de productos"><GNumber value={f.lotes} onChange={set("lotes")} min={1} /></GField>
              <GField label="Cantidad por producto"><GNumber value={f.perLote} onChange={set("perLote")} min={0} suffix={f.unit} /></GField>
              <div style={{ paddingBottom: 10 }}>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>Total</div>
                <div className="data" style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--text-primary)" }}>{computedQty} {f.unit}</div>
              </div>
            </div>
          ) : (
            <GField label="Cantidad total"><GNumber value={f.qty} onChange={set("qty")} min={0} suffix={f.unit} /></GField>
          )}
        </div>

        {/* costos diferenciados */}
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Costos diferenciados</div>
          <div style={{ display: "grid", gridTemplateColumns: f.tipo === "venta" ? "1fr 1fr 1fr" : "1fr 1fr", gap: 16 }}>
            <GField label="Costo de compra" hint="Por unidad" error={costErr}><GMoney value={f.cost} onChange={set("cost")} invalid={!!costErr} /></GField>
            <GField label="Valor de uso en servicio" hint="Costo interno al usarlo"><GMoney value={f.use} onChange={set("use")} /></GField>
            {f.tipo === "venta" && <GField label="Precio de venta" hint="Al público"><GMoney value={f.sale} onChange={set("sale")} /></GField>}
          </div>
        </div>

        {/* parámetros */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <GField label="Stock mínimo" hint="Avisa cuando baje de este nivel"><GNumber value={f.min} onChange={set("min")} min={0} suffix={f.unit} /></GField>
          <GField label="Proveedor" optional><GInput value={f.supplier} onChange={set("supplier")} placeholder="Ej.: Distrib. La 13" /></GField>
          <GField label="Notas" span={2} optional><GArea value={f.notes} onChange={set("notes")} placeholder="Referencia, presentación, observaciones…" rows={2} /></GField>
        </div>
      </div>
    </Dialog>
  );
}

// ── Modal: Movimiento de stock ───────────────────────────────────────
const MOV_REASONS = {
  entrada: ["Compra", "Devolución de cliente", "Ajuste de inventario", "Traslado entre sucursales"],
  salida: ["Consumo en servicio", "Venta", "Merma / daño", "Ajuste de inventario"],
};
function MovementModal({ open, product, onClose, onSave }) {
  const [dir, setDir] = React.useState("entrada");
  const [qty, setQty] = React.useState(1);
  const [reason, setReason] = React.useState(MOV_REASONS.entrada[0]);
  const [gasto, setGasto] = React.useState(true);
  React.useEffect(() => { if (open) { setDir("entrada"); setQty(1); setReason(MOV_REASONS.entrada[0]); setGasto(true); } }, [open, product]);
  if (!open || !product) return null;
  const onDir = (d) => { setDir(d); setReason(MOV_REASONS[d][0]); };
  const delta = dir === "entrada" ? Number(qty || 0) : -Number(qty || 0);
  const nuevo = Math.max(0, product.qty + delta);
  const esCompra = dir === "entrada" && reason === "Compra";
  const gastoMonto = (Number(qty || 0)) * product.cost;
  return (
    <Dialog open={open} onClose={onClose} width={480}
      title="Registrar movimiento" subtitle={product.name}
      footer={<>
        <Button variant="ghost" size="md" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" size="md" onClick={() => onSave(product, delta, { reason, gasto: esCompra && gasto, gastoMonto })}>Registrar</Button>
      </>}>
      <div style={{ padding: "8px 0 18px", display: "flex", flexDirection: "column", gap: 16 }}>
        <GField label="Tipo de movimiento">
          <GSegmented value={dir} onChange={onDir} options={[
            { value: "entrada", label: "Entrada", icon: "plus" },
            { value: "salida", label: "Salida", icon: "minus" },
          ]} />
        </GField>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 16 }}>
          <GField label="Cantidad"><GNumber value={qty} onChange={setQty} min={1} suffix={product.unit} /></GField>
          <GField label="Motivo"><GSelect value={reason} onChange={setReason} options={MOV_REASONS[dir]} /></GField>
        </div>

        {/* preview de stock */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, padding: "14px 0", borderRadius: "var(--radius-md)", background: "var(--surface-sunken)" }}>
          <div style={{ textAlign: "center" }}><div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>Actual</div><div className="data" style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>{product.qty}</div></div>
          <Icon name="arrow-right" size={18} color="var(--text-tertiary)" />
          <div style={{ textAlign: "center" }}><div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>Nuevo</div>
            <div className="data" style={{ fontSize: "var(--text-lg)", fontWeight: 800, color: nuevo === 0 ? "var(--error)" : nuevo <= product.min ? "#B45309" : "var(--success)" }}>{nuevo}</div></div>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>{product.unit}</span>
        </div>

        {esCompra && (
          <label style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", cursor: "pointer" }}>
            <GSwitch checked={gasto} onChange={setGasto} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>Generar gasto variable asociado</div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>Registra {AdminData.COP(gastoMonto)} como gasto de compra en Finanzas.</div>
            </div>
          </label>
        )}
      </div>
    </Dialog>
  );
}

// ── Pantalla Inventario ──────────────────────────────────────────────
function ScreenInventario({ vertical, consolidated, branch, state, onToast, onRetry }) {
  const [seg, setSeg] = React.useState("venta");
  const [query, setQuery] = React.useState("");
  const [list, setList] = React.useState(() => AdminData.products(vertical));
  const [formOpen, setFormOpen] = React.useState(false);
  const [editP, setEditP] = React.useState(null);
  const [movP, setMovP] = React.useState(null);
  const [delP, setDelP] = React.useState(null);

  React.useEffect(() => { setList(AdminData.products(vertical)); setQuery(""); setSeg("venta"); }, [vertical]);

  const loading = state === "cargando", error = state === "error", forceEmpty = state === "vacio";
  const decorate = (p) => ({ ...p, status: AdminData.stockStatus(p), totalValue: p.qty * p.cost });
  const all = forceEmpty ? [] : list.map(decorate);
  const stats = { count: all.length, low: all.filter((p) => p.qty <= p.min).length, lowList: all.filter((p) => p.qty <= p.min), totalValue: all.reduce((a, p) => a + p.totalValue, 0) };
  const counts = { servicio: all.filter((p) => p.tipo === "servicio").length, venta: all.filter((p) => p.tipo === "venta").length };
  const q = query.trim().toLowerCase();
  let rows = all.filter((p) => p.tipo === seg);
  if (q) rows = rows.filter((p) => p.name.toLowerCase().includes(q) || p.cat.toLowerCase().includes(q) || (p.supplier || "").toLowerCase().includes(q));

  const scope = consolidated ? "Todo el negocio" : branch;
  const openCreate = () => { setEditP(null); setFormOpen(true); };
  const openEdit = (p) => { setEditP(p); setFormOpen(true); };
  const saveProduct = (form) => {
    if (editP) { setList((l) => l.map((p) => p.id === editP.id ? { ...p, ...form } : p)); onToast({ tone: "success", msg: "Producto actualizado" }); }
    else { setList((l) => [{ ...form, id: "iv-" + Date.now() }, ...l]); onToast({ tone: "success", msg: "Producto creado" }); }
    setFormOpen(false); setEditP(null);
  };
  const applyMovement = (p, delta, meta) => {
    setList((l) => l.map((x) => x.id === p.id ? { ...x, qty: Math.max(0, x.qty + delta) } : x));
    setMovP(null);
    onToast({ tone: "success", msg: meta.gasto ? `Entrada registrada · gasto de ${AdminData.COP(meta.gastoMonto)}` : `Movimiento registrado · ${p.name.split(" ")[0]}` });
  };
  const doDelete = (p) => { setList((l) => l.filter((x) => x.id !== p.id)); setDelP(null); onToast({ tone: "info", msg: `${p.name} eliminado` }); };

  return (
    <div>
      <PageHeader eyebrow={scope} title="Inventario" sub="Control de stock de consumo y de venta al público."
        right={<Button variant="primary" size="md" iconLeft="plus" onClick={openCreate}>Nuevo producto</Button>} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
        <StatTile label="Productos" value={loading ? "—" : stats.count} icon="package" loading={loading} />
        <StatTile label="En stock bajo" value={loading ? "—" : stats.low} icon="alert-triangle" loading={loading} accent={stats.low > 0} />
        <StatTile label="Valor del inventario" value={loading ? "—" : AdminData.COP(stats.totalValue)} icon="dollar-sign" loading={loading} />
      </div>

      {error ? <ErrorState onRetry={onRetry} /> : loading ? (
        <Card padding={0}>{[0, 1, 2, 3, 4].map((i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 18px", borderTop: i ? "1px solid var(--border-subtle)" : "none" }}>
            <div style={{ flex: 1 }}><Skeleton w="40%" h={14} /><div style={{ height: 8 }} /><Skeleton w="25%" h={11} /></div>
            <Skeleton w={80} h={14} /><Skeleton w={70} h={14} /><Skeleton w={90} h={14} />
          </div>
        ))}</Card>
      ) : all.length === 0 ? (
        <Card padding={0}>
          <EmptyState icon="package" title="Tu inventario está vacío"
            desc="Agrega productos de consumo o de venta para controlar stock, costos y alertas de reposición."
            action={<Button variant="primary" size="md" iconLeft="plus" onClick={openCreate}>Nuevo producto</Button>} />
        </Card>
      ) : (
        <>
          <LowStockPanel items={stats.lowList} onMove={(p) => setMovP(p)} />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
            <GSegmented value={seg} onChange={setSeg} options={[
              { value: "servicio", label: "De servicio", count: counts.servicio },
              { value: "venta", label: "De venta", count: counts.venta },
            ]} />
            <SearchInput value={query} onChange={setQuery} placeholder="Buscar por nombre o categoría…" width={320} />
          </div>

          {rows.length === 0 ? (
            <Card padding={0}>
              <EmptyState icon="search" title="Sin resultados"
                desc={q ? `Ningún producto coincide con “${query}”.` : `No hay productos ${seg === "venta" ? "de venta" : "de servicio"} registrados.`}
                action={q ? <Button variant="secondary" size="md" onClick={() => setQuery("")}>Limpiar búsqueda</Button>
                  : <Button variant="primary" size="md" iconLeft="plus" onClick={openCreate}>Nuevo producto</Button>} />
            </Card>
          ) : (
            <ProductTable rows={rows} tipo={seg} onMove={(p) => setMovP(p)} onEdit={openEdit} onDelete={(p) => setDelP(p)} />
          )}
        </>
      )}

      <ProductModal open={formOpen} product={editP} vertical={vertical} onClose={() => { setFormOpen(false); setEditP(null); }} onSave={saveProduct} />
      <MovementModal open={!!movP} product={movP} onClose={() => setMovP(null)} onSave={applyMovement} />
      <GConfirm open={!!delP} title="Eliminar producto" danger confirmLabel="Eliminar" confirmIcon="trash-2"
        desc={delP ? <span><strong style={{ color: "var(--text-primary)" }}>{delP.name}</strong> se eliminará del inventario. Esta acción no afecta los movimientos ya registrados.</span> : ""}
        onClose={() => setDelP(null)} onConfirm={() => doDelete(delP)} />
    </div>
  );
}

Object.assign(window, { ScreenInventario });
