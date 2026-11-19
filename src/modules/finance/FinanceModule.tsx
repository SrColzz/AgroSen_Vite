import { Icon } from "../../shared/Icon";

export function FinanceModule() {
  const hoy = new Date();
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
  const inicioGrafica = new Date(hoy.getFullYear(), hoy.getMonth() - 11, 1);
  const mesInicialGrafica = `${inicioGrafica.getFullYear()}-${String(inicioGrafica.getMonth() + 1).padStart(2, "0")}`;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Módulo financiero</h1>
          <p>Ingresos, gastos, costos por actividad, rentabilidad, flujo de caja, cartera y punto de equilibrio.</p>
        </div>
        <div className="actions">
          <button className="btn btn-white" data-legacy-click="openModal('modalGasto')">＋ Gasto</button>
          <button className="btn btn-primary" data-legacy-click="openModal('modalIngreso')">＋ Ingreso</button>
        </div>
      </div>

      <div className="grid kpis">
        <div className="card kpi"><div><p>Ingresos</p><h3 id="kpi-ingresos">—</h3><span className="trend" id="finance-kpi-period-label">Período seleccionado</span></div><div className="icon">↗</div></div>
        <div className="card kpi"><div><p>Egresos</p><h3 id="kpi-egresos">—</h3><span className="muted" id="finance-kpi-period-expenses">Período seleccionado</span></div><div className="icon">↘</div></div>
        <div className="card kpi"><div><p>Rentabilidad</p><h3 id="kpi-rentabilidad">—</h3><span className="muted" id="finance-kpi-period-profit">Ingresos menos egresos</span></div><div className="icon"><Icon name="chart" /></div></div>
        <div className="card kpi"><div><p id="finance-kpi-count-title">Movimientos del período</p><h3 id="kpi-cuentas">—</h3><span className="muted" id="finance-kpi-period-count">Movimientos activos</span></div><div className="icon"><Icon name="file" /></div></div>
      </div>

      <div className="grid dashboard-grid" style={{ marginTop: 18 }}>
        <div className="card" style={{ gridColumn: "1 / -1" }}>
          <div className="card-head"><div><h2>Flujo de caja</h2><span>Rango del gráfico</span></div><div className="toolbar"><label className="field"><span>Desde</span><input id="finance-chart-from" type="month" defaultValue={mesInicialGrafica} data-legacy-change="cargarMovimientosFinancieros()" /></label><label className="field"><span>Hasta</span><input id="finance-chart-to" type="month" defaultValue={mesActual} data-legacy-change="cargarMovimientosFinancieros()" /></label></div></div>
          <div className="chart-box"><canvas id="financeChart" /></div>
        </div>
      </div>

      <div className="card finance-profitability-card" style={{ marginTop: 18 }}>
        <div className="card-head"><div><h2>Rentabilidad por actividad</h2><span>Resumen histórico de todos los ingresos y egresos activos, agrupados por categoría</span></div></div>
        <div id="finance-profitability"><p className="empty">Cargando ingresos y egresos...</p></div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-head"><div><h2>Movimientos financieros</h2><span id="finance-movements-period-label">Registros del mes seleccionado</span></div><div className="finance-movement-filters"><label className="field"><span>Mes</span><input id="finance-selected-month" type="month" defaultValue={mesActual} data-legacy-change="cargarMovimientosFinancieros()" /></label><button id="finance-show-all" className="btn btn-soft" type="button" data-legacy-click="mostrarTodosMovimientosFinancieros()">Todo</button></div></div>
        <div className="table-wrap">
          <table className="table" id="movimientosFinancierosTable">
            <thead><tr><th>Fecha</th><th>Tipo</th><th>Categoría</th><th>Concepto</th><th>Finca</th><th>Valor</th><th>Acciones</th></tr></thead>
            <tbody><tr><td className="empty" colSpan={7}>Cargando movimientos...</td></tr></tbody>
          </table>
        </div>
      </div>
    </>
  );
}
