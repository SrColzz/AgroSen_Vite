import { supabase } from "../lib/supabase";
import { cargarDashboard, initFinanceChart, initProductionChart, updateChart } from "../modules/dashboard";
import { calculateHarvest, escapeHtml, fechaLocalActual, filterTable, formatDate, renderTable, showToast, updateBadgeNotif, updateKpi, validateArea } from "../shared/dom";
import { appState } from "../shared/state";
import { actualizarDetalleRazaAnimal, archivarAnimal, eliminarAnimal, reactivarAnimal, reactivarRegistroPecuario, archivarEventoSanitario, archivarPesaje, archivarProduccionAnimal, cargarAnimales, cargarAnimalesEnSelector, cargarEspeciesAnimal, cargarEventosSanitarios, cargarLotesAnimal, cargarPesajes, cargarProduccionesAnimales, cargarRazasAnimal, editarAnimal, editarEventoSanitario, editarPesaje, editarProduccionAnimal, exportarAnimalesCSV, guardarAnimal, guardarEventoSanitario, guardarPesaje, guardarProduccionAnimal } from "../modules/livestock";
import { actualizarFormularioMovimiento, actualizarUbicacionProductoInventario, actualizarUnidadProductoLabor, anularMovimientoInventario, eliminarMovimientoInventario, eliminarProducto, archivarProducto, reactivarProducto, asegurarProductoEnSelector, cargarCultivosUsoInventario, cargarFincasProducto, cargarFincasUsoInventario, cargarInventario, cargarLotesProducto, cargarLotesUsoInventario, cargarProductosEnSelector, cargarResponsableUsoInventario, editarProducto, guardarMovimientoInventario, guardarProducto } from "../modules/inventory";
import { archivarCultivo, reactivarCultivo, archivarFinca, reactivarFinca, archivarLote, reactivarLote, eliminarLote, archivarTipoCultivo, reactivarTipoCultivo, anularCosecha, anularLabor, asegurarLoteEnSelector, cargarCatalogoCultivos, cargarCosechas, cargarCultivos, cargarCultivosDelLote, cargarFincas, cargarLabores, cargarReferenciasAgricolas, editarCosecha, editarCultivo, editarFinca, editarLabor, editarTipoCultivo, guardarCosecha, guardarLabor, guardarTipoCultivo, loadLotesEnSelect, renderLoteFields, saveCultivo, saveFinca, seleccionarCultivoCatalogo } from "../modules/agricultural";
import { archivarMovimientoFinanciero, reactivarMovimientoFinanciero, eliminarMovimientoFinanciero, cargarFincasFinancieras, cargarMovimientosFinancieros, editarMovimientoFinanciero, guardarMovimientoFinanciero } from "../modules/finance/data";
import { archivarEmpleado, reactivarEmpleado, eliminarRegistroRRHH, cargarDatosRRHH, cargarEmpleadosEnSelectores, cargarFincasEmpleados, editarEmpleado, guardarAsistencia, guardarEmpleado, guardarNomina } from "../modules/hr/data";

const doc: any = window.document;
const arrayFrom: any = Array.from;

/* ============================================================
   1. ESTADO GLOBAL
   ============================================================ */

function cambiarTema(tema, guardar = true) {
  const temaValido = tema === "light" ? "light" : "dark";
  doc.documentElement.dataset.theme = temaValido;
  doc.documentElement.style.colorScheme = temaValido;
  if (guardar) {
    try {
      localStorage.setItem("agrosen-theme", temaValido);
    } catch (error) {
      console.warn("No se pudo guardar la preferencia de tema:", error);
    }
  }
  const selectorTema = doc.getElementById("theme-select");
  if (selectorTema) selectorTema.value = temaValido;
  const descripcionTema = doc.getElementById("theme-description");
  if (descripcionTema) {
    descripcionTema.textContent = temaValido === "dark"
      ? "Cristal oscuro verde bosque"
      : "Cristal claro con acentos verde bosque";
  }
}

try {
  cambiarTema(localStorage.getItem("agrosen-theme") || doc.documentElement.dataset.theme || "dark", false);
} catch (_) {
  cambiarTema(doc.documentElement.dataset.theme || "dark", false);
}

