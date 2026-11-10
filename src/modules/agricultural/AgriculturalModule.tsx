import { Icon } from "../../shared/Icon";

export function AgriculturalModule() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Módulo agrícola</h1>
          <p>Planificación de cultivos, labores culturales, consumo de insumos, cosechas e historial.</p>
        </div>
        <button className="btn btn-primary" data-legacy-click="openModal('modalCultivo')">＋ Planificar cultivo</button>
      </div>

      <div className="grid module-grid">
        <div className="card module-card">
          <div className="module-icon"><Icon name="sprout" /></div><h3>Planificación</h3>
          <p>Tipo, variedad, lote, siembra y semilla.</p>
          <ul className="feature-list"><li>Fecha estimada de cosecha</li><li>Estado de cada cultivo</li><li>Seguimiento por lote</li></ul>
          <button className="btn btn-soft btn-sm" data-legacy-click="openModal('modalCultivo')">Nueva planificación</button>
        </div>
        <div className="card module-card">
          <div className="module-icon"><Icon name="water" /></div><h3>Labores culturales</h3>
          <p>Riego, fertilización, plagas y deshierbe.</p>
          <ul className="feature-list"><li>Registro de actividad</li><li>Consumo automático de inventario</li><li>Historial por cultivo</li></ul>
          <button className="btn btn-soft btn-sm" data-legacy-click="openModal('modalLabor')">Registrar labor</button>
        </div>
        <div className="card module-card">
          <div className="module-icon"><Icon name="harvest" /></div><h3>Cosechas</h3>
          <p>Cantidad, calidad, fecha y destino.</p>
          <ul className="feature-list"><li>Control de producción</li><li>Destino de cosecha</li><li>Trazabilidad del lote</li></ul>
          <button className="btn btn-soft btn-sm" data-legacy-click="openModal('modalCosecha')">Registrar cosecha</button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-head">
          <div><h2>Catálogo de cultivos</h2><span>Registra los cultivos y variedades que utilizas.</span></div>
          <button className="btn btn-primary btn-sm" data-legacy-click="openModal('modalTipoCultivo')">＋ Agregar cultivo</button>
        </div>
        <div className="table-wrap"><table className="table" id="tiposCultivoTable">
          <thead><tr><th>Cultivo</th><th>Variedad</th><th>Ciclo (días)</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody><tr><td className="empty" colSpan={5}>Sin cultivos en el catálogo.</td></tr></tbody>
        </table></div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-head"><h2>Cultivos activos</h2><span>Historial y seguimiento</span></div>
        <div className="table-wrap"><table className="table" id="cultivosTable">
          <thead><tr><th>Cultivo</th><th>Variedad</th><th>Lote</th><th>Siembra</th><th>Cosecha estimada</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody><tr><td className="empty" colSpan={7}>Sin datos. Conecta la base de datos para ver registros.</td></tr></tbody>
        </table></div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-head"><h2>Labores culturales</h2><button className="btn btn-soft btn-sm" data-legacy-click="openModal('modalLabor')">Registrar labor</button></div>
        <div className="table-wrap"><table className="table" id="laboresTable">
          <thead><tr><th>Fecha</th><th>Actividad</th><th>Cultivo</th><th>Lote</th><th>Insumo</th><th>Acciones</th></tr></thead>
          <tbody><tr><td className="empty" colSpan={6}>Sin labores registradas.</td></tr></tbody>
        </table></div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-head"><h2>Cosechas registradas</h2><button className="btn btn-soft btn-sm" data-legacy-click="openModal('modalCosecha')">Registrar cosecha</button></div>
        <div className="table-wrap"><table className="table" id="cosechasTable">
          <thead><tr><th>Fecha</th><th>Cultivo</th><th>Lote</th><th>Cantidad</th><th>Calidad</th><th>Tipo</th><th>Destino</th><th>Acciones</th></tr></thead>
          <tbody><tr><td className="empty" colSpan={8}>Sin cosechas registradas.</td></tr></tbody>
        </table></div>
      </div>
    </>
  );
}
