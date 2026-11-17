import { supabase } from "../../lib/supabase";
import { appState } from "../../shared/state";
import { calculateHarvest, escapeHtml, fechaLocalActual, formatDate, renderTable, showToast, updateKpi } from "../../shared/dom";
import { actualizarRotulosEdicion, archivarRegistro, reactivarRegistro, cargarDashboard, closeModals, openModal } from "../../app/controller";
import { actualizarUnidadProductoLabor, asegurarProductoEnSelector } from "../inventory";
import { areaFromHa, areaToHa, formatArea, getAreaUnit } from "../../shared/preferences";
const doc: any = document;
const arrayFrom: any = Array.from;

window.addEventListener("agrosen:preferences-updated", () => { void cargarFincas(); });

export async function saveFinca() {
  const nombre = doc.getElementById("finca-nombre").value.trim();
  const ubicacion = doc.getElementById("finca-ubicacion").value.trim();
  const areaTotal = areaToHa(Number(doc.getElementById("finca-area").value));
  const tipoSuelo = doc.getElementById("finca-suelo").value;
  const lotes = arrayFrom(
    doc.querySelectorAll("#finca-lotes-fields .finca-lote-item"),
    (item) => ({
      nombre: item.querySelector("[data-lote-nombre]").value.trim(),
      area: areaToHa(Number(item.querySelector("[data-lote-area]").value)),
      uso: item.querySelector("[data-lote-uso]").value.trim() || null,
    }),
  );

  if (!nombre || !ubicacion || !Number.isFinite(areaTotal) || areaTotal <= 0) {
    showToast("Completa nombre, ubicación y un área mayor que cero.");
    return;
  }

  if (
    lotes.some(
      (lote) =>
        !lote.nombre || !Number.isFinite(lote.area) || lote.area <= 0,
    )
  ) {
    showToast("Completa el nombre y un área mayor que cero para cada lote.");
    return;
  }

  const areaLotes = lotes.reduce((suma, lote) => suma + lote.area, 0);
  if (areaLotes > areaTotal + 0.01) {
    showToast("La suma de las áreas de los lotes supera el área de la finca.");
    return;
  }

  if (appState.registroEnEdicion?.tipo === "finca") {
    const { id, lotesIds } = appState.registroEnEdicion;
    const { error: errorFinca } = await supabase
      .from("fincas")
      .update({ nombre, ubicacion, area_total: areaTotal, tipo_suelo: tipoSuelo })
      .eq("id", id);
    if (errorFinca) {
      console.error("No se pudo actualizar la finca:", errorFinca);
      showToast("No se pudieron guardar los cambios de la finca.");
      return;
    }

    for (const [index, lote] of lotes.entries()) {
      const { error: errorLote } = await supabase
        .from("lotes")
        .update({ nombre: lote.nombre, area: lote.area, uso: lote.uso })
        .eq("id", lotesIds[index]);
      if (errorLote) {
        console.error("No se pudo actualizar un lote de la finca:", errorLote);
        showToast("La finca se actualizó, pero hubo un error al guardar un lote.");
        await cargarFincas();
        return;
      }
    }

    closeModals();
    showToast("Finca y lotes actualizados.");
    await cargarFincas();
    return;
  }

  const { error } = await supabase.rpc("crear_finca_con_lotes", {
    p_nombre: nombre,
    p_ubicacion: ubicacion,
    p_area_total: areaTotal,
    p_tipo_suelo: tipoSuelo,
    p_lotes: lotes,
  });

  if (error) {
    console.error("No se pudo guardar la finca:", error);
    showToast(
      error.code === "PGRST202" || error.code === "PGRST205" || error.code === "42P01"
        ? "Actualiza el módulo de fincas y lotes con el SQL del proyecto."
        : "No se pudo guardar la finca. Revisa permisos y campos en Supabase.",
    );
    return;
  }

  doc.getElementById("finca-nombre").value = "";
  doc.getElementById("finca-ubicacion").value = "";
  doc.getElementById("finca-area").value = "";
  doc.getElementById("finca-suelo").selectedIndex = 0;
  doc.getElementById("finca-cantidad-lotes").value = "0";
  renderLoteFields();
  closeModals();
  showToast(`Finca guardada con ${lotes.length} lote(s).`);
  await cargarFincas();
}

export async function saveCultivo() {
  const tipoSelect = doc.getElementById("cultivo-tipo");
  const opcionCultivo = tipoSelect.selectedOptions[0];
  const idTipoCultivo = tipoSelect.value;
  const tipo = opcionCultivo?.dataset.nombre || "";
  const variedad = doc.getElementById("cultivo-variedad").value.trim();
  const idLote = doc.getElementById("selectLoteCultivo").value;
  const cantidadSemilla = Number(
    doc.getElementById("cultivo-semilla").value,
  );
  const unidadSemilla = doc.getElementById("cultivo-semilla-unidad").value;
  const fechaSiembra = doc.getElementById("cultivo-siembra").value;
  const cicloDias = Number(doc.getElementById("cycle").value);
  const fechaCosecha = doc.getElementById("harvest").value;

  if (!tipo || !idLote || !fechaSiembra) {
    showToast("Completa el cultivo, el lote y la fecha de siembra.");
    return;
  }
  if (!Number.isFinite(cantidadSemilla) || cantidadSemilla <= 0) {
    showToast("Indica una cantidad de semilla mayor que cero.");
    return;
  }
  if (!Number.isInteger(cicloDias) || cicloDias <= 0 || !fechaCosecha) {
    showToast("El ciclo del cultivo debe ser un número de días mayor que cero.");
    return;
  }

  const valoresCultivo = {
    id_tipo_cultivo: idTipoCultivo,
    id_lote: idLote,
    tipo,
    variedad: variedad || null,
    cantidad_semilla: cantidadSemilla,
    unidad_semilla: unidadSemilla,
    fecha_siembra: fechaSiembra,
    ciclo_dias: cicloDias,
    fecha_cosecha_estimada: fechaCosecha,
  };
  const editandoCultivo = appState.registroEnEdicion?.tipo === "cultivo";
  const idCultivoEditado = appState.registroEnEdicion?.id;
  const respuesta = editandoCultivo
    ? await supabase.from("cultivos").update(valoresCultivo).eq("id", idCultivoEditado)
    : await supabase.from("cultivos").insert({ ...valoresCultivo, estado: "Planificado" });
  const { error } = respuesta;

  if (error) {
    console.error("No se pudo guardar el cultivo:", error);
    showToast(
      error.code === "PGRST205" || error.code === "42P01"
        ? "Falta crear la tabla de cultivos en Supabase."
        : "No se pudo guardar el cultivo. Revisa el lote y los permisos en Supabase.",
    );
    return;
  }

  tipoSelect.value = "";
  doc.getElementById("cultivo-variedad").value = "";
  doc.getElementById("selectLoteCultivo").value = "";
  doc.getElementById("cultivo-semilla").value = "";
  doc.getElementById("cultivo-siembra").value = "";
  doc.getElementById("cycle").value = "";
  calculateHarvest();
  closeModals();
  showToast(editandoCultivo ? "Cultivo actualizado." : "Cultivo planificado y guardado correctamente.");
  await cargarCultivos();
  cargarDashboard();
}

