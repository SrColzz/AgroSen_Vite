import { supabase } from "../../lib/supabase";
import { appState } from "../../shared/state";
import { escapeHtml, fechaLocalActual, formatDate, renderTable, showToast, updateKpi } from "../../shared/dom";
import { actualizarRotulosEdicion, archivarRegistro, cargarDashboard, closeModals, openModal } from "../../app/controller";
import { formatWeight, weightFromKg, weightToKg } from "../../shared/preferences";
const doc: any = document;
const arrayFrom: any = Array.from;

window.addEventListener("agrosen:preferences-updated", () => { void cargarPesajes(); });

export async function cargarEspeciesAnimal() {
  const selector = doc.getElementById("animal-especie");
  const { data, error } = await supabase
    .from("especies")
    .select("id, nombre")
    .order("nombre", { ascending: true });
  if (error) {
    console.error("No se pudieron cargar las especies:", error);
    selector.replaceChildren(new Option("No se pudo cargar el catálogo", ""));
    showToast("Revisa el SQL del módulo pecuario en Supabase.");
    return;
  }
  selector.replaceChildren(new Option(data?.length ? "Selecciona una especie" : "No hay especies en el catálogo", ""));
  (data || []).forEach((especie) => selector.add(new Option(especie.nombre, especie.id)));
  await cargarRazasAnimal();
}

export async function cargarRazasAnimal() {
  const solicitud = ++appState.solicitudRazasAnimal;
  const idEspecie = doc.getElementById("animal-especie").value;
  const selector = doc.getElementById("animal-raza");
  const especieNombre = doc.getElementById("animal-especie").selectedOptions[0]?.text || "";
  const especieEsOtra = especieNombre.toLowerCase() === "otro";
  doc.getElementById("animal-especie-detalle-wrap").hidden = !especieEsOtra;
  doc.getElementById("animal-especie-detalle").disabled = !especieEsOtra;
  if (!especieEsOtra) doc.getElementById("animal-especie-detalle").value = "";
  if (!idEspecie) {
    selector.replaceChildren(new Option("Selecciona una especie primero", ""));
    doc.getElementById("animal-raza-detalle-wrap").hidden = true;
    doc.getElementById("animal-raza-detalle").disabled = true;
    return;
  }

  selector.replaceChildren(new Option("Cargando razas...", ""));
  const { data, error } = await supabase
    .from("razas")
    .select("id, nombre")
    .eq("id_especie", idEspecie)
    .order("nombre", { ascending: true });
  if (solicitud !== appState.solicitudRazasAnimal || doc.getElementById("animal-especie").value !== idEspecie) return;
  if (error) {
    console.error("No se pudieron cargar las razas:", error);
    selector.replaceChildren(new Option("No se pudo cargar el catálogo", ""));
    return;
  }
  selector.replaceChildren(new Option("Sin raza especificada", ""));
  (data || []).forEach((raza) => selector.add(new Option(raza.nombre, raza.id)));
  actualizarDetalleRazaAnimal();
}

export function actualizarDetalleRazaAnimal() {
  const selector = doc.getElementById("animal-raza");
  const esOtra = (selector?.selectedOptions[0]?.text || "").toLowerCase() === "otra";
  doc.getElementById("animal-raza-detalle-wrap").hidden = !esOtra;
  doc.getElementById("animal-raza-detalle").disabled = !esOtra;
  if (!esOtra) doc.getElementById("animal-raza-detalle").value = "";
}

