import { supabase } from "../../lib/supabase";
import { appState } from "../../shared/state";
import { escapeHtml, fechaLocalActual, formatDate, renderTable, showToast } from "../../shared/dom";
import { formatCurrency } from "../../shared/preferences";

const doc = document;

window.addEventListener("agrosen:preferences-updated", () => { void cargarDatosRRHH(); });

export async function cargarDatosRRHH(): Promise<void> {
  const [empleadosResult, asistenciaResult, nominaResult] = await Promise.all([
    supabase.from("empleados").select("id, finca_id, nombre, identificacion, cargo, salario, fecha_ingreso, tipo_contrato, estado")
      .order("nombre"),
    supabase.from("asistencia").select("id, empleado_id, fecha, hora_entrada, hora_salida, estado")
      .order("fecha", { ascending: false }).limit(100),
    supabase.from("nomina").select("id, empleado_id, periodo, salario_base, deducciones, total_pagado, fecha_pago")
      .order("periodo", { ascending: false }).limit(100),
  ]);

  if (empleadosResult.error) {
    console.error("No se pudieron cargar los empleados:", empleadosResult.error);
    renderTable("empleadosTable", [], () => "");
    showToast(empleadosResult.error.code === "PGRST205" || empleadosResult.error.code === "42P01"
      ? "Falta ejecutar rrhh_alertas_supabase.sql en Supabase."
      : "No se pudieron cargar los empleados. Revisa los permisos de Supabase.");
    return;
  }

  const empleados = empleadosResult.data || [];
  const nombres = new Map(empleados.map((empleado) => [empleado.id, empleado.nombre]));
  renderTable("empleadosTable", empleados, (empleado) => `
    <tr>
      <td>${escapeHtml(empleado.nombre)}</td><td>${escapeHtml(empleado.identificacion)}</td>
      <td>${escapeHtml(empleado.cargo)}</td><td>${escapeHtml(moneda(Number(empleado.salario)))}</td>
      <td>${escapeHtml(formatDate(empleado.fecha_ingreso))}</td><td>${escapeHtml(empleado.estado)}</td>
      <td><div class="table-actions">
        <button class="btn btn-soft btn-sm" data-legacy-click="editarEmpleado('${escapeHtml(empleado.id)}')">Editar</button>
        ${empleado.estado === "Activo" ? `<button class="btn btn-danger btn-sm" data-legacy-click="archivarEmpleado('${escapeHtml(empleado.id)}')">Desactivar</button>` : ""}
      </div></td>
    </tr>`);

  if (asistenciaResult.error) {
    console.error("No se pudo cargar la asistencia:", asistenciaResult.error);
    renderTable("asistenciaTable", [], () => "");
  } else {
    renderTable("asistenciaTable", asistenciaResult.data, (registro) => `
      <tr><td>${escapeHtml(formatDate(registro.fecha))}</td><td>${escapeHtml(nombres.get(registro.empleado_id) || "Empleado")}</td>
      <td>${escapeHtml(registro.hora_entrada || "—")}</td><td>${escapeHtml(registro.hora_salida || "—")}</td><td>${escapeHtml(registro.estado)}</td></tr>`);
    const hoy = asistenciaResult.data.filter((registro) => registro.fecha === fechaLocalActual());
    const presentes = hoy.filter((registro) => registro.estado === "Presente").length;
    const resumen = doc.getElementById("rrhh-asistencia");
    if (resumen) resumen.textContent = `Asistencia de hoy: ${presentes}/${empleados.filter((empleado) => empleado.estado === "Activo").length} presentes`;
  }

  if (nominaResult.error) {
    console.error("No se pudo cargar la nómina:", nominaResult.error);
    renderTable("nominaTable", [], () => "");
  } else {
    renderTable("nominaTable", nominaResult.data, (registro) => `
      <tr><td>${escapeHtml(registro.periodo)}</td><td>${escapeHtml(nombres.get(registro.empleado_id) || "Empleado")}</td>
      <td>${escapeHtml(moneda(Number(registro.salario_base)))}</td><td>${escapeHtml(moneda(Number(registro.deducciones)))}</td>
      <td>${escapeHtml(moneda(Number(registro.total_pagado)))}</td><td>${escapeHtml(formatDate(registro.fecha_pago))}</td></tr>`);
  }
}

export async function cargarEmpleadosEnSelectores(): Promise<void> {
  const { data, error } = await supabase.from("empleados").select("id, nombre").eq("estado", "Activo").order("nombre");
  if (error) {
    console.error("No se pudieron cargar empleados para los formularios:", error);
    showToast("No se pudo cargar la lista de empleados.");
    return;
  }
  ["asistencia-empleado", "nomina-empleado"].forEach((id) => {
    const select = doc.getElementById(id) as HTMLSelectElement | null;
    if (!select) return;
    select.replaceChildren(new Option("Selecciona un empleado", ""));
    (data || []).forEach((empleado) => select.add(new Option(empleado.nombre, empleado.id)));
  });
}

export async function cargarFincasEmpleados(): Promise<void> {
  const { data, error } = await supabase.from("fincas").select("id, nombre").order("nombre");
  if (error) {
    console.error("No se pudieron cargar las fincas para RR. HH.:", error);
    return;
  }
  const select = doc.getElementById("emp-finca") as HTMLSelectElement | null;
  if (!select) return;
  const actual = select.value;
  select.replaceChildren(new Option("Sin finca asignada", ""));
  (data || []).forEach((finca) => select.add(new Option(finca.nombre, finca.id)));
  select.value = actual;
}