export async function guardarTipoCultivo() {
  const nombre = doc
    .getElementById("tipo-cultivo-nombre")
    .value.trim();
  const variedad = doc
    .getElementById("tipo-cultivo-variedad")
    .value.trim();
  const cicloDias = Number(
    doc.getElementById("tipo-cultivo-ciclo").value,
  );

  if (!nombre || !Number.isInteger(cicloDias) || cicloDias <= 0) {
    showToast("Escribe el nombre del cultivo y un ciclo válido en días.");
    return;
  }

  const editandoCatalogo = appState.registroEnEdicion?.tipo === "tipoCultivo";
  const idTipoEditado = appState.registroEnEdicion?.id;
  const { data, error } = editandoCatalogo
    ? await supabase
        .from("tipos_cultivo")
        .update({ nombre, variedad: variedad || null, ciclo_dias: cicloDias })
        .eq("id", idTipoEditado)
        .select("id, nombre, variedad, ciclo_dias")
        .single()
    : await supabase
        .from("tipos_cultivo")
        .insert({ nombre, variedad: variedad || null, ciclo_dias: cicloDias })
        .select("id, nombre, variedad, ciclo_dias")
        .single();

  if (error) {
    console.error("No se pudo guardar el cultivo en el catálogo:", error);
    showToast(
      error.code === "23505"
        ? "Ese cultivo y variedad ya están en el catálogo."
        : "No se pudo guardar. Revisa que ejecutaste el SQL del catálogo.",
    );
    return;
  }

  const reabrirPlanificacion = appState.volverAPlanificacion;
  closeModals();
  await cargarCatalogoCultivos();
  showToast(editandoCatalogo ? "Cultivo del catálogo actualizado." : "Cultivo agregado al catálogo.");

  if (reabrirPlanificacion) {
    openModal("modalCultivo");
    const selector = doc.getElementById("cultivo-tipo");
    selector.value = data.id;
    seleccionarCultivoCatalogo();
  }
}

export async function cargarCatalogoCultivos() {
  const { data, error } = await supabase
    .from("tipos_cultivo")
    .select("id, nombre, variedad, ciclo_dias, activo")
    .order("nombre", { ascending: true });

  if (error) {
    console.error("No se pudo cargar el catálogo de cultivos:", error);
    if (error.code === "PGRST205" || error.code === "42P01") {
      showToast("Falta crear el catálogo de cultivos en Supabase.");
    }
    return;
  }

  const catalogoCompleto = data || [];
  appState.catalogoCultivos = catalogoCompleto.filter((cultivo) => cultivo.activo);
  const tbody = doc.querySelector("#tiposCultivoTable tbody");
  if (tbody) {
    renderTable("tiposCultivoTable", catalogoCompleto, (cultivo) => `
      <tr>
        <td>${escapeHtml(cultivo.nombre)}</td>
        <td>${escapeHtml(cultivo.variedad || "—")}</td>
        <td>${cultivo.ciclo_dias}</td>
        <td><span class="status ${cultivo.activo ? "ok" : "warn"}">${cultivo.activo ? "Disponible" : "Inactivo"}</span></td>
        <td>${cultivo.activo ? `<button class="btn btn-soft btn-sm" data-legacy-click="editarTipoCultivo('${cultivo.id}')">Editar</button><button class="btn btn-soft btn-sm" data-legacy-click="archivarTipoCultivo('${cultivo.id}')">Retirar</button>` : `<button class="btn btn-primary btn-sm" data-legacy-click="reactivarTipoCultivo('${cultivo.id}')">Activar</button>`} <button class="btn btn-danger btn-sm" data-legacy-click="eliminarRegistroPermanente('tipos_cultivo','${cultivo.id}','este tipo de cultivo')">Eliminar</button></td>
      </tr>
    `);
  }

  const selector = doc.getElementById("cultivo-tipo");
  if (!selector) return;
  const seleccionActual = selector.value;
  selector.replaceChildren(
    new Option(
      appState.catalogoCultivos.length
        ? "Selecciona un cultivo"
        : "No hay cultivos en el catálogo",
      "",
    ),
  );

  appState.catalogoCultivos.forEach((cultivo) => {
    const etiqueta = cultivo.variedad
      ? `${cultivo.nombre} · ${cultivo.variedad}`
      : cultivo.nombre;
    const opcion = new Option(etiqueta, cultivo.id);
    opcion.dataset.nombre = cultivo.nombre;
    opcion.dataset.variedad = cultivo.variedad || "";
    opcion.dataset.ciclo = String(cultivo.ciclo_dias);
    selector.add(opcion);
  });
  selector.value = seleccionActual;
  if (selector.value) seleccionarCultivoCatalogo();
}