/* ============================================================
   2. MÓDULO DE AUTENTICACIÓN
   ============================================================ */

async function logout() {
  await supabase.auth.signOut();
  setTopbarUser(null);
  showToast("Sesión cerrada");
}

const GOOGLE_CLIENT_ID = "TU_CLIENT_ID.apps.googleusercontent.com";
const GOOGLE_REDIRECT_URI = window.location.origin + window.location.pathname;

export function signInWithGoogle() {
  if (GOOGLE_CLIENT_ID.startsWith("TU_CLIENT_ID")) {
    showToast("Configura GOOGLE_CLIENT_ID en controller.ts para activar Google OAuth");
    return;
  }
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "token",
    scope: "openid email profile",
    prompt: "select_account",
  });
  window.location.href =
    "https://accounts.google.com/o/oauth2/v2/auth?" + params.toString();
}

function checkGoogleRedirect() {
  if (!window.location.hash.includes("access_token")) return;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = params.get("access_token");
  if (!accessToken) return;

  fetch(
    "https://www.googleapis.com/oauth2/v3/userinfo?access_token=" + accessToken,
  )
    .then((r) => r.json())
    .then((profile) => {
setTopbarUser({
        nombre: profile.name || profile.email,
        rol: "Usuario",
      });
      showToast("Bienvenido/a, " + (profile.name || profile.email));
      history.replaceState(null, "", window.location.pathname);
    })
    .catch(() => showToast("No se pudo obtener el perfil de Google"));
}

/* ============================================================
   3. TOPBAR — datos del usuario autenticado
   Llamar con el objeto de sesión real de Supabase:
     setTopbarUser({ nombre: 'Juan', rol: 'Administrador' })
   Llamar con null al cerrar sesión.
   ============================================================ */

/**
 * setTopbarUser(user)
 * Actualiza el avatar, nombre y rol en el topbar con
 * datos reales del usuario autenticado.
 *
 * EN PRODUCCIÓN:
 *   const { data: { user } } = await supabase.auth.getUser()
 *   const { data: perfil }   = await supabase
 *     .from('usuarios').select('nombre,rol').eq('id', user.id).single()
 *   setTopbarUser({ nombre: perfil.nombre, rol: perfil.rol })
 *
 * @param {Object|null} user — { nombre, rol } o null para limpiar
 */
export function setTopbarUser(user) {
  const avatarEl = doc.getElementById("topbar-avatar");
  const nombreEl = doc.getElementById("topbar-nombre");
  const rolEl = doc.getElementById("topbar-rol");

  if (!avatarEl || !nombreEl || !rolEl) return;

  if (!user) {
    avatarEl.textContent = "?";
    nombreEl.textContent = "Usuario";
    rolEl.textContent = "Cargando...";
    return;
  }

  // Iniciales: máximo dos letras del nombre
  const iniciales = user.nombre
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");

  avatarEl.textContent = iniciales;
  nombreEl.textContent = user.nombre;
  rolEl.textContent = user.rol || "Usuario";
}

/* ============================================================
   4. MÓDULO DE NAVEGACIÓN
   ============================================================ */

function toggleSidebar() {
  doc.getElementById("sidebar").classList.toggle("open");
}

const labels = {
  dashboard: "Dashboard",
  fincas: "Fincas y lotes",
  agricola: "Módulo agrícola",
  pecuario: "Módulo pecuario",
  inventario: "Inventarios",
  financiero: "Módulo financiero",
  rrhh: "Recursos humanos",
  reportes: "Reportes y Analytics",
  alertas: "Alertas y notificaciones",
  configuracion: "Configuración",
};

