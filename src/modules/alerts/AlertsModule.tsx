import { useEffect, useState } from "react";
import { cambiarEstadoAlerta, cargarAlertas, eliminarAlerta, type Alerta } from "./data";
import { Icon } from "../../shared/Icon";

export function AlertsModule() {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);

  async function actualizar() {
    setLoading(true);
    setAlertas(await cargarAlertas());
    setLoading(false);
  }

  useEffect(() => { void actualizar(); }, []);

  async function cambiarEstado(id: string, estado: "vista" | "resuelta") {
    if (await cambiarEstadoAlerta(id, estado)) await actualizar();
  }

  async function borrar(id: string) {
    if (!window.confirm("¿Eliminar permanentemente esta alerta?")) return;
    if (await eliminarAlerta(id)) await actualizar();
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Alertas y notificaciones</h1>
          <p>Centraliza eventos críticos, actividades pendientes y recordatorios sanitarios.</p>
        </div>
        <button className="btn btn-primary" data-legacy-click="showPage('configuracion')">＋ Configurar alertas</button>
      </div>

      <div className="grid module-grid">
        <div className="card module-card">
          <div className="module-icon"><Icon name="warning" /></div><h3>Stock bajo</h3>
          <p>Productos por debajo del mínimo configurado.</p>
          <ul className="feature-list"><li>Sin alertas activas</li><li>Umbrales configurables</li></ul>
        </div>
        <div className="card module-card">
          <div className="module-icon"><Icon name="shield" /></div><h3>Sanitarias</h3>
          <p>Vacunaciones y desparasitaciones próximas.</p>
          <ul className="feature-list"><li>Sin alertas activas</li><li>Recordatorios programados</li></ul>
        </div>
        <div className="card module-card">
          <div className="module-icon"><Icon name="mail" /></div><h3>Email</h3>
          <p>Eventos críticos enviados por correo.</p>
          <ul className="feature-list"><li>SMTP configurable</li><li>Preferencias por usuario</li></ul>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-head"><h2>Centro de alertas</h2><span>Últimos eventos</span></div>
        <div className="table-wrap">
          <table className="table" id="alertasTable">
            <thead><tr><th>Fecha</th><th>Tipo</th><th>Mensaje</th><th>Módulo</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {loading ? <tr><td className="empty" colSpan={6}>Cargando alertas...</td></tr>
                : alertas.length === 0 ? <tr><td className="empty" colSpan={6}>Sin alertas registradas.</td></tr>
                  : alertas.map((alerta) => <tr key={alerta.id}>
                    <td>{new Date(alerta.fecha).toLocaleString("es-CO")}</td>
                    <td>{alerta.tipo}</td><td>{alerta.mensaje}</td><td>{alerta.modulo_origen}</td>
                    <td><span className={`status ${alerta.estado === "pendiente" ? "warn" : alerta.estado === "resuelta" ? "ok" : ""}`}>{alerta.estado}</span></td>
                    <td><div className="table-actions">
                      {alerta.estado === "pendiente" && <button className="btn btn-soft btn-sm" onClick={() => void cambiarEstado(alerta.id, "vista")}>Marcar vista</button>}
                      {alerta.estado !== "resuelta" && <button className="btn btn-primary btn-sm" onClick={() => void cambiarEstado(alerta.id, "resuelta")}>Resolver</button>}
                      <button className="btn btn-danger btn-sm" onClick={() => void borrar(alerta.id)}>Eliminar</button>
                    </div></td>
                  </tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