export async function editarTipoCultivo(id) {
  const cultivo = appState.catalogoCultivos.find((item) => item.id === id);
  if (!cultivo) return;
  openModal("modalTipoCultivo");
  doc.getElementById("tipo-cultivo-nombre").value = cultivo.nombre;
  doc.getElementById("tipo-cultivo-variedad").value = cultivo.variedad || "";
  doc.getElementById("tipo-cultivo-ciclo").value = cultivo.ciclo_dias;
  appState.registroEnEdicion = { tipo: "tipoCultivo", id };
  actualizarRotulosEdicion("tipoCultivo");
}

export function seleccionarCultivoCatalogo() {
  const selector = doc.getElementById("cultivo-tipo");
  const opcion = selector?.selectedOptions[0];
  const variedad = doc.getElementById("cultivo-variedad");
  const ciclo = doc.getElementById("cycle");

  variedad.value = opcion?.dataset.variedad || "";
  ciclo.value = opcion?.dataset.ciclo || "";
  calculateHarvest();
}

export async function guardarLabor() {
  const idLote = doc.getElementById("labor-lote").value;
  const idCultivo = doc.getElementById("labor-cultivo").value;
  const idProducto = doc.getElementById("labor-producto").value || null;
  const actividad = doc.getElementById("labor-actividad").value;
  const insumo = doc.getElementById("labor-insumo").value.trim();
  const cantidadInput = doc.getElementById("labor-cantidad").value;
  const cantidad = cantidadInput ? Number(cantidadInput) : null;
  const unidad = cantidad === null ? null : doc.getElementById("labor-unidad").value;
  const observaciones = doc
    .getElementById("labor-observaciones")
    .value.trim();
  const fecha = doc.getElementById("labor-fecha").value;

  if (!idLote || !idCultivo || !fecha) {
    showToast("Selecciona lote, cultivo y fecha para registrar la labor.");
    return;
  }
  if (idProducto && (cantidad === null || !Number.isFinite(cantidad) || cantidad <= 0)) {
    showToast("Indica la cantidad del producto que se descontará del inventario.");
    return;
  }
  if (cantidad !== null && (!Number.isFinite(cantidad) || cantidad <= 0)) {
    showToast("La cantidad del insumo debe ser mayor que cero.");
    return;
  }

  const datosLabor = {
    id_lote: idLote,
    id_cultivo: idCultivo,
    actividad,
    insumo: insumo || null,
    cantidad_insumo: cantidad,
    unidad_insumo: unidad,
    observaciones: observaciones || null,
    fecha,
  };
  const editandoLabor = appState.registroEnEdicion?.tipo === "labor";
  const respuesta = editandoLabor
    ? await supabase.from("labores_culturales").update({ ...datosLabor, id_producto: idProducto }).eq("id", appState.registroEnEdicion.id)
    : idProducto
      ? await supabase.rpc("registrar_labor_con_inventario", {
          p_id_lote: idLote,
          p_id_cultivo: idCultivo,
          p_actividad: actividad,
          p_id_producto: idProducto,
          p_cantidad: cantidad,
          p_unidad: unidad,
          p_observaciones: observaciones || null,
          p_fecha: fecha,
          p_insumo_manual: insumo || null,
        })
      : await supabase.from("labores_culturales").insert({ ...datosLabor, id_producto: null });
  const { error } = respuesta;

  if (error) {
    console.error("No se pudo guardar la labor:", error);
    showToast(error.message || "No se pudo guardar la labor. Revisa el SQL y los permisos.");
    return;
  }

  doc.getElementById("labor-lote").value = "";
  doc.getElementById("labor-cultivo").replaceChildren(
    new Option("Selecciona primero un lote", ""),
  );
  doc.getElementById("labor-insumo").value = "";
  doc.getElementById("labor-producto").value = "";
  doc.getElementById("labor-cantidad").value = "";
  doc.getElementById("labor-observaciones").value = "";
  doc.getElementById("labor-fecha").value = "";
  closeModals();
  showToast(editandoLabor ? "Labor cultural actualizada." : "Labor cultural guardada.");
  await cargarLabores();
}

export async function guardarCosecha() {
  const idLote = doc.getElementById("cosecha-lote").value;
  const idCultivo = doc.getElementById("cosecha-cultivo").value;
  const cantidad = Number(doc.getElementById("cosecha-cantidad").value);
  const unidad = doc.getElementById("cosecha-unidad").value;
  const calidad = doc.getElementById("cosecha-calidad").value;
  const fecha = doc.getElementById("cosecha-fecha").value;
  const esFinal = doc.getElementById("cosecha-tipo").value === "true";
  const destino = doc.getElementById("cosecha-destino").value.trim();

  if (!idLote || !idCultivo || !fecha) {
    showToast("Selecciona lote, cultivo y fecha para registrar la cosecha.");
    return;
  }
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    showToast("La cantidad cosechada debe ser mayor que cero.");
    return;
  }

  const editandoCosecha = appState.registroEnEdicion?.tipo === "cosecha";
  const respuesta = editandoCosecha
    ? await supabase
        .from("cosechas")
        .update({ cantidad, unidad, calidad, fecha, destino: destino || null })
        .eq("id", appState.registroEnEdicion.id)
    : await supabase.rpc("registrar_cosecha", {
        p_id_cultivo: idCultivo,
        p_id_lote: idLote,
        p_cantidad: cantidad,
        p_unidad: unidad,
        p_calidad: calidad,
        p_fecha: fecha,
        p_destino: destino || null,
        p_es_final: esFinal,
      });
  const { error } = respuesta;

  if (error) {
    console.error("No se pudo guardar la cosecha:", error);
    showToast("No se pudo guardar. Revisa el SQL y que el cultivo siga activo.");
    return;
  }

  doc.getElementById("cosecha-lote").value = "";
  doc.getElementById("cosecha-cultivo").replaceChildren(
    new Option("Selecciona primero un lote", ""),
  );
  doc.getElementById("cosecha-cantidad").value = "";
  doc.getElementById("cosecha-fecha").value = "";
  doc.getElementById("cosecha-destino").value = "";
  doc.getElementById("cosecha-tipo").value = "false";
  closeModals();
  showToast(editandoCosecha ? "Cosecha actualizada." : esFinal ? "Cosecha final guardada; cultivo cerrado." : "Cosecha parcial guardada.");
  await cargarCosechas();
  await cargarCultivos();
  cargarDashboard();
}