function showPage(name) {
  doc
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  doc.getElementById("page-" + name).classList.add("active");
  doc
    .querySelectorAll(".nav-item[data-page]")
    .forEach((b) => b.classList.toggle("active", b.dataset.page === name));
  doc.getElementById("crumb").textContent = labels[name];

  if (innerWidth < 760) {
    doc.getElementById("sidebar").classList.remove("open");
  }

  // Inicializar gráficas cuando su sección se hace visible
  // Los datos reales se cargarán desde Supabase antes de llamar a estas funciones
  if (name === "financiero") {
    setTimeout(() => {
      initFinanceChart();
      void cargarMovimientosFinancieros();
    }, 50);
  }
  if (name === "dashboard") {
    void cargarDashboard();
    setTimeout(initProductionChart, 50);
  }
  if (name === "fincas") cargarFincas();
  if (name === "pecuario") {
    cargarAnimales();
    cargarEventosSanitarios();
    cargarPesajes();
    cargarProduccionesAnimales();
  }
  if (name === "inventario") cargarInventario();
  if (name === "rrhh") void cargarDatosRRHH();
  if (name === "agricola") {
    cargarCatalogoCultivos();
    cargarCultivos();
    cargarLabores();
    cargarCosechas();
  }
}

/* ============================================================
   5. MÓDULO DE MODALES
   ============================================================ */

