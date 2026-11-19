import { useEffect } from "react";
import { initProductionChart } from "./index";
import { Icon } from "../../shared/Icon";

export function DashboardModule() {
  useEffect(() => {
    initProductionChart();
  }, []);

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Panel ejecutivo</span>
          <h1>Bienvenido</h1>
          <p>Resumen de cultivos, producción pecuaria, inventarios, finanzas y alertas de AgroNext.</p>
        </div>
        <div className="actions">
          <button className="btn btn-white" data-legacy-click="showPage('reportes')"><Icon name="chart" /> Ver reportes</button>
          <button className="btn btn-primary" data-legacy-click="openModal('modalQuick')">＋ Registro rápido</button>
        </div>
      </div>

      <div className="grid kpis">
        <div className="card kpi"><div><p>Cultivos activos</p><h3 id="kpi-cultivos">—</h3><span className="trend">Sin datos</span></div><div className="icon"><Icon name="harvest" /></div></div>
        <div className="card kpi"><div><p>Animales registrados</p><h3 id="kpi-animales">—</h3><span className="trend">Sin datos</span></div><div className="icon"><Icon name="cattle" /></div></div>
        <div className="card kpi"><div><p>Valor inventario</p><h3 id="kpi-inventario">—</h3><span className="trend">Sin datos</span></div><div className="icon"><Icon name="box" /></div></div>
        <div className="card kpi"><div><p>Balance del período</p><h3 id="kpi-balance">—</h3><span className="trend">Sin datos</span></div><div className="icon"><Icon name="coins" /></div></div>
      </div>

      <div className="grid dashboard-grid" style={{ marginTop: 18 }}>
        <div className="card glass-panel">
          <div className="card-head"><div><h2>Inventario por categoría</h2><span>Valor actual del stock</span></div></div>
          <div className="chart-box"><canvas id="dashboardInventoryChart" /><p id="dashboardInventoryEmpty" className="chart-empty" hidden /></div>
        </div>
        <div className="card glass-panel">
          <div className="card-head"><div><h2>Cultivos planificados</h2><span>Cantidad de planes por tipo de cultivo</span></div></div>
          <div className="chart-box"><canvas id="dashboardCropsChart" /><p id="dashboardCropsEmpty" className="chart-empty" hidden /></div>
        </div>
        <div className="card glass-panel">
          <div className="card-head">
            <div><h2>Ingresos y egresos</h2><span>Flujo mensual en pesos colombianos</span></div>
            <select className="chart-period" data-legacy-change="updateChart('finance', this.value)" aria-label="Período de ingresos y egresos" defaultValue="6">
              <option value="3">Último trimestre</option><option value="6">Últimos 6 meses</option><option value="12">Último año</option>
            </select>
          </div>
          <div className="chart-box"><canvas id="dashboardFinanceChart" /><p id="dashboardFinanceEmpty" className="chart-empty" hidden /></div>
        </div>
        <div className="card glass-panel">
          <div className="card-head">
            <div><h2>Producción de leche</h2><span>Litros registrados por mes</span></div>
            <select className="chart-period" data-legacy-change="updateChart('milk', this.value)" aria-label="Período de producción de leche" defaultValue="6">
              <option value="3">Último trimestre</option><option value="6">Últimos 6 meses</option><option value="12">Último año</option>
            </select>
          </div>
          <div className="chart-box"><canvas id="dashboardMilkChart" /><p id="dashboardMilkEmpty" className="chart-empty" hidden /></div>
        </div>
      </div>

      <div className="card glass-panel" style={{ marginTop: 18 }}>
        <div className="card-head"><h2>Alertas importantes</h2><button className="btn btn-soft btn-sm" data-legacy-click="showPage('alertas')">Ver todas</button></div>
        <div className="alerts"><p className="empty">Sin alertas activas.</p></div>
      </div>

      <div className="card glass-panel" style={{ marginTop: 18 }}>
        <div className="card-head"><div><h2>Accesos rápidos</h2><span>Operaciones frecuentes</span></div></div>
        <div className="grid quick-grid">
          <button className="quick" data-legacy-click="openModal('modalFinca')"><Icon name="farm" /><b>Registrar finca</b><span>Crear nueva finca</span></button>
          <button className="quick" data-legacy-click="openModal('modalCultivo')"><Icon name="sprout" /><b>Planificar cultivo</b><span>Programar siembra</span></button>
          <button className="quick" data-legacy-click="openModal('modalAnimal')"><Icon name="cattle" /><b>Registrar animal</b><span>Crear ficha individual</span></button>
          <button className="quick" data-legacy-click="openModal('modalMovimiento')"><Icon name="box" /><b>Movimiento inventario</b><span>Entrada o salida</span></button>
        </div>
      </div>
    </>
  );
}
