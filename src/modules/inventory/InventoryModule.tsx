import { Icon } from "../../shared/Icon";

export function InventoryModule() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Gestión de inventarios</h1>
          <p>Entradas, salidas, stock en tiempo real, vencimientos, categorías, valorización e historial.</p>
        </div>
        <div className="actions">
          <button className="btn btn-soft" data-legacy-click="openModal('modalProducto')">
            Agregar producto
          </button>
          <button className="btn btn-primary" data-legacy-click="openModal('modalMovimiento')">
            ＋ Registrar movimiento
          </button>
        </div>
      </div>

      <div className="grid kpis">
        <div className="card kpi"><div><p>Productos</p><h3 id="kpi-productos">—</h3><span className="muted">4 categorías</span></div><div className="icon"><Icon name="box" /></div></div>
        <div className="card kpi"><div><p>Stock bajo</p><h3 id="kpi-stock-bajo">—</h3><span className="status warn">Revisar</span></div><div className="icon"><Icon name="warning" /></div></div>
        <div className="card kpi"><div><p>Próximos a vencer</p><h3 id="kpi-por-vencer">—</h3><span className="muted">≤ 30 días</span></div><div className="icon"><Icon name="calendar" /></div></div>
        <div className="card kpi"><div><p>Valor total</p><h3 id="kpi-valor-inv">—</h3><span className="muted">Precio promedio ponderado</span></div><div className="icon"><Icon name="coins" /></div></div>
      </div>

      <div className="card glass-panel" style={{ marginTop: 18 }}>
        <div className="card-head"><div><h2>Valor del inventario por categoría</h2><span>Distribución según el stock y costo promedio actuales</span></div></div>
        <div className="chart-box"><canvas id="inventoryChart" /></div>
      </div>

      <div className="card glass-panel" style={{ marginTop: 18 }}>
        <div className="card-head"><div><h2>Flujo valorizado del inventario</h2><span>Solo movimientos vigentes; las salidas se valoran al costo promedio y los anulados no cuentan.</span></div><label className="field"><span>Rango</span><select id="inventory-cashflow-range" defaultValue="6" data-legacy-change="cargarInventario()"><option value="3">Últimos 3 meses</option><option value="6">Últimos 6 meses</option><option value="12">Últimos 12 meses</option></select></label></div>
        <div className="chart-box"><canvas id="inventoryCashflowChart" /></div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="toolbar">
          <input className="search" data-legacy-input="filterTable('stockTable', this.value)" placeholder="Buscar producto..." />
          <select id="inventario-filtro-categoria" data-legacy-change="cargarInventario()">
            <option value="">Todas las categorías</option>
            <option>Agrícolas</option><option>Pecuarios</option><option>Herramientas</option><option>Terminados</option>
          </select>
          <button className="btn btn-soft btn-sm" data-legacy-click="showToast('Historial completo disponible en la sección de movimientos')">
            ↻ Historial
          </button>
        </div>
        <div className="table-wrap">
          <table className="table" id="stockTable">
            <thead><tr><th>Producto</th><th>Categoría</th><th>Finca</th><th>Lote</th><th>Stock</th><th>Mínimo</th><th>Vencimiento</th><th>Valor</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody><tr><td className="empty" colSpan={10}>No hay productos registrados.</td></tr></tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-head"><h2>Movimientos recientes</h2><span>Historial de entradas y salidas</span></div>
        <div className="table-wrap">
          <table className="table" id="movimientosTable">
            <thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th>Cantidad</th><th>Costo unitario</th><th>Proveedor</th><th>Vencimiento</th><th>Detalle</th><th>Acciones</th></tr></thead>
            <tbody><tr><td className="empty" colSpan={9}>No hay movimientos registrados.</td></tr></tbody>
          </table>
        </div>
      </div>
    </>
  );
}