export async function openModal(id) {
  const planificacionAbierta = doc
    .getElementById("modalCultivo")
    ?.classList.contains("show");
  closeModals();
  appState.volverAPlanificacion = id === "modalTipoCultivo" && planificacionAbierta;
  doc.getElementById(id).classList.add("show");
  if (id === "modalConfiguracion") {
    cambiarTema(doc.documentElement.dataset.theme || "dark", false);
  }
  if (id === "modalCultivo") {
    calculateHarvest();
    loadLotesEnSelect("selectLoteCultivo");
    cargarCatalogoCultivos();
  }
  if (id === "modalLabor" || id === "modalCosecha") {
    const prefijo = id === "modalLabor" ? "labor" : "cosecha";
    const selectorCultivo = doc.getElementById(`${prefijo}-cultivo`);
    selectorCultivo.replaceChildren(new Option("Selecciona primero un lote", ""));
    loadLotesEnSelect(`${prefijo}-lote`);
    const fecha = doc.getElementById(`${prefijo}-fecha`);
    if (!fecha.value) fecha.value = fechaLocalActual();
    if (id === "modalLabor") await cargarProductosEnSelector("labor-producto");
  }
  if (id === "modalTipoCultivo") {
    doc.getElementById("tipo-cultivo-nombre").value = "";
    doc.getElementById("tipo-cultivo-variedad").value = "";
    doc.getElementById("tipo-cultivo-ciclo").value = "120";
  }
  if (id === "modalProducto") {
    doc.getElementById("producto-nombre").value = "";
    doc.getElementById("producto-categoria").selectedIndex = 0;
    doc.getElementById("producto-unidad").value = "kg";
    doc.getElementById("producto-stock-minimo").value = "0";
    await cargarFincasProducto();
  }
  if (id === "modalMovimiento") {
    doc.getElementById("mov-cantidad").value = "";
    doc.getElementById("mov-precio").value = "";
    doc.getElementById("mov-proveedor").value = "";
    doc.getElementById("mov-vencimiento").value = "";
    doc.getElementById("mov-tipo").value = "Entrada";
    doc.getElementById("mov-uso-observaciones").value = "";
    doc.getElementById("mov-uso-fecha").value = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    doc.getElementById("mov-uso-finca").replaceChildren(new Option("Cargando fincas...", ""));
    doc.getElementById("mov-uso-lote").replaceChildren(new Option("Selecciona primero una finca", ""));
    doc.getElementById("mov-uso-cultivo").replaceChildren(new Option("Selecciona primero un lote", ""));
    actualizarFormularioMovimiento();
    await Promise.all([cargarProductosEnSelector("mov-producto"), cargarFincasUsoInventario(), cargarResponsableUsoInventario()]);
  }
  if (id === "modalGasto" || id === "modalIngreso") {
    const prefijo = id === "modalIngreso" ? "ing" : "gasto";
    ["concepto", "valor", "fecha"].forEach((campo) => {
      const input = doc.getElementById(`${prefijo}-${campo}`);
      if (input) input.value = "";
    });
    if (id === "modalIngreso") doc.getElementById("ing-cliente").value = "";
    const categoria = doc.getElementById(id === "modalIngreso" ? "ing-tipo" : "gasto-categoria");
    if (categoria) categoria.selectedIndex = 0;
    const fecha = doc.getElementById(`${prefijo}-fecha`);
    if (fecha) fecha.value = fechaLocalActual();
    await cargarFincasFinancieras();
  }
  if (id === "modalEmpleado") {
    ["emp-nombres", "emp-identificacion", "emp-cargo", "emp-salario", "emp-fecha-ingreso"].forEach((campo) => {
      const input = doc.getElementById(campo);
      if (input) input.value = "";
    });
    doc.getElementById("emp-contrato").selectedIndex = 0;
    doc.getElementById("emp-periodicidad").value = "Mensual";
    await cargarFincasEmpleados();
  }
  if (id === "modalAsistencia" || id === "modalNomina") {
    const campos = id === "modalAsistencia"
      ? ["asistencia-fecha", "asistencia-entrada", "asistencia-salida", "asistencia-observaciones"]
      : ["nomina-periodo", "nomina-fecha-pago", "nomina-salario", "nomina-deducciones"];
    campos.forEach((campo) => { const input = doc.getElementById(campo); if (input) input.value = ""; });
    if (id === "modalAsistencia") {
      doc.getElementById("asistencia-fecha").value = fechaLocalActual();
      doc.getElementById("asistencia-estado").selectedIndex = 0;
    } else {
      doc.getElementById("nomina-periodo").value = fechaLocalActual().slice(0, 7);
      doc.getElementById("nomina-fecha-pago").value = fechaLocalActual();
      doc.getElementById("nomina-deducciones").value = "0";
    }
    await cargarEmpleadosEnSelectores();
  }
  if (id === "modalAnimal") {
    ["animal-especie", "animal-raza", "animal-lote"].forEach((campo) => {
      const elemento = doc.getElementById(campo);
      if (elemento) elemento.replaceChildren(new Option("Cargando...", ""));
    });
    ["animal-id", "animal-especie-detalle", "animal-raza-detalle", "animal-nacimiento", "animal-ubicacion", "animal-trazabilidad", "animal-observaciones"].forEach((campo) => {
      doc.getElementById(campo).value = "";
    });
    doc.getElementById("animal-sexo").value = "Hembra";
    doc.getElementById("animal-estado").value = "Activo";
    doc.getElementById("animal-especie-detalle-wrap").hidden = true;
    doc.getElementById("animal-raza-detalle-wrap").hidden = true;
    await Promise.all([cargarEspeciesAnimal(), cargarLotesAnimal()]);
  }
  const formulariosPecuarios = {
    modalEventoSanitario: ["evento-animal", "evento-producto", "evento-veterinario", "evento-fecha", "evento-proxima-fecha", "evento-costo", "evento-observaciones"],
    modalPesaje: ["pesaje-animal", "pesaje-fecha", "pesaje-peso", "pesaje-condicion", "pesaje-observaciones"],
    modalProduccionAnimal: ["produccion-animal", "produccion-cantidad", "produccion-fecha", "produccion-observaciones"],
  };
  if (formulariosPecuarios[id]) {
    formulariosPecuarios[id].forEach((campo) => { doc.getElementById(campo).value = ""; });
    const fecha = id === "modalEventoSanitario" ? "evento-fecha" : id === "modalPesaje" ? "pesaje-fecha" : "produccion-fecha";
    doc.getElementById(fecha).value = fechaLocalActual();
    if (id === "modalEventoSanitario") doc.getElementById("evento-tipo").selectedIndex = 0;
    if (id === "modalPesaje") doc.getElementById("pesaje-condicion").value = "";
    if (id === "modalProduccionAnimal") {
      doc.getElementById("produccion-tipo").selectedIndex = 0;
      doc.getElementById("produccion-unidad").value = "l";
    }
    await cargarAnimalesEnSelector(formulariosPecuarios[id][0]);
  }
}