export function renderLoteFields() {
  const cantidadInput = doc.getElementById("finca-cantidad-lotes");
  const container = doc.getElementById("finca-lotes-fields");
  if (!cantidadInput || !container) return;

  const cantidad = Math.min(
    30,
    Math.max(0, Number.parseInt(cantidadInput.value, 10) || 0),
  );
  cantidadInput.value = cantidad;
  const valoresActuales = arrayFrom(
    container.querySelectorAll(".finca-lote-item"),
    (item) => ({
      id: item.dataset.loteId || "",
      nombre: item.querySelector("[data-lote-nombre]").value,
      area: item.querySelector("[data-lote-area]").value,
      uso: item.querySelector("[data-lote-uso]").value,
    }),
  );
  container.innerHTML = arrayFrom({ length: cantidad }, (_, index) => `
    <div class="finca-lote-item" data-lote-id="${escapeHtml(valoresActuales[index]?.id || "")}">
      <strong class="finca-lote-title">Lote ${index + 1}</strong>
      <div class="field">
        <label for="finca-lote-nombre-${index}">Nombre del lote</label>
        <input id="finca-lote-nombre-${index}" data-lote-nombre placeholder="Ej. L-01" value="${escapeHtml(valoresActuales[index]?.nombre || "")}" required>
      </div>
      <div class="field">
        <label for="finca-lote-area-${index}" data-area-label>Área (${getAreaUnit()})</label>
        <input id="finca-lote-area-${index}" data-lote-area type="number" min="0.01" step="0.01" value="${escapeHtml(valoresActuales[index]?.area || "")}" required>
      </div>
      <div class="field">
        <label for="finca-lote-uso-${index}">Cultivo / uso (opcional)</label>
        <input id="finca-lote-uso-${index}" data-lote-uso placeholder="Ej. Café" value="${escapeHtml(valoresActuales[index]?.uso || "")}">
      </div>
    </div>
  `).join("");
}

export async function cargarFincas() {
  const { data, error } = await supabase
    .from("fincas")
    .select("id, nombre, ubicacion, area_total, tipo_suelo, detalle_lotes, activo")
    .order("nombre", { ascending: true });

  if (error) {
    console.error("No se pudieron cargar las fincas:", error);
    if (error.code === "PGRST205" || error.code === "42P01") {
      showToast("Falta crear la tabla de fincas en Supabase.");
    }
    return;
  }

  const fincas = data || [];
  const { data: lotesData, error: errorLotes } = await supabase
    .from("lotes")
    .select("id, id_finca, nombre, area, uso, activo")
    .order("nombre", { ascending: true });

  if (errorLotes) {
    console.error("No se pudieron cargar los lotes:", errorLotes);
    showToast("No se pudieron cargar los lotes. Revisa la tabla y sus permisos.");
    return;
  }
  const lotes = lotesData || [];
  const cultivosPorLote = new Map();
  if (lotes.length) {
    const { data: cultivosActivos, error: errorCultivos } = await supabase
      .from("cultivos")
      .select("id_lote, tipo, variedad")
      .eq("activo", true)
      .in("id_lote", lotes.map((lote) => lote.id));
    if (errorCultivos) {
      console.error("No se pudieron cargar los cultivos asociados a los lotes:", errorCultivos);
    } else {
      (cultivosActivos || []).forEach((cultivo) => {
        const grupo = cultivosPorLote.get(cultivo.id_lote) || [];
        grupo.push([cultivo.tipo, cultivo.variedad].filter(Boolean).join(" · "));
        cultivosPorLote.set(cultivo.id_lote, grupo);
      });
    }
  }

  const areaTotal = fincas.reduce(
    (suma, finca) => suma + Number(finca.area_total || 0),
    0,
  );
  const activas = fincas.filter((finca) => finca.activo).length;
  const lotesActivos = lotes.filter((lote) => lote.activo);
  updateKpi("kpi-fincas", activas);
  updateKpi("kpi-lotes", lotesActivos.length);
  updateKpi("kpi-area-total", formatArea(areaTotal));
  updateKpi(
    "kpi-area-usada",
    formatArea(lotesActivos.reduce((suma, lote) => suma + Number(lote.area || 0), 0)),
  );

  const lotesPorFinca = new Map();
  const fincasPorId = new Map(fincas.map((finca) => [finca.id, finca]));
  lotes.forEach((lote) => {
    const grupo = lotesPorFinca.get(lote.id_finca) || [];
    grupo.push(lote);
    lotesPorFinca.set(lote.id_finca, grupo);
  });

  renderTable("farmTable", fincas, (finca) => `
    <tr>
      <td>${escapeHtml(finca.nombre)}</td>
      <td>${escapeHtml(finca.ubicacion)}</td>
      <td>${formatArea(Number(finca.area_total))}</td>
      <td>${escapeHtml(finca.tipo_suelo)}</td>
      <td>${(lotesPorFinca.get(finca.id) || []).length || escapeHtml(finca.detalle_lotes || "—")} ${(lotesPorFinca.get(finca.id) || []).length ? ((lotesPorFinca.get(finca.id) || []).length === 1 ? "lote" : "lotes") : ""}</td>
      <td><span class="status ${finca.activo ? "ok" : "warn"}">${finca.activo ? "Activa" : "Inactiva"}</span></td>
      <td><button class="btn btn-soft btn-sm" data-legacy-click="editarFinca('${finca.id}')">Editar</button> ${finca.activo ? `<button class="btn btn-soft btn-sm" data-legacy-click="archivarFinca('${finca.id}')">Archivar</button>` : `<button class="btn btn-primary btn-sm" data-legacy-click="reactivarFinca('${finca.id}')">Activar</button>`} <button class="btn btn-danger btn-sm" data-legacy-click="eliminarRegistroPermanente('fincas','${finca.id}','esta finca')">Eliminar</button></td>
    </tr>
  `);

  renderTable("lotTable", lotes, (lote) => {
    const finca = fincasPorId.get(lote.id_finca);
    return `
      <tr>
        <td>${escapeHtml(finca?.nombre || "Finca no disponible")}</td>
        <td>${escapeHtml(lote.nombre)}</td>
        <td>${formatArea(Number(lote.area || 0))}</td>
        <td>${escapeHtml([
          ...(cultivosPorLote.get(lote.id) || []),
          lote.uso ? `Uso: ${lote.uso}` : "",
        ].filter(Boolean).join(" · ") || "Sin cultivos ni uso registrado")}</td>
        <td><span class="status ${lote.activo ? "ok" : "warn"}">${lote.activo ? "Activo" : "Inactivo"}</span></td>
        <td>${lote.activo
          ? `<button class="btn btn-soft btn-sm" data-legacy-click="archivarLote('${lote.id}')">Archivar</button>`
          : `<button class="btn btn-primary btn-sm" data-legacy-click="reactivarLote('${lote.id}')">Activar</button>`}
          <button class="btn btn-danger btn-sm" data-legacy-click="eliminarLote('${lote.id}')">Eliminar</button></td>
      </tr>
    `;
  });
}

