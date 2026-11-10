import { Icon } from "../../shared/Icon";

export function FinanceModule() {
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
        <div className="card kpi"><div><p>Ingresos</p><h3 id="kpi-ingresos">—</h3><span className="trend">Este período</span></div><div className="icon">↗</div></div>
        <div className="card kpi"><div><p>Egresos</p><h3 id="kpi-egresos">—</h3><span className="muted">Incluye costos asociados</span></div><div className="icon">↘</div></div>
        <div className="card kpi"><div><p>Rentabilidad</p><h3 id="kpi-rentabilidad">—</h3></div><div className="icon"><Icon name="chart" /></div></div>
        <div className="card kpi"><div><p>Movimientos del mes</p><h3 id="kpi-cuentas">—</h3><span className="muted">Ingresos y egresos registrados</span></div><div className="icon"><Icon name="file" /></div></div>
      </div>

      <div className="grid dashboard-grid" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="card-head"><h2>Flujo de caja</h2><span>mensual</span></div>
          <div className="chart-box"><canvas id="financeChart" /></div>
        </div>
        <div className="card">
          <div className="card-head"><h2>Rentabilidad por actividad</h2></div>
          <div className="alerts"><p className="empty">Sin datos. Registra ingresos y gastos para ver la rentabilidad.</p></div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-head"><h2>Movimientos financieros</h2><span>Registros activos</span></div>
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