export function closeModals() {
  doc
    .querySelectorAll(".modal")
    .forEach((m) => m.classList.remove("show"));
  appState.volverAPlanificacion = false;
  appState.registroEnEdicion = null;
  doc.getElementById("finca-cantidad-lotes").disabled = false;
  ["labor", "cosecha"].forEach((prefijo) => {
    doc.getElementById(`${prefijo}-lote`)?.removeAttribute("disabled");
    doc.getElementById(`${prefijo}-cultivo`)?.removeAttribute("disabled");
  });
  ["labor-producto", "labor-cantidad", "labor-unidad", "labor-insumo"].forEach((id) => {
    doc.getElementById(id)?.removeAttribute("disabled");
  });
  doc.getElementById("cosecha-tipo")?.removeAttribute("disabled");
  actualizarRotulosEdicion(null);
}

export function actualizarRotulosEdicion(tipo) {
  const configuracion = {
    producto: ["Agregar producto", "Guardar producto"],
    animal: ["Registrar animal", "Guardar animal"],
    finca: ["Registrar finca", "Guardar finca"],
    cultivo: ["Planificar cultivo", "Guardar planificación"],
    tipoCultivo: ["Agregar cultivo al catálogo", "Guardar en catálogo"],
    labor: ["Registrar labor cultural", "Guardar labor"],
    cosecha: ["Registrar cosecha", "Guardar cosecha"],
    eventoSanitario: ["Registrar evento sanitario", "Guardar evento"],
    pesaje: ["Registrar pesaje", "Guardar pesaje"],
    produccionAnimal: ["Registrar producción animal", "Guardar producción"],
  };
  const botones = {
    producto: "saveProductoButton",
    animal: "saveAnimalButton",
    finca: "saveFincaButton",
    cultivo: "saveCultivoButton",
    tipoCultivo: "saveTipoCultivoButton",
    labor: "saveLaborButton",
    cosecha: "saveCosechaButton",
    eventoSanitario: "saveEventoSanitarioButton",
    pesaje: "savePesajeButton",
    produccionAnimal: "saveProduccionAnimalButton",
  };
  Object.entries(configuracion).forEach(([clave, [titulo, texto]]) => {
    const modalId = clave === "tipoCultivo" ? "modalTipoCultivo" : `modal${clave[0].toUpperCase()}${clave.slice(1)}`;
    const modal = doc.getElementById(modalId);
    if (!modal) return;
    modal.querySelector(".modal-head h2").textContent = tipo === clave ? `Editar ${titulo.replace(/^(Registrar|Agregar|Planificar)\s*/i, "")}` : titulo;
    const boton = doc.getElementById(botones[clave]);
    if (boton) boton.textContent = tipo === clave ? "Guardar cambios" : texto;
  });
}

doc.querySelectorAll(".modal").forEach((m) =>
  m.addEventListener("click", (e) => {
    if (e.target === m) closeModals();
  }),
);

/**
 * saveForm(msg)
 * Cierra el modal y muestra confirmación.
 * EN PRODUCCIÓN: cada modal tendrá su propio onSubmit que llama
 * a Supabase, espera respuesta, y luego llama a closeModals() + showToast().
 */
function saveForm(msg) {
  closeModals();
  showToast("✓ " + msg);
}

export async function archivarRegistro(tabla, id, descripcion) {
  if (!window.confirm(`¿Quieres retirar este registro de ${descripcion}? Se conservará en el historial.`)) {
    return false;
  }

  const { data, error } = await supabase
    .from(tabla)
    .update({ activo: false })
    .eq("id", id)
    .select("id");

  if (error || !data?.length) {
    console.error(`No se pudo retirar el registro de ${descripcion}:`, error);
    showToast("No se pudo retirar el registro.");
    return false;
  }
  showToast("Registro retirado; el historial se conservó.");
  return true;
}

export async function reactivarRegistro(tabla, id, descripcion) {
  const { data, error } = await supabase.from(tabla).update({ activo: true }).eq("id", id).select("id");
  if (error || !data?.length) {
    console.error(`No se pudo reactivar ${descripcion}:`, error);
    showToast("No se pudo reactivar el registro.");
    return false;
  }
  showToast("Registro activado nuevamente.");
  return true;
}