export async function editarFinca(id) {
  const [{ data: finca, error }, { data: lotes, error: errorLotes }] = await Promise.all([
    supabase.from("fincas").select("id, nombre, ubicacion, area_total, tipo_suelo").eq("id", id).single(),
    supabase.from("lotes").select("id, nombre, area, uso").eq("id_finca", id).order("nombre"),
  ]);
  if (error || errorLotes || !finca) {
    console.error("No se pudo cargar la finca para editar:", error || errorLotes);
    showToast("No se pudo abrir la finca para editar.");
    return;
  }

  openModal("modalFinca");
  doc.getElementById("finca-nombre").value = finca.nombre || "";
  doc.getElementById("finca-ubicacion").value = finca.ubicacion || "";
  doc.getElementById("finca-area").value = areaFromHa(Number(finca.area_total || 0));
  doc.getElementById("finca-suelo").value = finca.tipo_suelo || "Franco";
  doc.getElementById("finca-cantidad-lotes").value = (lotes || []).length;
  doc.getElementById("finca-cantidad-lotes").disabled = true;
  renderLoteFields();
  arrayFrom(doc.querySelectorAll("#finca-lotes-fields .finca-lote-item")).forEach((item, index) => {
    const lote = lotes[index];
    item.dataset.loteId = lote.id;
    item.querySelector("[data-lote-nombre]").value = lote.nombre || "";
    item.querySelector("[data-lote-area]").value = areaFromHa(Number(lote.area || 0));
    item.querySelector("[data-lote-uso]").value = lote.uso || "";
  });
  appState.registroEnEdicion = { tipo: "finca", id, lotesIds: (lotes || []).map((lote) => lote.id) };
  actualizarRotulosEdicion("finca");
}

export async function cargarCultivos() {
  const { data, error } = await supabase
    .from("cultivos")
    .select(
      "id, id_lote, tipo, variedad, fecha_siembra, fecha_cosecha_estimada, estado, activo",
    )
    .order("fecha_siembra", { ascending: false });

  if (error) {
    console.error("No se pudieron cargar los cultivos:", error);
    if (error.code === "PGRST205" || error.code === "42P01") {
      showToast("Falta crear la tabla de cultivos en Supabase.");
    }
    return;
  }

  const todosLosCultivos = data || [];
  const cultivos = todosLosCultivos.filter((cultivo) => cultivo.activo);
  const cultivosInactivos = todosLosCultivos.filter((cultivo) => !cultivo.activo);
  const loteIds = [...new Set(todosLosCultivos.map((cultivo) => cultivo.id_lote))];
  let lotes = [];

  if (loteIds.length) {
    const { data: datosLotes, error: errorLotes } = await supabase
      .from("lotes")
      .select("id, nombre")
      .in("id", loteIds);

    if (errorLotes) {
      console.error("No se pudieron cargar los lotes de los cultivos:", errorLotes);
      showToast("No se pudieron mostrar los lotes de los cultivos.");
      return;
    }
    lotes = datosLotes || [];
  }

  const nombresLotes = new Map(lotes.map((lote) => [lote.id, lote.nombre]));
  updateKpi("kpi-cultivos", cultivos.length);

  renderTable("cultivosTable", cultivos, (cultivo) => `
    <tr>
      <td>${escapeHtml(cultivo.tipo)}</td>
      <td>${escapeHtml(cultivo.variedad || "—")}</td>
      <td>${escapeHtml(nombresLotes.get(cultivo.id_lote) || "—")}</td>
      <td>${formatDate(cultivo.fecha_siembra)}</td>
      <td>${formatDate(cultivo.fecha_cosecha_estimada)}</td>
      <td><span class="status info">${escapeHtml(cultivo.estado)}</span></td>
      <td><button class="btn btn-soft btn-sm" data-legacy-click="editarCultivo('${cultivo.id}')">Editar</button> <button class="btn btn-soft btn-sm" data-legacy-click="archivarCultivo('${cultivo.id}')">Archivar</button> <button class="btn btn-danger btn-sm" data-legacy-click="eliminarRegistroPermanente('cultivos','${cultivo.id}','este cultivo')">Eliminar</button></td>
    </tr>
  `);

  renderTable("cultivosInactivosTable", cultivosInactivos, (cultivo) => `
    <tr>
      <td>${escapeHtml(cultivo.tipo)}</td>
      <td>${escapeHtml(cultivo.variedad || "—")}</td>
      <td>${escapeHtml(nombresLotes.get(cultivo.id_lote) || "—")}</td>
      <td>${formatDate(cultivo.fecha_siembra)}</td>
      <td>${formatDate(cultivo.fecha_cosecha_estimada)}</td>
      <td><span class="status warn">Cerrado / inactivo</span></td>
      <td><button class="btn btn-primary btn-sm" data-legacy-click="reactivarCultivo('${cultivo.id}')">Activar</button> <button class="btn btn-danger btn-sm" data-legacy-click="eliminarRegistroPermanente('cultivos','${cultivo.id}','este cultivo')">Eliminar</button></td>
    </tr>
  `);
}