export async function cargarLotesAnimal() {
  const selector = doc.getElementById("animal-lote");
  const { data: lotes, error } = await supabase
    .from("lotes")
    .select("id, nombre, id_finca")
    .eq("activo", true)
    .order("nombre", { ascending: true });
  if (error) {
    console.error("No se pudieron cargar los lotes para animales:", error);
    selector.replaceChildren(new Option("No se pudieron cargar los lotes", ""));
    return;
  }

  const fincaIds = [...new Set((lotes || []).map((lote) => lote.id_finca).filter(Boolean))];
  let fincasPorId = new Map();
  if (fincaIds.length) {
    const { data: fincas, error: errorFincas } = await supabase
      .from("fincas")
      .select("id, nombre")
      .in("id", fincaIds);
    if (errorFincas) {
      console.error("No se pudieron cargar las fincas para los lotes:", errorFincas);
    } else {
      fincasPorId = new Map((fincas || []).map((finca) => [finca.id, finca.nombre]));
    }
  }
  selector.replaceChildren(new Option("Sin lote asignado", ""));
  (lotes || []).forEach((lote) => {
    const finca = fincasPorId.get(lote.id_finca);
    selector.add(new Option(`${finca ? `${finca} · ` : ""}${lote.nombre}`, lote.id));
  });
}

export async function asegurarLoteAnimal(idLote) {
  const selector = doc.getElementById("animal-lote");
  if (!idLote || arrayFrom(selector.options).some((option) => option.value === idLote)) return;
  const { data: lote, error } = await supabase
    .from("lotes")
    .select("id, nombre, id_finca")
    .eq("id", idLote)
    .maybeSingle();
  if (error || !lote) return;
  let nombreFinca = "";
  if (lote.id_finca) {
    const { data: finca } = await supabase
      .from("fincas")
      .select("nombre")
      .eq("id", lote.id_finca)
      .maybeSingle();
    nombreFinca = finca?.nombre || "";
  }
  selector.add(new Option(`${nombreFinca ? `${nombreFinca} · ` : ""}${lote.nombre} (lote inactivo)`, lote.id));
}

