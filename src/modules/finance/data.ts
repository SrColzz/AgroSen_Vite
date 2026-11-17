import { supabase } from "../../lib/supabase";
import { appState } from "../../shared/state";
import { escapeHtml, fechaLocalActual, formatDate, renderTable, showToast, updateKpi } from "../../shared/dom";
import { updateFinanceChart } from "../dashboard";
import { formatCurrency } from "../../shared/preferences";

type MovimientoFinanciero = {
  id: string;
  tipo: "Ingreso" | "Egreso";
  categoria: string;
  monto: number;
  fecha: string;
  descripcion: string;
  tercero: string | null;
  finca_id: string | null;
  activo: boolean;
};

type Finca = { id: string; nombre: string };

const doc = document;
let movimientos: MovimientoFinanciero[] = [];
let fincas: Finca[] = [];

window.addEventListener("agrosen:preferences-updated", () => { void cargarMovimientosFinancieros(); });

const moneda = (valor: number) => formatCurrency(valor);

export async function cargarFincasFinancieras(): Promise<void> {
  const { data, error } = await supabase.from("fincas").select("id, nombre").order("nombre");
  if (error) {
    console.error("No se pudieron cargar las fincas para Finanzas:", error);
    showToast("No se pudo cargar la lista de fincas.");
    return;
  }
  fincas = data || [];
  ["gasto-finca", "ing-finca"].forEach((id) => {
    const selector = doc.getElementById(id) as HTMLSelectElement | null;
    if (!selector) return;
    const seleccionado = selector.value;
    selector.replaceChildren(new Option("General (sin finca)", ""));
    fincas.forEach((finca) => selector.add(new Option(finca.nombre, finca.id)));
    if (seleccionado && fincas.some((finca) => finca.id === seleccionado)) selector.value = seleccionado;
  });
}