export async function editarCultivo(id) {
  const { data: cultivo, error } = await supabase
    .from("cultivos")
    .select("id, id_tipo_cultivo, id_lote, tipo, variedad, cantidad_semilla, unidad_semilla, fecha_siembra, ciclo_dias")
    .eq("id", id)
    .single();
  if (error || !cultivo) {
    console.error("No se pudo cargar el cultivo para editar:", error);
    showToast("No se pudo abrir el cultivo para editar.");
    return;
  }

  openModal("modalCultivo");
  await Promise.all([loadLotesEnSelect("selectLoteCultivo"), cargarCatalogoCultivos()]);
  const tipoSelect = doc.getElementById("cultivo-tipo");
  let opcionCultivo = arrayFrom(tipoSelect.options).find((option) => option.value === cultivo.id_tipo_cultivo);
  if (!opcionCultivo) {
    opcionCultivo = arrayFrom(tipoSelect.options).find((option) =>
      option.dataset.nombre === cultivo.tipo && (option.dataset.variedad || "") === (cultivo.variedad || ""),
    );
  }
  if (!opcionCultivo) {
    closeModals();
    showToast("Este cultivo no coincide con el catálogo actual y no se puede editar desde aquí.");
    return;
  }
  tipoSelect.value = opcionCultivo.value;
  seleccionarCultivoCatalogo();
  doc.getElementById("cultivo-variedad").value = cultivo.variedad || "";
  doc.getElementById("selectLoteCultivo").value = cultivo.id_lote;
  doc.getElementById("cultivo-semilla").value = cultivo.cantidad_semilla;
  doc.getElementById("cultivo-semilla-unidad").value = cultivo.unidad_semilla;
  doc.getElementById("cultivo-siembra").value = cultivo.fecha_siembra;
  doc.getElementById("cycle").value = cultivo.ciclo_dias;
  calculateHarvest();
  appState.registroEnEdicion = { tipo: "cultivo", id };
  actualizarRotulosEdicion("cultivo");
}

export async function cargarReferenciasAgricolas(registros) {
  const cultivosIds = [...new Set(registros.map((registro) => registro.id_cultivo))];
  const lotesIds = [...new Set(registros.map((registro) => registro.id_lote))];
  if (!registros.length) {
    return { cultivos: new Map(), lotes: new Map() };
  }

  const [respuestaCultivos, respuestaLotes] = await Promise.all([
    supabase
      .from("cultivos")
      .select("id, tipo, variedad")
      .in("id", cultivosIds),
    supabase.from("lotes").select("id, nombre").in("id", lotesIds),
  ]);

  if (respuestaCultivos.error || respuestaLotes.error) {
    console.error(
      "No se pudieron cargar las referencias agrícolas:",
      respuestaCultivos.error || respuestaLotes.error,
    );
    return null;
  }

  return {
    cultivos: new Map(
      (respuestaCultivos.data || []).map((cultivo) => [
        cultivo.id,
        `${cultivo.tipo}${cultivo.variedad ? ` · ${cultivo.variedad}` : ""}`,
      ]),
    ),
    lotes: new Map((respuestaLotes.data || []).map((lote) => [lote.id, lote.nombre])),
  };
}

export async function cargarLabores() {
  const { data, error } = await supabase
    .from("labores_culturales")
    .select("id, id_cultivo, id_lote, id_producto, actividad, insumo, cantidad_insumo, unidad_insumo, observaciones, fecha")
    .eq("activo", true)
    .order("fecha", { ascending: false });

  if (error) {
    console.error("No se pudieron cargar las labores:", error);
    if (error.code === "PGRST205" || error.code === "PGRST204" || error.code === "42P01") {
      showToast("Falta actualizar las tablas agrícolas e inventario con sus archivos SQL.");
    }
    return;
  }

  const labores = data || [];
  const referencias = await cargarReferenciasAgricolas(labores);
  if (!referencias) return;
  const productosIds = [...new Set(labores.map((labor) => labor.id_producto).filter(Boolean))];
  let nombresProductos = new Map();
  if (productosIds.length) {
    const { data: productos, error: errorProductos } = await supabase
      .from("productos")
      .select("id, nombre")
      .in("id", productosIds);
    if (errorProductos) {
      console.error("No se pudieron cargar los productos usados en labores:", errorProductos);
    } else {
      nombresProductos = new Map((productos || []).map((producto) => [producto.id, producto.nombre]));
    }
  }

  renderTable("laboresTable", labores, (labor) => {
    const cantidad = labor.cantidad_insumo
      ? `${Number(labor.cantidad_insumo).toLocaleString("es-CO")} ${labor.unidad_insumo || ""}`.trim()
      : "";
    const insumoMostrado = nombresProductos.get(labor.id_producto) || labor.insumo;
    return `
      <tr>
        <td>${formatDate(labor.fecha)}</td>
        <td>${escapeHtml(labor.actividad)}</td>
        <td>${escapeHtml(referencias.cultivos.get(labor.id_cultivo) || "—")}</td>
        <td>${escapeHtml(referencias.lotes.get(labor.id_lote) || "—")}</td>
        <td>${escapeHtml([insumoMostrado, cantidad].filter(Boolean).join(" · ") || "—")}</td>
        <td><button class="btn btn-soft btn-sm" data-legacy-click="editarLabor('${labor.id}')">Editar</button> <button class="btn btn-soft btn-sm" data-legacy-click="anularLabor('${labor.id}')">Archivar</button> <button class="btn btn-danger btn-sm" data-legacy-click="eliminarRegistroPermanente('labores_culturales','${labor.id}','esta labor')">Eliminar</button></td>
      </tr>
    `;
  });
}

