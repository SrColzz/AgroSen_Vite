import { Icon } from "../../shared/Icon";

export function LivestockModule() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Módulo pecuario</h1>
          <p>Fichas individuales, trazabilidad, sanidad, reproducción, producción, peso y movimientos.</p>
        </div>
        <button className="btn btn-primary" data-legacy-click="openModal('modalAnimal')">＋ Registrar animal</button>
      </div>

      <div className="grid module-grid">
        <div className="card module-card">
          <div className="module-icon"><Icon name="cattle" /></div><h3>Inventario animal</h3>
          <p>Identificación, especie, raza, sexo y nacimiento.</p>
          <ul className="feature-list"><li>Código único de trazabilidad</li><li>Ficha individual</li><li>Movimientos de ganado</li></ul>
        </div>
        <div className="card module-card">
          <div className="module-icon"><Icon name="shield" /></div><h3>Control sanitario</h3>
          <p>Vacunas, desparasitación y tratamientos.</p>
          <ul className="feature-list"><li>Próximas aplicaciones</li><li>Alertas sanitarias</li><li>Historial veterinario</li></ul>
          <button className="btn btn-soft btn-sm" data-legacy-click="showPage('alertas')">Ver alertas</button>
        </div>
        <div className="card module-card">
          <div className="module-icon"><Icon name="milk" /></div><h3>Producción y peso</h3>
          <p>Producción diaria y ganancia de peso.</p>
          <ul className="feature-list"><li>Promedios por animal</li><li>Pesajes por fecha</li><li>Leche, huevos u otros</li></ul>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-head">
          <h2>Animales registrados</h2>
          <button className="btn btn-soft btn-sm" data-legacy-click="exportarAnimalesCSV()">Exportar CSV</button>
        </div>
        <div className="table-wrap"><table className="table" id="animalesTable">
          <thead><tr><th>Identificación</th><th>Especie</th><th>Raza</th><th>Sexo</th><th>Nacimiento</th><th>Trazabilidad</th><th>Ubicación</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody><tr><td className="empty" colSpan={9}>No hay animales registrados.</td></tr></tbody>
        </table></div>
      </div>

      <div className="pecuario-registros">
        <div className="card" style={{ marginTop: 18 }}>
          <div className="card-head"><h2>Control sanitario</h2><button className="btn btn-soft btn-sm" data-legacy-click="openModal('modalEventoSanitario')">＋ Registrar evento</button></div>
          <div className="table-wrap"><table className="table" id="eventosSanitariosTable">
            <thead><tr><th>Fecha</th><th>Animal</th><th>Tipo</th><th>Producto o intervención</th><th>Veterinario</th><th>Próxima fecha</th><th>Acciones</th></tr></thead>
            <tbody><tr><td className="empty" colSpan={7}>Sin eventos sanitarios.</td></tr></tbody>
          </table></div>
        </div>

        <div className="card" style={{ marginTop: 18 }}>
          <div className="card-head"><h2>Pesajes</h2><button className="btn btn-soft btn-sm" data-legacy-click="openModal('modalPesaje')">＋ Registrar pesaje</button></div>
          <div className="table-wrap"><table className="table" id="pesajesTable">
            <thead><tr><th>Fecha</th><th>Animal</th><th>Peso</th><th>Condición</th><th>Observaciones</th><th>Acciones</th></tr></thead>
            <tbody><tr><td className="empty" colSpan={6}>Sin pesajes registrados.</td></tr></tbody>
          </table></div>
        </div>

        <div className="card" style={{ marginTop: 18 }}>
          <div className="card-head"><h2>Producción animal</h2><button className="btn btn-soft btn-sm" data-legacy-click="openModal('modalProduccionAnimal')">＋ Registrar producción</button></div>
          <div className="table-wrap"><table className="table" id="produccionesAnimalTable">
            <thead><tr><th>Fecha</th><th>Animal</th><th>Tipo</th><th>Cantidad</th><th>Observaciones</th><th>Acciones</th></tr></thead>
            <tbody><tr><td className="empty" colSpan={6}>Sin producción registrada.</td></tr></tbody>
          </table></div>
        </div>
      </div>
    </>
  );
}
