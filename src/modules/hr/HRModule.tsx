import { Icon } from "../../shared/Icon";

export function HRModule() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Recursos humanos</h1>
          <p>Empleados, contratos, asistencia y liquidaciones de nómina.</p>
        </div>
        <button className="btn btn-primary" data-legacy-click="openModal('modalEmpleado')">＋ Registrar empleado</button>
      </div>

      <div className="grid module-grid">
        <div className="card module-card">
          <div className="module-icon"><Icon name="users" /></div><h3>Personal</h3>
          <p>Datos, cargo, salario, ingreso y tipo de contrato.</p>
          <ul className="feature-list"><li>Historial laboral</li><li>Vigencia contractual</li><li>Ficha del empleado</li></ul>
        </div>
        <div className="card module-card">
          <div className="module-icon"><Icon name="clock" /></div><h3>Asistencia</h3>
          <p>Control diario de entrada, salida y novedades del personal.</p>
          <ul className="feature-list"><li>Asistencia diaria</li><li>Estado del día</li><li>Observaciones</li></ul>
          <button className="btn btn-soft btn-sm" data-legacy-click="openModal('modalAsistencia')">Registrar asistencia</button>
        </div>
        <div className="card module-card">
          <div className="module-icon"><Icon name="calculator" /></div><h3>Nómina</h3>
          <p>Liquidación mensual con deducciones configuradas.</p>
          <ul className="feature-list"><li>Salario base</li><li>Deducciones registradas</li><li>Historial de pagos</li></ul>
          <button className="btn btn-soft btn-sm" onClick={() => window.print()}>Imprimir página / guardar como PDF</button>
          <button className="btn btn-soft btn-sm" data-legacy-click="openModal('modalNomina')">Registrar nómina</button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-head">
          <h2>Empleados</h2>
          <span id="rrhh-asistencia">Asistencia del día: —</span>
        </div>
        <div className="table-wrap">
          <table className="table" id="empleadosTable">
            <thead><tr><th>Empleado</th><th>Identificación</th><th>Cargo</th><th>Salario</th><th>Periodicidad</th><th>Ingreso</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody><tr><td className="empty" colSpan={8}>Sin datos. Conecta la base de datos para ver registros.</td></tr></tbody>
          </table>
        </div>
      </div>

      <div className="grid dashboard-grid" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="card-head"><h2>Asistencia reciente</h2><span>Últimos registros</span></div>
          <div className="table-wrap"><table className="table" id="asistenciaTable">
            <thead><tr><th>Fecha</th><th>Empleado</th><th>Entrada</th><th>Salida</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody><tr><td className="empty" colSpan={6}>Sin registros de asistencia.</td></tr></tbody>
          </table></div>
        </div>
        <div className="card">
          <div className="card-head"><h2>Nómina reciente</h2><span>Liquidaciones</span></div>
          <div className="table-wrap"><table className="table" id="nominaTable">
            <thead><tr><th>Período</th><th>Empleado</th><th>Salario</th><th>Deducciones</th><th>Total pagado</th><th>Fecha de pago</th><th>Acciones</th></tr></thead>
            <tbody><tr><td className="empty" colSpan={7}>Sin nóminas registradas.</td></tr></tbody>
          </table></div>
        </div>
      </div>
    </>
  );
}