export async function editarLabor(id) {
  const { data: labor, error } = await supabase
    .from("labores_culturales")
    .select("id, id_cultivo, id_lote, id_producto, actividad, insumo, cantidad_insumo, unidad_insumo, observaciones, fecha")
    .eq("id", id)
    .single();
  if (error || !labor) {
    console.error("No se pudo cargar la labor para editar:", error);
    showToast("No se pudo abrir la labor para editar.");
    return;
  }

  await openModal("modalLabor");
  if (labor.id_producto) await asegurarProductoEnSelector("labor-producto", labor.id_producto);
  await loadLotesEnSelect("labor-lote");
  await asegurarLoteEnSelector("labor-lote", labor.id_lote);
  doc.getElementById("labor-lote").value = labor.id_lote;
  await cargarCultivosDelLote("labor", true);
  doc.getElementById("labor-cultivo").value = labor.id_cultivo;
  doc.getElementById("labor-producto").value = labor.id_producto || "";
  actualizarUnidadProductoLabor();
  doc.getElementById("labor-actividad").value = labor.actividad;
  doc.getElementById("labor-fecha").value = labor.fecha;
  doc.getElementById("labor-insumo").value = labor.insumo || "";
  doc.getElementById("labor-cantidad").value = labor.cantidad_insumo ?? "";
  doc.getElementById("labor-unidad").value = labor.unidad_insumo || "kg";
  doc.getElementById("labor-observaciones").value = labor.observaciones || "";
  if (labor.id_producto) {
    ["labor-producto", "labor-cantidad", "labor-unidad", "labor-insumo"].forEach((idCampo) => {
      doc.getElementById(idCampo).disabled = true;
    });
  }
  appState.registroEnEdicion = { tipo: "labor", id };
  actualizarRotulosEdicion("labor");
}

export async function cargarCosechas() {
  const { data, error } = await supabase
    .from("cosechas")
    .select("id, id_cultivo, id_lote, cantidad, unidad, calidad, fecha, destino, es_final")
    .eq("activo", true)
    .order("fecha", { ascending: false });

  if (error) {
    console.error("No se pudieron cargar las cosechas:", error);
    if (error.code === "PGRST205" || error.code === "42P01") {
      showToast("Falta crear la tabla de cosechas en Supabase.");
    }
    return;
  }

  const cosechas = data || [];
  const referencias = await cargarReferenciasAgricolas(cosechas);
  if (!referencias) return;

  renderTable("cosechasTable", cosechas, (cosecha) => `
    <tr>
      <td>${formatDate(cosecha.fecha)}</td>
      <td>${escapeHtml(referencias.cultivos.get(cosecha.id_cultivo) || "—")}</td>
      <td>${escapeHtml(referencias.lotes.get(cosecha.id_lote) || "—")}</td>
      <td>${Number(cosecha.cantidad).toLocaleString("es-CO")} ${escapeHtml(cosecha.unidad)}</td>
      <td>${escapeHtml(cosecha.calidad)}</td>
      <td>${cosecha.es_final ? "Final" : "Parcial"}</td>
      <td>${escapeHtml(cosecha.destino || "—")}</td>
        <td><button class="btn btn-soft btn-sm" data-legacy-click="editarCosecha('${cosecha.id}')">Editar</button> <button class="btn btn-soft btn-sm" data-legacy-click="anularCosecha('${cosecha.id}')">Archivar</button> <button class="btn btn-danger btn-sm" data-legacy-click="eliminarRegistroPermanente('cosechas','${cosecha.id}','esta cosecha')">Eliminar</button></td>
    </tr>
  `);
}


export async function archivarTipoCultivo(id) {
  if (await archivarRegistro("tipos_cultivo", id, "cultivos del catálogo")) {
    await cargarCatalogoCultivos();
  }
}

export async function reactivarTipoCultivo(id) {
  if (await reactivarRegistro("tipos_cultivo", id, "el tipo de cultivo")) await cargarCatalogoCultivos();
}

export async function archivarFinca(id) {
  if (!window.confirm("¿Quieres archivar esta finca y sus lotes? Se conservarán los registros históricos.")) {
    return;
  }

  const { data: fincaActualizada, error } = await supabase
    .from("fincas")
    .update({ activo: false })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error || !fincaActualizada) {
    console.error("No se pudo archivar la finca:", error);
    showToast("No se pudo archivar la finca.");
    return;
  }

  const { data: lotes, error: errorLotes } = await supabase
    .from("lotes")
    .update({ activo: false })
    .eq("id_finca", id)
    .select("id");

  if (errorLotes) {
    console.error("La finca se archivó, pero no se pudieron archivar sus lotes:", errorLotes);
    showToast("Finca archivada. Revisa el estado de sus lotes.");
  } else {
    const idsLotes = (lotes || []).map((lote) => lote.id);
    if (idsLotes.length) {
      const { error: errorCultivos } = await supabase
        .from("cultivos")
        .update({ activo: false })
        .in("id_lote", idsLotes)
        .eq("activo", true);
      if (errorCultivos) {
        console.error("No se pudieron archivar los cultivos de la finca:", errorCultivos);
      }
    }
    showToast("Finca archivada; lotes y cultivos activos retirados del uso.");
  }

  await cargarFincas();
  await cargarCultivos();
  cargarDashboard();
}

export async function reactivarFinca(id) {
  if (!await reactivarRegistro("fincas", id, "la finca")) return;
  const { data: lotes, error } = await supabase.from("lotes").update({ activo: true }).eq("id_finca", id).select("id");
  if (error) {
    console.error("La finca se activó, pero no se pudieron activar sus lotes:", error);
    showToast("Finca activada. Revisa el estado de sus lotes.");
  } else {
    const ids = (lotes || []).map((lote) => lote.id);
    if (ids.length) await supabase.from("cultivos").update({ activo: true }).in("id_lote", ids);
  }
  await cargarFincas();
  await cargarCultivos();
  cargarDashboard();
}

export async function archivarLote(id: string): Promise<void> {
  if (!await archivarRegistro("lotes", id, "el lote")) return;
  await cargarFincas();
  await cargarCultivos();
  await cargarDashboard();
}

export async function reactivarLote(id: string): Promise<void> {
  if (!await reactivarRegistro("lotes", id, "el lote")) return;
  await cargarFincas();
  await cargarDashboard();
}