export async function guardarEmpleado(): Promise<void> {
  const empleado = {
    nombre: value("emp-nombres"),
    identificacion: value("emp-identificacion"),
    cargo: value("emp-cargo"),
    salario: Number(value("emp-salario")),
    fecha_ingreso: value("emp-fecha-ingreso"),
    tipo_contrato: value("emp-contrato"),
    finca_id: value("emp-finca") || null,
    estado: "Activo",
  };
  if (!empleado.nombre || !empleado.identificacion || !empleado.cargo || !empleado.fecha_ingreso || !Number.isFinite(empleado.salario) || empleado.salario < 0) {
    showToast("Completa nombre, identificación, cargo, salario y fecha de ingreso.");
    return;
  }
  const editando = appState.registroEnEdicion?.tipo === "empleado";
  const resultado = editando
    ? await supabase.from("empleados").update(empleado).eq("id", appState.registroEnEdicion.id).select("id").maybeSingle()
    : await supabase.from("empleados").insert(empleado).select("id").single();
  if (resultado.error || !resultado.data) {
    console.error("No se pudo guardar el empleado:", resultado.error);
    showToast(resultado.error?.code === "23505" ? "Ya existe un empleado con esa identificación." : "No se pudo guardar el empleado.");
    return;
  }
  cerrarModal("modalEmpleado");
  showToast(editando ? "Empleado actualizado." : "Empleado registrado.");
  await cargarDatosRRHH();
}

export async function editarEmpleado(id: string): Promise<void> {
  const { data, error } = await supabase.from("empleados").select("id, finca_id, nombre, identificacion, cargo, salario, fecha_ingreso, tipo_contrato, estado").eq("id", id).maybeSingle();
  if (error || !data) {
    showToast("No se encontró el empleado que quieres editar.");
    return;
  }
  appState.registroEnEdicion = { tipo: "empleado", id };
  await cargarFincasEmpleados();
  ["modalEmpleado"].forEach((modalId) => doc.getElementById(modalId)?.classList.add("show"));
  setValue("emp-nombres", data.nombre);
  setValue("emp-identificacion", data.identificacion);
  setValue("emp-cargo", data.cargo);
  setValue("emp-salario", data.salario);
  setValue("emp-fecha-ingreso", data.fecha_ingreso);
  setValue("emp-contrato", data.tipo_contrato);
  setValue("emp-finca", data.finca_id || "");
}

export async function archivarEmpleado(id: string): Promise<void> {
  if (!window.confirm("¿Quieres desactivar este empleado? Su historial se conservará.")) return;
  const { error } = await supabase.from("empleados").update({ estado: "Inactivo" }).eq("id", id);
  if (error) {
    console.error("No se pudo desactivar el empleado:", error);
    showToast("No se pudo desactivar el empleado.");
    return;
  }
  showToast("Empleado desactivado; su historial se conservó.");
  await cargarDatosRRHH();
}

export async function guardarAsistencia(): Promise<void> {
  const payload = {
    empleado_id: value("asistencia-empleado"), fecha: value("asistencia-fecha"),
    hora_entrada: value("asistencia-entrada") || null, hora_salida: value("asistencia-salida") || null,
    estado: value("asistencia-estado"), observaciones: value("asistencia-observaciones") || null,
  };
  if (!payload.empleado_id || !payload.fecha || !payload.estado) {
    showToast("Selecciona empleado, fecha y estado de asistencia.");
    return;
  }
  const { error } = await supabase.from("asistencia").upsert(payload, { onConflict: "empleado_id,fecha" }).select("id").single();
  if (error) {
    console.error("No se pudo guardar la asistencia:", error);
    showToast("No se pudo guardar la asistencia. Revisa el SQL de RR. HH.");
    return;
  }
  cerrarModal("modalAsistencia");
  showToast("Asistencia registrada.");
  await cargarDatosRRHH();
}

export async function guardarNomina(): Promise<void> {
  const salario = Number(value("nomina-salario"));
  const deducciones = Number(value("nomina-deducciones") || 0);
  const payload = {
    empleado_id: value("nomina-empleado"), periodo: value("nomina-periodo"), salario_base: salario,
    deducciones, total_pagado: salario - deducciones, fecha_pago: value("nomina-fecha-pago") || null,
  };
  if (!payload.empleado_id || !payload.periodo || !Number.isFinite(salario) || salario < 0 || !Number.isFinite(deducciones) || deducciones < 0 || deducciones > salario) {
    showToast("Verifica empleado, período y valores de nómina.");
    return;
  }
  const { error } = await supabase.from("nomina").upsert(payload, { onConflict: "empleado_id,periodo" }).select("id").single();
  if (error) {
    console.error("No se pudo guardar la nómina:", error);
    showToast("No se pudo guardar la nómina. Revisa el SQL de RR. HH.");
    return;
  }
  cerrarModal("modalNomina");
  showToast("Liquidación de nómina registrada.");
  await cargarDatosRRHH();
}

function value(id: string): string {
  return (doc.getElementById(id) as HTMLInputElement | HTMLSelectElement | null)?.value.trim() || "";
}

function setValue(id: string, value: unknown): void {
  const field = doc.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
  if (field) field.value = String(value ?? "");
}

function cerrarModal(id: string): void {
  doc.getElementById(id)?.classList.remove("show");
  appState.registroEnEdicion = null;
}

function moneda(valor: number): string {
  return formatCurrency(valor);
}