export async function cargarAnimales() {
  const { data, error } = await supabase
    .from("animales")
    .select("id, id_especie, id_raza, especie_detalle, raza_detalle, id_lote, identificacion, codigo_trazabilidad, sexo, fecha_nacimiento, ubicacion, estado, observaciones")
    .eq("activo", true)
    .order("identificacion", { ascending: true });
  if (error) {
    console.error("No se pudieron cargar los animales:", error);
    if (error.code === "PGRST205" || error.code === "42P01") {
      showToast("Falta ejecutar pecuario_supabase.sql en Supabase.");
    } else {
      showToast("No se pudieron cargar los animales. Revisa los permisos de Supabase.");
    }
    return;
  }

  const animales = data || [];
  const especieIds = [...new Set(animales.map((animal) => animal.id_especie))];
  const razaIds = [...new Set(animales.map((animal) => animal.id_raza).filter(Boolean))];
  const loteIds = [...new Set(animales.map((animal) => animal.id_lote).filter(Boolean))];
  const [respuestaEspecies, respuestaRazas, respuestaLotes] = await Promise.all([
    especieIds.length ? supabase.from("especies").select("id, nombre").in("id", especieIds) : Promise.resolve({ data: [], error: null }),
    razaIds.length ? supabase.from("razas").select("id, nombre").in("id", razaIds) : Promise.resolve({ data: [], error: null }),
    loteIds.length ? supabase.from("lotes").select("id, nombre, id_finca").in("id", loteIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (respuestaEspecies.error || respuestaRazas.error || respuestaLotes.error) {
    console.error("No se pudieron cargar las referencias pecuarias:", respuestaEspecies.error || respuestaRazas.error || respuestaLotes.error);
    showToast("No se pudieron cargar especies, razas o ubicaciones de animales.");
    return;
  }

  const fincaIds = [...new Set((respuestaLotes.data || []).map((lote) => lote.id_finca).filter(Boolean))];
  let fincas = [];
  if (fincaIds.length) {
    const { data: datosFincas, error: errorFincas } = await supabase
      .from("fincas")
      .select("id, nombre")
      .in("id", fincaIds);
    if (errorFincas) {
      console.error("No se pudieron cargar los nombres de finca:", errorFincas);
      showToast("No se pudieron mostrar las ubicaciones pecuarias.");
      return;
    }
    fincas = datosFincas || [];
  }

  const especies = new Map((respuestaEspecies.data || []).map((item) => [item.id, item.nombre]));
  const razas = new Map((respuestaRazas.data || []).map((item) => [item.id, item.nombre]));
  const lotes = new Map((respuestaLotes.data || []).map((item) => [item.id, item]));
  const fincasPorId = new Map(fincas.map((item) => [item.id, item.nombre]));
  updateKpi("kpi-animales", animales.filter((animal) => animal.estado === "Activo").length);

  renderTable("animalesTable", animales, (animal) => {
    const lote = lotes.get(animal.id_lote);
    const ubicacion = [
      lote ? fincasPorId.get(lote.id_finca) : null,
      lote?.nombre,
      animal.ubicacion,
    ].filter(Boolean).join(" · ");
    const especie = especies.get(animal.id_especie) || "—";
    const raza = animal.raza_detalle || razas.get(animal.id_raza) || "—";
    return `
      <tr>
        <td>${escapeHtml(animal.identificacion)}</td>
        <td>${escapeHtml(animal.especie_detalle || especie)}</td>
        <td>${escapeHtml(raza)}</td>
        <td>${escapeHtml(animal.sexo)}</td>
        <td>${formatDate(animal.fecha_nacimiento)}</td>
        <td>${escapeHtml(animal.codigo_trazabilidad)}</td>
        <td>${escapeHtml(ubicacion || "Sin ubicación asignada")}</td>
        <td><span class="status ${animal.estado === "Activo" ? "ok" : "info"}">${escapeHtml(animal.estado)}</span></td>
        <td><button class="btn btn-soft btn-sm" onclick="editarAnimal('${animal.id}')">Editar</button> <button class="btn btn-soft btn-sm" onclick="archivarAnimal('${animal.id}')">Archivar</button></td>
      </tr>
    `;
  });
}

export async function guardarAnimal() {
  const especieSelect = doc.getElementById("animal-especie");
  const razaSelect = doc.getElementById("animal-raza");
  const idEspecie = especieSelect.value;
  const nombreEspecie = especieSelect.selectedOptions[0]?.text || "";
  const idRaza = razaSelect.value || null;
  const nombreRaza = razaSelect.selectedOptions[0]?.text || "";
  const identificacion = doc.getElementById("animal-id").value.trim();
  const especieDetalle = doc.getElementById("animal-especie-detalle").value.trim();
  const razaDetalle = doc.getElementById("animal-raza-detalle").value.trim();
  const sexo = doc.getElementById("animal-sexo").value;
  const fechaNacimiento = doc.getElementById("animal-nacimiento").value || null;
  const idLote = doc.getElementById("animal-lote").value || null;
  const ubicacion = doc.getElementById("animal-ubicacion").value.trim();
  const estado = doc.getElementById("animal-estado").value;
  const observaciones = doc.getElementById("animal-observaciones").value.trim();
  if (!idEspecie || !identificacion) {
    showToast("Selecciona la especie e ingresa una identificación.");
    return;
  }
  if (fechaNacimiento && fechaNacimiento > fechaLocalActual()) {
    showToast("La fecha de nacimiento no puede estar en el futuro.");
    return;
  }
  if (nombreEspecie.toLowerCase() === "otro" && !especieDetalle) {
    showToast("Especifica la especie seleccionada como Otro.");
    return;
  }
  if (nombreRaza.toLowerCase() === "otra" && !razaDetalle) {
    showToast("Especifica la raza seleccionada como Otra.");
    return;
  }

  const datosAnimal = {
    id_especie: idEspecie,
    id_raza: idRaza,
    especie_detalle: nombreEspecie.toLowerCase() === "otro" ? especieDetalle : null,
    raza_detalle: nombreRaza.toLowerCase() === "otra" ? razaDetalle : null,
    id_lote: idLote,
    identificacion,
    sexo,
    fecha_nacimiento: fechaNacimiento,
    ubicacion: ubicacion || null,
    estado,
    observaciones: observaciones || null,
  };
  const editando = appState.registroEnEdicion?.tipo === "animal";
  const respuesta = editando
    ? await supabase.from("animales").update(datosAnimal).eq("id", appState.registroEnEdicion.id).select("codigo_trazabilidad").single()
    : await supabase.from("animales").insert(datosAnimal).select("codigo_trazabilidad").single();
  if (respuesta.error) {
    console.error("No se pudo guardar el animal:", respuesta.error);
    showToast(respuesta.error.code === "23505" ? "Ya existe un animal con esa identificación." : respuesta.error.message || "No se pudo guardar el animal.");
    return;
  }
  const codigo = respuesta.data?.codigo_trazabilidad;
  closeModals();
  showToast(editando ? "Ficha del animal actualizada." : `Animal registrado. Trazabilidad: ${codigo}`);
  await cargarAnimales();
  cargarDashboard();
}

export async function editarAnimal(id) {
  const { data: animal, error } = await supabase
    .from("animales")
    .select("id, id_especie, id_raza, especie_detalle, raza_detalle, id_lote, identificacion, codigo_trazabilidad, sexo, fecha_nacimiento, ubicacion, estado, observaciones")
    .eq("id", id)
    .single();
  if (error || !animal) {
    console.error("No se pudo cargar el animal para editar:", error);
    showToast("No se pudo abrir la ficha del animal.");
    return;
  }
  await openModal("modalAnimal");
  doc.getElementById("animal-especie").value = animal.id_especie;
  await cargarRazasAnimal();
  doc.getElementById("animal-raza").value = animal.id_raza || "";
  actualizarDetalleRazaAnimal();
  doc.getElementById("animal-id").value = animal.identificacion;
  doc.getElementById("animal-especie-detalle").value = animal.especie_detalle || "";
  doc.getElementById("animal-raza-detalle").value = animal.raza_detalle || "";
  doc.getElementById("animal-sexo").value = animal.sexo;
  doc.getElementById("animal-nacimiento").value = animal.fecha_nacimiento || "";
  await asegurarLoteAnimal(animal.id_lote);
  doc.getElementById("animal-lote").value = animal.id_lote || "";
  doc.getElementById("animal-ubicacion").value = animal.ubicacion || "";
  doc.getElementById("animal-estado").value = animal.estado;
  doc.getElementById("animal-trazabilidad").value = animal.codigo_trazabilidad;
  doc.getElementById("animal-observaciones").value = animal.observaciones || "";
  appState.registroEnEdicion = { tipo: "animal", id };
  actualizarRotulosEdicion("animal");
}

export async function archivarAnimal(id) {
  if (await archivarRegistro("animales", id, "ficha del animal")) {
    await cargarAnimales();
    cargarDashboard();
  }
}

export function exportarAnimalesCSV() {
  const tabla = doc.getElementById("animalesTable");
  const filas = arrayFrom(tabla.querySelectorAll("tr"));
  if (tabla.querySelector("tbody .empty")) {
    showToast("No hay fichas de animales para exportar.");
    return;
  }
  const contenido = filas.map((fila) => arrayFrom(fila.cells).slice(0, -1).map((celda) => {
    const valor = celda.innerText.trim().replace(/"/g, '""');
    return `"${valor}"`;
  }).join(";")).join("\r\n");
  const archivo = new Blob(["\uFEFF", contenido], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(archivo);
  const enlace = doc.createElement("a");
  enlace.href = url;
  enlace.download = `agrosen-animales-${fechaLocalActual()}.csv`;
  enlace.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function cargarAnimalesEnSelector(selectorId, idSeleccionado = null) {
  const selector = doc.getElementById(selectorId);
  selector.replaceChildren(new Option("Cargando animales...", ""));
  const { data, error } = await supabase
    .from("animales")
    .select("id, identificacion, estado, activo")
    .order("identificacion", { ascending: true });
  if (error) {
    console.error("No se pudieron cargar animales para el registro pecuario:", error);
    selector.replaceChildren(new Option("No se pudieron cargar animales", ""));
    showToast("No se pudieron cargar los animales. Revisa pecuario_supabase.sql y los permisos.");
    return false;
  }
  const animales = data || [];
  selector.replaceChildren(new Option("Selecciona un animal", ""));
  animales.filter((animal) => animal.activo && animal.estado === "Activo").forEach((animal) => {
    selector.add(new Option(animal.identificacion, animal.id));
  });
  if (idSeleccionado && !animales.some((animal) => animal.id === idSeleccionado)) {
    const { data: seleccionado, error: errorSeleccionado } = await supabase
      .from("animales").select("id, identificacion, estado, activo").eq("id", idSeleccionado).maybeSingle();
    if (errorSeleccionado) {
      console.error("No se pudo recuperar el animal del registro histórico:", errorSeleccionado);
      return false;
    }
    if (seleccionado) animales.push(seleccionado);
  }
  if (idSeleccionado) {
    const animal = animales.find((item) => item.id === idSeleccionado);
    if (animal && !arrayFrom(selector.options).some((option) => option.value === animal.id)) {
      selector.add(new Option(`${animal.identificacion} (${animal.estado.toLowerCase()})`, animal.id));
    }
    selector.value = idSeleccionado;
  }
  if (selector.options.length === 1) selector.options[0].text = "Registra primero un animal activo";
  return true;
}

const configuracionRegistrosPecuarios = {
  eventoSanitario: { tabla: "eventos_sanitarios", selector: "evento-animal", tableId: "eventosSanitariosTable", descripcion: "evento sanitario", columnas: "id, id_animal, tipo, producto, veterinario, fecha, proxima_fecha, costo, observaciones", carga: "cargarEventosSanitarios" },
  pesaje: { tabla: "pesajes", selector: "pesaje-animal", tableId: "pesajesTable", descripcion: "pesaje", columnas: "id, id_animal, fecha, peso, condicion, observaciones", carga: "cargarPesajes" },
  produccionAnimal: { tabla: "producciones_animal", selector: "produccion-animal", tableId: "produccionesAnimalTable", descripcion: "registro de producción", columnas: "id, id_animal, tipo, cantidad, unidad, fecha, observaciones", carga: "cargarProduccionesAnimales" },
};

export async function cargarRegistrosPecuarios(tipo) {
  const config = configuracionRegistrosPecuarios[tipo];
  const { data, error } = await supabase.from(config.tabla).select(config.columnas).eq("activo", true).order("fecha", { ascending: false });
  if (error) {
    console.error(`No se pudieron cargar ${config.descripcion}:`, error);
    showToast(error.code === "PGRST205" || error.code === "42P01" ? "Falta ejecutar pecuario_supabase.sql en Supabase." : `No se pudieron cargar ${config.descripcion}.`);
    return;
  }
  const registros = data || [];
  const ids = [...new Set(registros.map((item) => item.id_animal))];
  let animales = [];
  if (ids.length) {
    const respuesta = await supabase.from("animales").select("id, identificacion").in("id", ids);
    if (respuesta.error) {
      console.error("No se pudieron resolver animales asociados:", respuesta.error);
      showToast("No se pudieron mostrar los animales de los registros.");
      return;
    }
    animales = respuesta.data || [];
  }
  const nombres = new Map(animales.map((animal) => [animal.id, animal.identificacion]));
  renderTable(config.tableId, registros, (registro) => {
    const animal = escapeHtml(nombres.get(registro.id_animal) || "Animal archivado");
    let celdas;
    if (tipo === "eventoSanitario") celdas = `<td>${formatDate(registro.fecha)}</td><td>${animal}</td><td>${escapeHtml(registro.tipo)}</td><td>${escapeHtml(registro.producto || "—")}</td><td>${escapeHtml(registro.veterinario || "—")}</td><td>${formatDate(registro.proxima_fecha)}</td>`;
    else if (tipo === "pesaje") celdas = `<td>${formatDate(registro.fecha)}</td><td>${animal}</td><td>${formatWeight(Number(registro.peso))}</td><td>${escapeHtml(registro.condicion || "—")}</td><td>${escapeHtml(registro.observaciones || "—")}</td>`;
    else celdas = `<td>${formatDate(registro.fecha)}</td><td>${animal}</td><td>${escapeHtml(registro.tipo)}</td><td>${Number(registro.cantidad).toLocaleString("es-CO")} ${escapeHtml(registro.unidad)}</td><td>${escapeHtml(registro.observaciones || "—")}</td>`;
    const editar = tipo === "eventoSanitario" ? "editarEventoSanitario" : tipo === "pesaje" ? "editarPesaje" : "editarProduccionAnimal";
    const archivar = tipo === "eventoSanitario" ? "archivarEventoSanitario" : tipo === "pesaje" ? "archivarPesaje" : "archivarProduccionAnimal";
    return `<tr>${celdas}<td><button class="btn btn-soft btn-sm" onclick="${editar}('${registro.id}')">Editar</button> <button class="btn btn-soft btn-sm" onclick="${archivar}('${registro.id}')">Archivar</button></td></tr>`;
  });
}

export const cargarEventosSanitarios = () => cargarRegistrosPecuarios("eventoSanitario");
export const cargarPesajes = () => cargarRegistrosPecuarios("pesaje");
export const cargarProduccionesAnimales = () => cargarRegistrosPecuarios("produccionAnimal");

export async function guardarRegistroPecuario(tipo, datos) {
  const config = configuracionRegistrosPecuarios[tipo];
  if (!datos.id_animal || !datos.fecha) {
    showToast("Selecciona un animal y una fecha para continuar.");
    return;
  }
  if (datos.fecha > fechaLocalActual()) {
    showToast("La fecha del registro no puede estar en el futuro.");
    return;
  }
  if (tipo === "eventoSanitario" && datos.proxima_fecha && datos.proxima_fecha < datos.fecha) {
    showToast("La próxima fecha no puede ser anterior al evento.");
    return;
  }
  if (tipo === "eventoSanitario" && datos.costo !== null && (!Number.isFinite(Number(datos.costo)) || Number(datos.costo) < 0)) {
    showToast("El costo debe ser cero o mayor.");
    return;
  }
  if (tipo === "pesaje" && (!Number.isFinite(Number(datos.peso)) || Number(datos.peso) <= 0)) {
    showToast("El peso debe ser mayor que cero.");
    return;
  }
  if (tipo === "produccionAnimal" && (!Number.isFinite(Number(datos.cantidad)) || Number(datos.cantidad) <= 0)) {
    showToast("La cantidad debe ser mayor que cero.");
    return;
  }
  const editando = appState.registroEnEdicion?.tipo === tipo;
  const respuesta = editando
    ? await supabase.from(config.tabla).update(datos).eq("id", appState.registroEnEdicion.id).select("id").maybeSingle()
    : await supabase.from(config.tabla).insert(datos).select("id").single();
  if (respuesta.error || !respuesta.data) {
    console.error(`No se pudo guardar ${config.descripcion}:`, respuesta.error);
    showToast(respuesta.error?.code === "23503" ? "El animal seleccionado ya no está disponible." : respuesta.error?.message || `No se pudo guardar ${config.descripcion}.`);
    return;
  }
  closeModals();
  showToast(editando ? "Registro actualizado." : "Registro guardado.");
  await cargarRegistrosPecuarios(tipo);
}

export function guardarEventoSanitario() {
  const costo = doc.getElementById("evento-costo").value;
  return guardarRegistroPecuario("eventoSanitario", {
    id_animal: doc.getElementById("evento-animal").value,
    tipo: doc.getElementById("evento-tipo").value,
    producto: doc.getElementById("evento-producto").value.trim() || null,
    veterinario: doc.getElementById("evento-veterinario").value.trim() || null,
    fecha: doc.getElementById("evento-fecha").value,
    proxima_fecha: doc.getElementById("evento-proxima-fecha").value || null,
    costo: costo === "" ? null : Number(costo),
    observaciones: doc.getElementById("evento-observaciones").value.trim() || null,
  });
}

export function guardarPesaje() {
  return guardarRegistroPecuario("pesaje", {
    id_animal: doc.getElementById("pesaje-animal").value,
    fecha: doc.getElementById("pesaje-fecha").value,
    peso: weightToKg(Number(doc.getElementById("pesaje-peso").value)),
    condicion: doc.getElementById("pesaje-condicion").value.trim() || null,
    observaciones: doc.getElementById("pesaje-observaciones").value.trim() || null,
  });
}

export function guardarProduccionAnimal() {
  return guardarRegistroPecuario("produccionAnimal", {
    id_animal: doc.getElementById("produccion-animal").value,
    tipo: doc.getElementById("produccion-tipo").value,
    cantidad: Number(doc.getElementById("produccion-cantidad").value),
    unidad: doc.getElementById("produccion-unidad").value,
    fecha: doc.getElementById("produccion-fecha").value,
    observaciones: doc.getElementById("produccion-observaciones").value.trim() || null,
  });
}

export async function editarRegistroPecuario(tipo, id) {
  const config = configuracionRegistrosPecuarios[tipo];
  const { data, error } = await supabase.from(config.tabla).select(config.columnas).eq("id", id).maybeSingle();
  if (error || !data) {
    console.error(`No se pudo abrir ${config.descripcion} para edición:`, error);
    showToast("No se pudo abrir el registro para editar.");
    return;
  }
  const modalId = tipo === "eventoSanitario" ? "modalEventoSanitario" : tipo === "pesaje" ? "modalPesaje" : "modalProduccionAnimal";
  await openModal(modalId);
  await cargarAnimalesEnSelector(config.selector, data.id_animal);
  if (tipo === "eventoSanitario") {
    doc.getElementById("evento-tipo").value = data.tipo;
    doc.getElementById("evento-producto").value = data.producto || "";
    doc.getElementById("evento-veterinario").value = data.veterinario || "";
    doc.getElementById("evento-fecha").value = data.fecha;
    doc.getElementById("evento-proxima-fecha").value = data.proxima_fecha || "";
    doc.getElementById("evento-costo").value = data.costo ?? "";
    doc.getElementById("evento-observaciones").value = data.observaciones || "";
  } else if (tipo === "pesaje") {
    doc.getElementById("pesaje-fecha").value = data.fecha;
    doc.getElementById("pesaje-peso").value = weightFromKg(Number(data.peso));
    doc.getElementById("pesaje-condicion").value = data.condicion || "";
    doc.getElementById("pesaje-observaciones").value = data.observaciones || "";
  } else {
    doc.getElementById("produccion-tipo").value = data.tipo;
    doc.getElementById("produccion-cantidad").value = data.cantidad;
    doc.getElementById("produccion-unidad").value = data.unidad;
    doc.getElementById("produccion-fecha").value = data.fecha;
    doc.getElementById("produccion-observaciones").value = data.observaciones || "";
  }
  appState.registroEnEdicion = { tipo, id };
  actualizarRotulosEdicion(tipo);
}

export const editarEventoSanitario = (id) => editarRegistroPecuario("eventoSanitario", id);
export const editarPesaje = (id) => editarRegistroPecuario("pesaje", id);
export const editarProduccionAnimal = (id) => editarRegistroPecuario("produccionAnimal", id);

export async function archivarRegistroPecuario(tipo, id) {
  const config = configuracionRegistrosPecuarios[tipo];
  if (await archivarRegistro(config.tabla, id, config.descripcion)) await cargarRegistrosPecuarios(tipo);
}

export const archivarEventoSanitario = (id) => archivarRegistroPecuario("eventoSanitario", id);
export const archivarPesaje = (id) => archivarRegistroPecuario("pesaje", id);
export const archivarProduccionAnimal = (id) => archivarRegistroPecuario("produccionAnimal", id);