export async function eliminarLote(id: string): Promise<void> {
  if (!window.confirm("¿Eliminar permanentemente este lote? Se quitará la asignación del lote a animales y productos, y se eliminarán los cultivos, labores y cosechas vinculados. Esta acción no se puede deshacer.")) return;
  const { error } = await supabase.rpc("eliminar_lote_agricola", { p_id_lote: id });
  if (error) {
    console.error("No se pudo eliminar el lote y resolver sus dependencias:", error);
    showToast(error.code === "PGRST202"
      ? "Falta ejecutar eliminar_lote_agricola_supabase.sql en Supabase."
      : `No se pudo eliminar el lote: ${error.message}`);
    return;
  }
  showToast("Lote eliminado. Se retiraron sus cultivos y registros asociados; animales y productos se conservaron sin lote asignado.");
  await Promise.all([cargarFincas(), cargarCultivos(), cargarLabores(), cargarCosechas()]);
  await cargarDashboard();
}

export async function archivarCultivo(id) {
  if (await archivarRegistro("cultivos", id, "cultivos activos")) {
    await cargarCultivos();
    cargarDashboard();
  }
}

export async function reactivarCultivo(id) {
  if (await reactivarRegistro("cultivos", id, "el cultivo")) {
    await cargarCultivos();
    cargarDashboard();
  }
}

export async function anularLabor(id) {
  if (await archivarRegistro("labores_culturales", id, "labores culturales")) {
    await cargarLabores();
  }
}

export async function anularCosecha(id) {
  if (await archivarRegistro("cosechas", id, "cosechas")) {
    await cargarCosechas();
  }
}

export async function loadLotesEnSelect(selectId) {
  const sel = doc.getElementById(selectId);
  if (!sel) return;
  sel.replaceChildren(new Option("Cargando lotes...", ""));

  const { data, error } = await supabase
    .from("lotes")
    .select("id, nombre, area")
    .eq("activo", true)
    .order("nombre", { ascending: true });

  if (error) {
    console.error("No se pudieron cargar los lotes para el cultivo:", error);
    sel.replaceChildren(new Option("No se pudieron cargar los lotes", ""));
    return;
  }

  sel.replaceChildren(
    new Option(data?.length ? "Selecciona un lote" : "No hay lotes registrados", ""),
  );
  (data || []).forEach((lote) => {
    sel.add(new Option(`${lote.nombre} · ${formatArea(Number(lote.area))}`, lote.id));
  });
}

export async function editarCosecha(id) {
  const { data: cosecha, error } = await supabase
    .from("cosechas")
    .select("id, id_cultivo, id_lote, cantidad, unidad, calidad, fecha, destino, es_final")
    .eq("id", id)
    .single();
  if (error || !cosecha) {
    console.error("No se pudo cargar la cosecha para editar:", error);
    showToast("No se pudo abrir la cosecha para editar.");
    return;
  }

  openModal("modalCosecha");
  await loadLotesEnSelect("cosecha-lote");
  await asegurarLoteEnSelector("cosecha-lote", cosecha.id_lote);
  doc.getElementById("cosecha-lote").value = cosecha.id_lote;
  await cargarCultivosDelLote("cosecha", true);
  doc.getElementById("cosecha-cultivo").value = cosecha.id_cultivo;
  doc.getElementById("cosecha-cantidad").value = cosecha.cantidad;
  doc.getElementById("cosecha-unidad").value = cosecha.unidad;
  doc.getElementById("cosecha-calidad").value = cosecha.calidad;
  doc.getElementById("cosecha-fecha").value = cosecha.fecha;
  doc.getElementById("cosecha-destino").value = cosecha.destino || "";
  doc.getElementById("cosecha-tipo").value = String(cosecha.es_final);
  doc.getElementById("cosecha-lote").disabled = true;
  doc.getElementById("cosecha-cultivo").disabled = true;
  doc.getElementById("cosecha-tipo").disabled = true;
  appState.registroEnEdicion = { tipo: "cosecha", id };
  actualizarRotulosEdicion("cosecha");
}

export async function cargarCultivosDelLote(prefijo, incluirInactivos = false) {
  if (prefijo !== "labor" && prefijo !== "cosecha") return;
  const idLote = doc.getElementById(`${prefijo}-lote`).value;
  const selector = doc.getElementById(`${prefijo}-cultivo`);
  if (!idLote) {
    selector.replaceChildren(new Option("Selecciona primero un lote", ""));
    return;
  }

  selector.replaceChildren(new Option("Cargando cultivos...", ""));
  let consultaCultivos = supabase
    .from("cultivos")
    .select("id, tipo, variedad")
    .eq("id_lote", idLote)
    .order("tipo", { ascending: true });
  if (!incluirInactivos) consultaCultivos = consultaCultivos.eq("activo", true);
  const { data, error } = await consultaCultivos;

  if (error) {
    console.error("No se pudieron cargar los cultivos del lote:", error);
    selector.replaceChildren(new Option("No se pudieron cargar los cultivos", ""));
    return;
  }

  selector.replaceChildren(
    new Option(data?.length ? "Selecciona un cultivo" : "Este lote no tiene cultivos activos", ""),
  );
  (data || []).forEach((cultivo) => {
    const nombre = `${cultivo.tipo}${cultivo.variedad ? ` · ${cultivo.variedad}` : ""}`;
    selector.add(new Option(nombre, cultivo.id));
  });
}

export async function asegurarLoteEnSelector(selectId, idLote) {
  const selector = doc.getElementById(selectId);
  if (!selector || arrayFrom(selector.options).some((option) => option.value === idLote)) return;
  const { data: lote, error } = await supabase
    .from("lotes")
    .select("id, nombre, area")
    .eq("id", idLote)
    .maybeSingle();
  if (error || !lote) return;
  selector.add(new Option(`${lote.nombre} · ${formatArea(Number(lote.area))} (archivado)`, lote.id));
}

/* ============================================================
   8. MÓDULO DE TABLAS
   ============================================================ */