export async function cargarMovimientosFinancieros(): Promise<void> {
  const [{ data, error }, { data: fincasData, error: errorFincas }] = await Promise.all([
    supabase.from("movimientos_financieros")
      .select("id, tipo, categoria, monto, fecha, descripcion, tercero, finca_id, activo")
      .order("fecha", { ascending: false }).limit(5000),
    supabase.from("fincas").select("id, nombre"),
  ]);

  if (error) {
    console.error("No se pudieron cargar los movimientos financieros:", error);
    renderTable("movimientosFinancierosTable", [], () => "");
    showToast(error.code === "PGRST205" || error.code === "42P01"
      ? "Falta ejecutar finanzas_supabase.sql en Supabase."
      : "No se pudieron cargar los movimientos. Revisa los permisos de Supabase.");
    return;
  }
  if (errorFincas) console.error("No se pudieron cargar nombres de fincas:", errorFincas);
  fincas = fincasData || fincas;
  movimientos = data || [];

  const mesSeleccionado = (doc.getElementById("finance-selected-month") as HTMLInputElement | null)?.value || fechaLocalActual().slice(0, 7);
  const movimientosMes = movimientos.filter((movimiento) => movimiento.activo && movimiento.fecha?.startsWith(mesSeleccionado));
  const movimientosVisiblesMes = movimientos.filter((movimiento) => movimiento.fecha?.startsWith(mesSeleccionado));
  const ingresos = movimientosMes.filter((movimiento) => movimiento.tipo === "Ingreso").reduce((suma, movimiento) => suma + Number(movimiento.monto), 0);
  const egresos = movimientosMes.filter((movimiento) => movimiento.tipo === "Egreso").reduce((suma, movimiento) => suma + Number(movimiento.monto), 0);
  updateKpi("kpi-ingresos", moneda(ingresos));
  updateKpi("kpi-egresos", moneda(egresos));
  updateKpi("kpi-rentabilidad", moneda(ingresos - egresos));
  updateKpi("kpi-cuentas", movimientosMes.length);

  let desde = (doc.getElementById("finance-chart-from") as HTMLInputElement | null)?.value || "";
  let hasta = (doc.getElementById("finance-chart-to") as HTMLInputElement | null)?.value || "";
  const mesHoy = fechaLocalActual().slice(0, 7);
  if (!desde || !hasta) {
    const fechaInicio = new Date(`${mesHoy}-01T00:00:00`);
    fechaInicio.setMonth(fechaInicio.getMonth() - 11);
    desde ||= `${fechaInicio.getFullYear()}-${String(fechaInicio.getMonth() + 1).padStart(2, "0")}`;
    hasta ||= mesHoy;
  }
  if (desde > hasta) {
    showToast("El mes inicial del flujo de caja no puede ser posterior al mes final.");
    desde = hasta;
    const inputDesde = doc.getElementById("finance-chart-from") as HTMLInputElement | null;
    if (inputDesde) inputDesde.value = hasta;
  }
  const clavesMeses: string[] = [];
  const [yearInicio, monthInicio] = desde.split("-").map(Number);
  const [yearFin, monthFin] = hasta.split("-").map(Number);
  const cursor = new Date(yearInicio, monthInicio - 1, 1);
  const fechaFin = new Date(yearFin, monthFin - 1, 1);
  while (cursor <= fechaFin && clavesMeses.length < 60) {
    clavesMeses.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  const totales = new Map(clavesMeses.map((clave) => [clave, { ingresos: 0, egresos: 0 }]));
  movimientos.filter((movimiento) => movimiento.activo).forEach((movimiento) => {
    const total = totales.get(movimiento.fecha?.slice(0, 7));
    if (!total) return;
    total[movimiento.tipo === "Ingreso" ? "ingresos" : "egresos"] += Number(movimiento.monto);
  });
  const labels = clavesMeses.map((clave) => new Date(`${clave}-01T00:00:00`).toLocaleDateString("es-CO", { month: "short" }));
  updateFinanceChart(labels, clavesMeses.map((clave) => totales.get(clave)?.ingresos || 0), clavesMeses.map((clave) => totales.get(clave)?.egresos || 0));

  const fincasPorId = new Map(fincas.map((finca) => [finca.id, finca.nombre]));
  renderTable("movimientosFinancierosTable", movimientosVisiblesMes, (movimiento) => `
    <tr>
      <td>${escapeHtml(formatDate(movimiento.fecha))}</td>
      <td><span class="status ${movimiento.tipo === "Ingreso" ? "ok" : "warn"}">${escapeHtml(movimiento.tipo)}</span></td>
      <td>${escapeHtml(movimiento.categoria)}</td>
      <td>${escapeHtml(movimiento.descripcion)}${movimiento.tercero ? `<small class="muted"> · ${escapeHtml(movimiento.tercero)}</small>` : ""}</td>
      <td>${escapeHtml(movimiento.finca_id ? fincasPorId.get(movimiento.finca_id) || "Finca" : "General")}</td>
      <td>${escapeHtml(moneda(Number(movimiento.monto)))}</td>
      <td><div class="table-actions">
        ${movimiento.activo ? `<button class="btn btn-soft btn-sm" data-legacy-click="editarMovimientoFinanciero('${escapeHtml(movimiento.id)}')">Editar</button><button class="btn btn-danger btn-sm" data-legacy-click="archivarMovimientoFinanciero('${escapeHtml(movimiento.id)}')">Archivar</button>` : `<button class="btn btn-primary btn-sm" data-legacy-click="reactivarMovimientoFinanciero('${escapeHtml(movimiento.id)}')">Activar</button>`}<button class="btn btn-danger btn-sm" data-legacy-click="eliminarMovimientoFinanciero('${escapeHtml(movimiento.id)}')">Eliminar</button>
      </div></td>
    </tr>`);
}

export async function guardarMovimientoFinanciero(tipo: "Ingreso" | "Egreso"): Promise<void> {
  const esIngreso = tipo === "Ingreso";
  const prefijo = esIngreso ? "ing" : "gasto";
  const descripcion = (doc.getElementById(`${prefijo}-concepto`) as HTMLInputElement | null)?.value.trim() || "";
  const categoria = (doc.getElementById(esIngreso ? "ing-tipo" : "gasto-categoria") as HTMLSelectElement | null)?.value || "";
  const monto = Number((doc.getElementById(`${prefijo}-valor`) as HTMLInputElement | null)?.value);
  const fecha = (doc.getElementById(`${prefijo}-fecha`) as HTMLInputElement | null)?.value || "";
  const tercero = esIngreso ? (doc.getElementById("ing-cliente") as HTMLInputElement | null)?.value.trim() || null : null;
  const fincaId = (doc.getElementById(esIngreso ? "ing-finca" : "gasto-finca") as HTMLSelectElement | null)?.value || null;

  if (!descripcion || !categoria || !Number.isFinite(monto) || monto <= 0 || !fecha) {
    showToast("Completa concepto, categoría, un valor mayor que cero y fecha.");
    return;
  }

  const payload = { tipo, categoria, monto, fecha, descripcion, tercero, finca_id: fincaId };
  const editando = appState.registroEnEdicion?.tipo === "movimientoFinanciero";
  const resultado = editando
    ? await supabase.from("movimientos_financieros").update(payload).eq("id", appState.registroEnEdicion.id).select("id").maybeSingle()
    : await supabase.from("movimientos_financieros").insert(payload).select("id").single();
  if (resultado.error || !resultado.data) {
    console.error("No se pudo guardar el movimiento financiero:", resultado.error);
    showToast("No se pudo guardar. Revisa el SQL y los permisos de Supabase.");
    return;
  }

  cerrarFormularioFinanciero();
  showToast(editando ? "Movimiento financiero actualizado." : "Movimiento financiero registrado.");
  await cargarMovimientosFinancieros();
}

export async function editarMovimientoFinanciero(id: string): Promise<void> {
  const movimiento = movimientos.find((item) => item.id === id);
  if (!movimiento) return;
  await cargarFincasFinancieras();
  appState.registroEnEdicion = { tipo: "movimientoFinanciero", id };
  const esIngreso = movimiento.tipo === "Ingreso";
  const modalId = esIngreso ? "modalIngreso" : "modalGasto";
  doc.querySelectorAll(".modal").forEach((modal) => modal.classList.remove("show"));
  doc.getElementById(modalId)?.classList.add("show");
  const prefijo = esIngreso ? "ing" : "gasto";
  (doc.getElementById(`${prefijo}-concepto`) as HTMLInputElement).value = movimiento.descripcion;
  (doc.getElementById(esIngreso ? "ing-tipo" : "gasto-categoria") as HTMLSelectElement).value = movimiento.categoria;
  (doc.getElementById(`${prefijo}-valor`) as HTMLInputElement).value = String(movimiento.monto);
  (doc.getElementById(`${prefijo}-fecha`) as HTMLInputElement).value = movimiento.fecha;
  const fincaSelect = doc.getElementById(esIngreso ? "ing-finca" : "gasto-finca") as HTMLSelectElement;
  fincaSelect.value = movimiento.finca_id || "";
  if (esIngreso) (doc.getElementById("ing-cliente") as HTMLInputElement).value = movimiento.tercero || "";
}

export async function archivarMovimientoFinanciero(id: string): Promise<void> {
  if (!window.confirm("¿Quieres archivar este movimiento financiero? Se conservará en el historial.")) return;
  const { data, error } = await supabase.from("movimientos_financieros").update({ activo: false }).eq("id", id).select("id");
  if (error || !data?.length) {
    console.error("No se pudo archivar el movimiento financiero:", error);
    showToast("No se pudo archivar el movimiento.");
    return;
  }
  showToast("Movimiento archivado; se conservó en el historial.");
  await cargarMovimientosFinancieros();
}

export async function reactivarMovimientoFinanciero(id: string): Promise<void> {
  const { data, error } = await supabase.from("movimientos_financieros").update({ activo: true }).eq("id", id).select("id").maybeSingle();
  if (error || !data) { console.error("No se pudo reactivar el movimiento financiero:", error); showToast("No se pudo activar el movimiento."); return; }
  showToast("Movimiento financiero activado nuevamente.");
  await cargarMovimientosFinancieros();
}

export async function eliminarMovimientoFinanciero(id: string): Promise<void> {
  if (!window.confirm("¿Eliminar permanentemente este movimiento financiero? Esta acción no se puede deshacer.")) return;
  const { error } = await supabase.rpc("eliminar_movimiento_financiero", { p_id_movimiento: id });
  if (error) {
    console.error("No se pudo eliminar el movimiento financiero:", error);
    showToast(error.code === "PGRST202"
      ? "Falta ejecutar eliminar_movimiento_financiero_supabase.sql en Supabase."
      : `No se pudo eliminar el movimiento financiero: ${error.message}`);
    return;
  }
  showToast("Movimiento financiero eliminado permanentemente.");
  await cargarMovimientosFinancieros();
}

function cerrarFormularioFinanciero(): void {
  ["modalGasto", "modalIngreso"].forEach((id) => doc.getElementById(id)?.classList.remove("show"));
  appState.registroEnEdicion = null;
  ["gasto-concepto", "gasto-valor", "gasto-fecha", "ing-concepto", "ing-valor", "ing-fecha", "ing-cliente"].forEach((id) => {
    const input = doc.getElementById(id) as HTMLInputElement | null;
    if (input) input.value = "";
  });
  ["gasto-finca", "ing-finca", "gasto-categoria", "ing-tipo"].forEach((id) => {
    const select = doc.getElementById(id) as HTMLSelectElement | null;
    if (select) select.selectedIndex = 0;
  });
}