export async function eliminarRegistroPermanente(tabla, id, descripcion) {
  if (!window.confirm(`¿Eliminar permanentemente ${descripcion}? Esta acción no se puede deshacer y el registro dejará de aparecer en el historial.`)) return false;
  const { data, error } = await supabase.from(tabla).delete().eq("id", id).select("id").maybeSingle();
  if (error || !data) {
    console.error(`No se pudo eliminar ${descripcion}:`, error);
    showToast(error?.code === "23503"
      ? "No se puede eliminar porque otros registros dependen de este elemento. Elimina primero esos registros vinculados."
      : "No se pudo eliminar. Revisa los permisos de Supabase.");
    return false;
  }

  showToast("Registro eliminado permanentemente.");
  if (["fincas", "lotes"].includes(tabla)) { await cargarFincas(); await cargarCultivos(); }
  if (["tipos_cultivo", "cultivos"].includes(tabla)) { await cargarCatalogoCultivos(); await cargarCultivos(); }
  if (["labores_culturales"].includes(tabla)) await cargarLabores();
  if (["cosechas"].includes(tabla)) await cargarCosechas();
  if (["productos", "movimientos_inventario"].includes(tabla)) await cargarInventario();
  if (["animales"].includes(tabla)) await cargarAnimales();
  if (["eventos_sanitarios"].includes(tabla)) await cargarEventosSanitarios();
  if (["pesajes"].includes(tabla)) await cargarPesajes();
  if (["producciones_animal"].includes(tabla)) await cargarProduccionesAnimales();
  if (["movimientos_financieros"].includes(tabla)) await cargarMovimientosFinancieros();
  if (["empleados", "asistencia", "nomina"].includes(tabla)) await cargarDatosRRHH();
  await cargarDashboard();
  return true;
}

export async function initializeLegacyApp() {
  // Compatibilidad con botones inline que aún puedan estar presentes en el DOM
  // por una sesión de Vite/HMR iniciada antes de migrar el inventario.
  Object.assign(window, { editarProducto });
  checkGoogleRedirect();
  updateBadgeNotif(0);
}

// Acciones del HTML legado expuestas como API del módulo, sin variables globales.
export const legacyActions = {
  actualizarDetalleRazaAnimal, actualizarFormularioMovimiento, actualizarUbicacionProductoInventario, actualizarUnidadProductoLabor, anularMovimientoInventario, eliminarMovimientoInventario, eliminarProducto, archivarProducto, reactivarProducto, calculateHarvest,
  reactivarRegistro,
  eliminarRegistroPermanente,
  cambiarTema, cargarCultivosDelLote, cargarCultivosUsoInventario, cargarInventario, cargarLotesProducto, cargarLotesUsoInventario, cargarRazasAnimal,
  closeModals, exportarAnimalesCSV, filterTable, guardarAnimal, guardarCosecha,
  guardarEventoSanitario, guardarLabor, guardarMovimientoInventario, guardarPesaje,
  editarAnimal, archivarAnimal, reactivarAnimal, eliminarAnimal, reactivarRegistroPecuario, editarEventoSanitario, archivarEventoSanitario,
  editarPesaje, archivarPesaje, editarProduccionAnimal, archivarProduccionAnimal,
  editarTipoCultivo, archivarTipoCultivo, reactivarTipoCultivo, editarFinca, archivarFinca, reactivarFinca, archivarLote, reactivarLote, eliminarLote,
  editarCultivo, archivarCultivo, reactivarCultivo, editarLabor, anularLabor, editarCosecha, anularCosecha,
  editarProducto, guardarProduccionAnimal, guardarProducto, guardarTipoCultivo, logout, openModal, cargarResponsableUsoInventario,
  archivarMovimientoFinanciero, reactivarMovimientoFinanciero, eliminarMovimientoFinanciero, cargarMovimientosFinancieros, editarMovimientoFinanciero,
  guardarMovimientoFinanciero,
  archivarEmpleado, reactivarEmpleado, eliminarRegistroRRHH, cargarDatosRRHH, editarEmpleado, guardarAsistencia, guardarEmpleado, guardarNomina,
  renderLoteFields, saveCultivo, saveFinca, saveForm, seleccionarCultivoCatalogo,
  showPage, showToast, toggleSidebar, updateChart, validateArea,
};

export {
  showPage, toggleSidebar, cambiarTema, logout, saveForm,
  cargarDashboard, initProductionChart, initFinanceChart, updateChart,
};
