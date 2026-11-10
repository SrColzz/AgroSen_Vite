import { Icon } from "../../shared/Icon";

export function FarmsModule() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Fincas y lotes</h1>
          <p>
            Registra fincas, divide parcelas, valida áreas y consulta su
            distribución.
          </p>
        </div>
        <button
          className="btn btn-primary"
          data-legacy-click="openModal('modalFinca')"
        >
          ＋ Registrar finca
        </button>
      </div>

      <div className="grid kpis">
        <div className="card kpi">
          <div>
            <p>Fincas</p>
            <h3 id="kpi-fincas">—</h3>
            <span className="muted">Activas</span>
          </div>
          <div className="icon"><Icon name="farm" /></div>
        </div>
        <div className="card kpi">
          <div>
            <p>Lotes</p>
            <h3 id="kpi-lotes">—</h3>
            <span className="muted">Parcelas registradas</span>
          </div>
          <div className="icon"><Icon name="map" /></div>
        </div>
        <div className="card kpi">
          <div>
            <p>Área total</p>
            <h3 id="kpi-area-total">—</h3>
            <span className="muted">Superficie administrada</span>
          </div>
          <div className="icon"><Icon name="ruler" /></div>
        </div>
        <div className="card kpi">
          <div>
            <p>Área utilizada</p>
            <h3 id="kpi-area-usada">—</h3>
            <span className="muted">Dentro del límite</span>
          </div>
          <div className="icon"><Icon name="pin" /></div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="toolbar">
          <input
            className="search"
            id="farmSearch"
            data-legacy-input="filterTable('farmTable', this.value)"
            placeholder="Buscar finca, ubicación o suelo..."
          />
          <button
            className="btn btn-soft btn-sm"
            disabled
            title="La vista de mapa requiere configurar un proveedor de mapas."
          >
            <Icon name="map" /> Mapa no configurado
          </button>
        </div>
        <div className="table-wrap">
          <table className="table" id="farmTable">
            <thead>
              <tr>
                <th>Finca</th>
                <th>Ubicación</th>
                <th>Área</th>
                <th>Suelo</th>
                <th>Lotes</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="empty" colSpan={7}>
                  Sin datos. Conecta la base de datos para ver registros.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
