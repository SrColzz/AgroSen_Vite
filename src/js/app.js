import { supabase } from "./supabase.js";

/* ============================================================
   1. ESTADO GLOBAL
   ============================================================ */

let charts = {}; // instancias de Chart.js (evita duplicados)
let catalogoCultivos = [];
let volverAPlanificacion = false;
let registroEnEdicion = null;
let solicitudRazasAnimal = 0;

function cambiarTema(tema, guardar = true) {
  const temaValido = tema === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = temaValido;
  document.documentElement.style.colorScheme = temaValido;
  if (guardar) {
    try {
      localStorage.setItem("agrosen-theme", temaValido);
    } catch (error) {
      console.warn("No se pudo guardar la preferencia de tema:", error);
    }
  }
  const selectorTema = document.getElementById("theme-select");
  if (selectorTema) selectorTema.value = temaValido;
  const descripcionTema = document.getElementById("theme-description");
  if (descripcionTema) {
    descripcionTema.textContent = temaValido === "dark"
      ? "Cristal oscuro verde bosque"
      : "Cristal claro con acentos verde bosque";
  }
}

try {
  cambiarTema(localStorage.getItem("agrosen-theme") || document.documentElement.dataset.theme || "dark", false);
} catch (_) {
  cambiarTema(document.documentElement.dataset.theme || "dark", false);
}

/* ============================================================
   2. MÓDULO DE AUTENTICACIÓN
   ============================================================ */

async function login() {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPass").value;

  if (!email || !password) {
    showToast("Ingresa tu correo y contraseña");
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    showToast("Credenciales incorrectas");
    return;
  }

  // Cada usuario solo puede consultar su propio perfil (política RLS).
  const { data: perfil, error: perfilError } = await supabase
    .from("usuarios")
    .select("nombre, rol")
    .eq("id", data.user.id)
    .single();

  if (perfilError) {
    console.error("No se pudo cargar el perfil de usuarios:", perfilError);
  }

  document.getElementById("login").classList.add("hidden");
  setTopbarUser(
    perfil || {
      nombre:
        data.user.user_metadata?.nombre ||
        data.user.email?.split("@")[0] ||
        "Usuario",
      rol: "Usuario",
    },
  );
  showToast("Sesión iniciada");
  cargarDashboard(); // cargar datos reales
}

async function logout() {
  await supabase.auth.signOut();
  document.getElementById("register").classList.add("hidden");
  document.getElementById("login").classList.remove("hidden");
  setTopbarUser(null);
  showToast("Sesión cerrada");
}

function recoverPassword() {
  showToast("Se enviaría un enlace de recuperación por correo (RF-003)");
}

function showRegister() {
  document.getElementById("login").classList.add("hidden");
  document.getElementById("register").classList.remove("hidden");
}

function showLoginScreen() {
  document.getElementById("register").classList.add("hidden");
  document.getElementById("login").classList.remove("hidden");
}

async function register() {
  const name = document.getElementById("regName").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const pass = document.getElementById("regPass").value;
  const pass2 = document.getElementById("regPass2").value;

  if (!name || !email || !pass) {
    showToast("Completa todos los campos para registrarte");
    return;
  }
  if (pass !== pass2) {
    showToast("Las contraseñas no coinciden");
    return;
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password: pass,
    options: { data: { nombre: name } },
  });

  if (error) {
    console.error("No se pudo crear la cuenta:", error);
    const signupError = `${error.code || ""} ${error.message || ""}`.toLowerCase();
    showToast(
      signupError.includes("over_email_send_rate_limit") ||
        signupError.includes("email rate limit exceeded")
        ? "Supabase alcanzó el límite de correos. Espera antes de volver a intentarlo."
        : "No se pudo crear la cuenta. Revisa el correo y la contraseña.",
    );
    return;
  }

  showLoginScreen();
  showToast(
    data.session
      ? "Cuenta creada. Ya puedes iniciar sesión."
      : "Cuenta creada. Revisa tu correo para confirmar el registro.",
  );
}

/* ── Google OAuth ─────────────────────────────────────────── */

// Reemplazar con el Client ID real de Google Cloud Console
// EN PRODUCCIÓN (Supabase): usar supabase.auth.signInWithOAuth({ provider: 'google' })
const GOOGLE_CLIENT_ID = "TU_CLIENT_ID.apps.googleusercontent.com";
const GOOGLE_REDIRECT_URI = window.location.origin + window.location.pathname;

function signInWithGoogle() {
  if (GOOGLE_CLIENT_ID.startsWith("TU_CLIENT_ID")) {
    showToast("Configura GOOGLE_CLIENT_ID en app.js para activar Google OAuth");
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
      document.getElementById("login").classList.add("hidden");
      document.getElementById("register").classList.add("hidden");
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
function setTopbarUser(user) {
  const avatarEl = document.getElementById("topbar-avatar");
  const nombreEl = document.getElementById("topbar-nombre");
  const rolEl = document.getElementById("topbar-rol");

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
  document.getElementById("sidebar").classList.toggle("open");
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
};

function showPage(name) {
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  document.getElementById("page-" + name).classList.add("active");
  document
    .querySelectorAll(".nav-item[data-page]")
    .forEach((b) => b.classList.toggle("active", b.dataset.page === name));
  document.getElementById("crumb").textContent = labels[name];

  if (innerWidth < 760) {
    document.getElementById("sidebar").classList.remove("open");
  }

  // Inicializar gráficas cuando su sección se hace visible
  // Los datos reales se cargarán desde Supabase antes de llamar a estas funciones
  if (name === "financiero") setTimeout(initFinanceChart, 50);
  if (name === "dashboard") setTimeout(initProductionChart, 50);
  if (name === "fincas") cargarFincas();
  if (name === "pecuario") {
    cargarAnimales();
    cargarEventosSanitarios();
    cargarPesajes();
    cargarProduccionesAnimales();
  }
  if (name === "inventario") cargarInventario();
  if (name === "agricola") {
    cargarCatalogoCultivos();
    cargarCultivos();
    cargarLabores();
    cargarCosechas();
  }
}

document
  .querySelectorAll(".nav-item[data-page]")
  .forEach((b) => b.addEventListener("click", () => showPage(b.dataset.page)));

/* ============================================================
   5. MÓDULO DE MODALES
   ============================================================ */

async function openModal(id) {
  const planificacionAbierta = document
    .getElementById("modalCultivo")
    ?.classList.contains("show");
  closeModals();
  volverAPlanificacion = id === "modalTipoCultivo" && planificacionAbierta;
  document.getElementById(id).classList.add("show");
  if (id === "modalConfiguracion") {
    cambiarTema(document.documentElement.dataset.theme || "dark", false);
  }
  if (id === "modalCultivo") {
    calculateHarvest();
    loadLotesEnSelect("selectLoteCultivo");
    cargarCatalogoCultivos();
  }
  if (id === "modalLabor" || id === "modalCosecha") {
    const prefijo = id === "modalLabor" ? "labor" : "cosecha";
    const selectorCultivo = document.getElementById(`${prefijo}-cultivo`);
    selectorCultivo.replaceChildren(new Option("Selecciona primero un lote", ""));
    loadLotesEnSelect(`${prefijo}-lote`);
    const fecha = document.getElementById(`${prefijo}-fecha`);
    if (!fecha.value) fecha.value = fechaLocalActual();
    if (id === "modalLabor") await cargarProductosEnSelector("labor-producto");
  }
  if (id === "modalTipoCultivo") {
    document.getElementById("tipo-cultivo-nombre").value = "";
    document.getElementById("tipo-cultivo-variedad").value = "";
    document.getElementById("tipo-cultivo-ciclo").value = "120";
  }
  if (id === "modalProducto") {
    document.getElementById("producto-nombre").value = "";
    document.getElementById("producto-categoria").selectedIndex = 0;
    document.getElementById("producto-unidad").value = "kg";
    document.getElementById("producto-stock-minimo").value = "0";
  }
  if (id === "modalMovimiento") {
    document.getElementById("mov-cantidad").value = "";
    document.getElementById("mov-precio").value = "";
    document.getElementById("mov-proveedor").value = "";
    document.getElementById("mov-vencimiento").value = "";
    cargarProductosEnSelector("mov-producto");
  }
  if (id === "modalAnimal") {
    ["animal-especie", "animal-raza", "animal-lote"].forEach((campo) => {
      const elemento = document.getElementById(campo);
      if (elemento) elemento.replaceChildren(new Option("Cargando...", ""));
    });
    ["animal-id", "animal-especie-detalle", "animal-raza-detalle", "animal-nacimiento", "animal-ubicacion", "animal-trazabilidad", "animal-observaciones"].forEach((campo) => {
      document.getElementById(campo).value = "";
    });
    document.getElementById("animal-sexo").value = "Hembra";
    document.getElementById("animal-estado").value = "Activo";
    document.getElementById("animal-especie-detalle-wrap").hidden = true;
    document.getElementById("animal-raza-detalle-wrap").hidden = true;
    await Promise.all([cargarEspeciesAnimal(), cargarLotesAnimal()]);
  }
  const formulariosPecuarios = {
    modalEventoSanitario: ["evento-animal", "evento-producto", "evento-veterinario", "evento-fecha", "evento-proxima-fecha", "evento-costo", "evento-observaciones"],
    modalPesaje: ["pesaje-animal", "pesaje-fecha", "pesaje-peso", "pesaje-condicion", "pesaje-observaciones"],
    modalProduccionAnimal: ["produccion-animal", "produccion-cantidad", "produccion-fecha", "produccion-observaciones"],
  };
  if (formulariosPecuarios[id]) {
    formulariosPecuarios[id].forEach((campo) => { document.getElementById(campo).value = ""; });
    const fecha = id === "modalEventoSanitario" ? "evento-fecha" : id === "modalPesaje" ? "pesaje-fecha" : "produccion-fecha";
    document.getElementById(fecha).value = fechaLocalActual();
    if (id === "modalEventoSanitario") document.getElementById("evento-tipo").selectedIndex = 0;
    if (id === "modalPesaje") document.getElementById("pesaje-condicion").value = "";
    if (id === "modalProduccionAnimal") {
      document.getElementById("produccion-tipo").selectedIndex = 0;
      document.getElementById("produccion-unidad").value = "l";
    }
    await cargarAnimalesEnSelector(formulariosPecuarios[id][0]);
  }
}

function closeModals() {
  document
    .querySelectorAll(".modal")
    .forEach((m) => m.classList.remove("show"));
  volverAPlanificacion = false;
  registroEnEdicion = null;
  document.getElementById("finca-cantidad-lotes").disabled = false;
  ["labor", "cosecha"].forEach((prefijo) => {
    document.getElementById(`${prefijo}-lote`)?.removeAttribute("disabled");
    document.getElementById(`${prefijo}-cultivo`)?.removeAttribute("disabled");
  });
  ["labor-producto", "labor-cantidad", "labor-unidad", "labor-insumo"].forEach((id) => {
    document.getElementById(id)?.removeAttribute("disabled");
  });
  document.getElementById("cosecha-tipo")?.removeAttribute("disabled");
  actualizarRotulosEdicion(null);
}

function actualizarRotulosEdicion(tipo) {
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
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.querySelector(".modal-head h2").textContent = tipo === clave ? `Editar ${titulo.replace(/^(Registrar|Agregar|Planificar)\s*/i, "")}` : titulo;
    const boton = document.getElementById(botones[clave]);
    if (boton) boton.textContent = tipo === clave ? "Guardar cambios" : texto;
  });
}

document.querySelectorAll(".modal").forEach((m) =>
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

async function saveFinca() {
  const nombre = document.getElementById("finca-nombre").value.trim();
  const ubicacion = document.getElementById("finca-ubicacion").value.trim();
  const areaTotal = Number(document.getElementById("finca-area").value);
  const tipoSuelo = document.getElementById("finca-suelo").value;
  const lotes = Array.from(
    document.querySelectorAll("#finca-lotes-fields .finca-lote-item"),
    (item) => ({
      nombre: item.querySelector("[data-lote-nombre]").value.trim(),
      area: Number(item.querySelector("[data-lote-area]").value),
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

  if (registroEnEdicion?.tipo === "finca") {
    const { id, lotesIds } = registroEnEdicion;
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

  document.getElementById("finca-nombre").value = "";
  document.getElementById("finca-ubicacion").value = "";
  document.getElementById("finca-area").value = "";
  document.getElementById("finca-suelo").selectedIndex = 0;
  document.getElementById("finca-cantidad-lotes").value = "0";
  renderLoteFields();
  closeModals();
  showToast(`Finca guardada con ${lotes.length} lote(s).`);
  await cargarFincas();
}

async function saveCultivo() {
  const tipoSelect = document.getElementById("cultivo-tipo");
  const opcionCultivo = tipoSelect.selectedOptions[0];
  const idTipoCultivo = tipoSelect.value;
  const tipo = opcionCultivo?.dataset.nombre || "";
  const variedad = document.getElementById("cultivo-variedad").value.trim();
  const idLote = document.getElementById("selectLoteCultivo").value;
  const cantidadSemilla = Number(
    document.getElementById("cultivo-semilla").value,
  );
  const unidadSemilla = document.getElementById("cultivo-semilla-unidad").value;
  const fechaSiembra = document.getElementById("cultivo-siembra").value;
  const cicloDias = Number(document.getElementById("cycle").value);
  const fechaCosecha = document.getElementById("harvest").value;

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
  const editandoCultivo = registroEnEdicion?.tipo === "cultivo";
  const idCultivoEditado = registroEnEdicion?.id;
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
  document.getElementById("cultivo-variedad").value = "";
  document.getElementById("selectLoteCultivo").value = "";
  document.getElementById("cultivo-semilla").value = "";
  document.getElementById("cultivo-siembra").value = "";
  document.getElementById("cycle").value = "";
  calculateHarvest();
  closeModals();
  showToast(editandoCultivo ? "Cultivo actualizado." : "Cultivo planificado y guardado correctamente.");
  await cargarCultivos();
  cargarDashboard();
}

async function guardarTipoCultivo() {
  const nombre = document
    .getElementById("tipo-cultivo-nombre")
    .value.trim();
  const variedad = document
    .getElementById("tipo-cultivo-variedad")
    .value.trim();
  const cicloDias = Number(
    document.getElementById("tipo-cultivo-ciclo").value,
  );

  if (!nombre || !Number.isInteger(cicloDias) || cicloDias <= 0) {
    showToast("Escribe el nombre del cultivo y un ciclo válido en días.");
    return;
  }

  const editandoCatalogo = registroEnEdicion?.tipo === "tipoCultivo";
  const idTipoEditado = registroEnEdicion?.id;
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

  const reabrirPlanificacion = volverAPlanificacion;
  closeModals();
  await cargarCatalogoCultivos();
  showToast(editandoCatalogo ? "Cultivo del catálogo actualizado." : "Cultivo agregado al catálogo.");

  if (reabrirPlanificacion) {
    openModal("modalCultivo");
    const selector = document.getElementById("cultivo-tipo");
    selector.value = data.id;
    seleccionarCultivoCatalogo();
  }
}

async function cargarCatalogoCultivos() {
  const { data, error } = await supabase
    .from("tipos_cultivo")
    .select("id, nombre, variedad, ciclo_dias, activo")
    .eq("activo", true)
    .order("nombre", { ascending: true });

  if (error) {
    console.error("No se pudo cargar el catálogo de cultivos:", error);
    if (error.code === "PGRST205" || error.code === "42P01") {
      showToast("Falta crear el catálogo de cultivos en Supabase.");
    }
    return;
  }

  catalogoCultivos = data || [];
  const tbody = document.querySelector("#tiposCultivoTable tbody");
  if (tbody) {
    renderTable("tiposCultivoTable", catalogoCultivos, (cultivo) => `
      <tr>
        <td>${escapeHtml(cultivo.nombre)}</td>
        <td>${escapeHtml(cultivo.variedad || "—")}</td>
        <td>${cultivo.ciclo_dias}</td>
        <td><span class="status ok">Disponible</span></td>
        <td><button class="btn btn-soft btn-sm" onclick="editarTipoCultivo('${cultivo.id}')">Editar</button> <button class="btn btn-soft btn-sm" onclick="archivarTipoCultivo('${cultivo.id}')">Retirar</button></td>
      </tr>
    `);
  }

  const selector = document.getElementById("cultivo-tipo");
  if (!selector) return;
  const seleccionActual = selector.value;
  selector.replaceChildren(
    new Option(
      catalogoCultivos.length
        ? "Selecciona un cultivo"
        : "No hay cultivos en el catálogo",
      "",
    ),
  );

  catalogoCultivos.forEach((cultivo) => {
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

async function editarTipoCultivo(id) {
  const cultivo = catalogoCultivos.find((item) => item.id === id);
  if (!cultivo) return;
  openModal("modalTipoCultivo");
  document.getElementById("tipo-cultivo-nombre").value = cultivo.nombre;
  document.getElementById("tipo-cultivo-variedad").value = cultivo.variedad || "";
  document.getElementById("tipo-cultivo-ciclo").value = cultivo.ciclo_dias;
  registroEnEdicion = { tipo: "tipoCultivo", id };
  actualizarRotulosEdicion("tipoCultivo");
}

function seleccionarCultivoCatalogo() {
  const selector = document.getElementById("cultivo-tipo");
  const opcion = selector?.selectedOptions[0];
  const variedad = document.getElementById("cultivo-variedad");
  const ciclo = document.getElementById("cycle");

  variedad.value = opcion?.dataset.variedad || "";
  ciclo.value = opcion?.dataset.ciclo || "";
  calculateHarvest();
}

async function guardarLabor() {
  const idLote = document.getElementById("labor-lote").value;
  const idCultivo = document.getElementById("labor-cultivo").value;
  const idProducto = document.getElementById("labor-producto").value || null;
  const actividad = document.getElementById("labor-actividad").value;
  const insumo = document.getElementById("labor-insumo").value.trim();
  const cantidadInput = document.getElementById("labor-cantidad").value;
  const cantidad = cantidadInput ? Number(cantidadInput) : null;
  const unidad = cantidad === null ? null : document.getElementById("labor-unidad").value;
  const observaciones = document
    .getElementById("labor-observaciones")
    .value.trim();
  const fecha = document.getElementById("labor-fecha").value;

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
  const editandoLabor = registroEnEdicion?.tipo === "labor";
  const respuesta = editandoLabor
    ? await supabase.from("labores_culturales").update({ ...datosLabor, id_producto: idProducto }).eq("id", registroEnEdicion.id)
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

  document.getElementById("labor-lote").value = "";
  document.getElementById("labor-cultivo").replaceChildren(
    new Option("Selecciona primero un lote", ""),
  );
  document.getElementById("labor-insumo").value = "";
  document.getElementById("labor-producto").value = "";
  document.getElementById("labor-cantidad").value = "";
  document.getElementById("labor-observaciones").value = "";
  document.getElementById("labor-fecha").value = "";
  closeModals();
  showToast(editandoLabor ? "Labor cultural actualizada." : "Labor cultural guardada.");
  await cargarLabores();
}

async function guardarCosecha() {
  const idLote = document.getElementById("cosecha-lote").value;
  const idCultivo = document.getElementById("cosecha-cultivo").value;
  const cantidad = Number(document.getElementById("cosecha-cantidad").value);
  const unidad = document.getElementById("cosecha-unidad").value;
  const calidad = document.getElementById("cosecha-calidad").value;
  const fecha = document.getElementById("cosecha-fecha").value;
  const esFinal = document.getElementById("cosecha-tipo").value === "true";
  const destino = document.getElementById("cosecha-destino").value.trim();

  if (!idLote || !idCultivo || !fecha) {
    showToast("Selecciona lote, cultivo y fecha para registrar la cosecha.");
    return;
  }
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    showToast("La cantidad cosechada debe ser mayor que cero.");
    return;
  }

  const editandoCosecha = registroEnEdicion?.tipo === "cosecha";
  const respuesta = editandoCosecha
    ? await supabase
        .from("cosechas")
        .update({ cantidad, unidad, calidad, fecha, destino: destino || null })
        .eq("id", registroEnEdicion.id)
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

  document.getElementById("cosecha-lote").value = "";
  document.getElementById("cosecha-cultivo").replaceChildren(
    new Option("Selecciona primero un lote", ""),
  );
  document.getElementById("cosecha-cantidad").value = "";
  document.getElementById("cosecha-fecha").value = "";
  document.getElementById("cosecha-destino").value = "";
  document.getElementById("cosecha-tipo").value = "false";
  closeModals();
  showToast(editandoCosecha ? "Cosecha actualizada." : esFinal ? "Cosecha final guardada; cultivo cerrado." : "Cosecha parcial guardada.");
  await cargarCosechas();
  await cargarCultivos();
  cargarDashboard();
}

function renderLoteFields() {
  const cantidadInput = document.getElementById("finca-cantidad-lotes");
  const container = document.getElementById("finca-lotes-fields");
  if (!cantidadInput || !container) return;

  const cantidad = Math.min(
    30,
    Math.max(0, Number.parseInt(cantidadInput.value, 10) || 0),
  );
  cantidadInput.value = cantidad;
  const valoresActuales = Array.from(
    container.querySelectorAll(".finca-lote-item"),
    (item) => ({
      id: item.dataset.loteId || "",
      nombre: item.querySelector("[data-lote-nombre]").value,
      area: item.querySelector("[data-lote-area]").value,
      uso: item.querySelector("[data-lote-uso]").value,
    }),
  );
  container.innerHTML = Array.from({ length: cantidad }, (_, index) => `
    <div class="finca-lote-item" data-lote-id="${escapeHtml(valoresActuales[index]?.id || "")}">
      <strong class="finca-lote-title">Lote ${index + 1}</strong>
      <div class="field">
        <label for="finca-lote-nombre-${index}">Nombre del lote</label>
        <input id="finca-lote-nombre-${index}" data-lote-nombre placeholder="Ej. L-01" value="${escapeHtml(valoresActuales[index]?.nombre || "")}" required>
      </div>
      <div class="field">
        <label for="finca-lote-area-${index}">Área (ha)</label>
        <input id="finca-lote-area-${index}" data-lote-area type="number" min="0.01" step="0.01" value="${escapeHtml(valoresActuales[index]?.area || "")}" required>
      </div>
      <div class="field">
        <label for="finca-lote-uso-${index}">Cultivo / uso (opcional)</label>
        <input id="finca-lote-uso-${index}" data-lote-uso placeholder="Ej. Café" value="${escapeHtml(valoresActuales[index]?.uso || "")}">
      </div>
    </div>
  `).join("");
}

async function cargarFincas() {
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
  let lotes = [];
  if (fincas.length) {
    const { data: lotesData, error: errorLotes } = await supabase
      .from("lotes")
      .select("id, id_finca, nombre, area, uso, activo")
      .in("id_finca", fincas.map((finca) => finca.id));

    if (errorLotes) {
      console.error("No se pudieron cargar los lotes:", errorLotes);
      showToast("No se pudieron cargar los lotes. Revisa la tabla y sus permisos.");
      return;
    }
    lotes = lotesData || [];
  }

  const areaTotal = fincas.reduce(
    (suma, finca) => suma + Number(finca.area_total || 0),
    0,
  );
  const activas = fincas.filter((finca) => finca.activo).length;
  const lotesActivos = lotes.filter((lote) => lote.activo);
  updateKpi("kpi-fincas", activas);
  updateKpi("kpi-lotes", lotesActivos.length);
  updateKpi("kpi-area-total", `${areaTotal.toLocaleString("es-CO")} ha`);
  updateKpi(
    "kpi-area-usada",
    `${lotesActivos
      .reduce((suma, lote) => suma + Number(lote.area || 0), 0)
      .toLocaleString("es-CO")} ha`,
  );

  const lotesPorFinca = new Map();
  lotes.forEach((lote) => {
    const grupo = lotesPorFinca.get(lote.id_finca) || [];
    grupo.push(lote);
    lotesPorFinca.set(lote.id_finca, grupo);
  });

  renderTable("farmTable", fincas, (finca) => `
    <tr>
      <td>${escapeHtml(finca.nombre)}</td>
      <td>${escapeHtml(finca.ubicacion)}</td>
      <td>${Number(finca.area_total).toLocaleString("es-CO")} ha</td>
      <td>${escapeHtml(finca.tipo_suelo)}</td>
      <td>${escapeHtml(
        (lotesPorFinca.get(finca.id) || [])
          .map((lote) => `${lote.nombre} · ${lote.area} ha`)
          .join(", ") || finca.detalle_lotes || "—",
      )}</td>
      <td><span class="status ${finca.activo ? "ok" : "warn"}">${finca.activo ? "Activa" : "Inactiva"}</span></td>
      <td><button class="btn btn-soft btn-sm" onclick="editarFinca('${finca.id}')">Editar</button> <button class="btn btn-soft btn-sm" onclick="archivarFinca('${finca.id}')">Archivar</button></td>
    </tr>
  `);
}

async function editarFinca(id) {
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
  document.getElementById("finca-nombre").value = finca.nombre || "";
  document.getElementById("finca-ubicacion").value = finca.ubicacion || "";
  document.getElementById("finca-area").value = finca.area_total || "";
  document.getElementById("finca-suelo").value = finca.tipo_suelo || "Franco";
  document.getElementById("finca-cantidad-lotes").value = (lotes || []).length;
  document.getElementById("finca-cantidad-lotes").disabled = true;
  renderLoteFields();
  Array.from(document.querySelectorAll("#finca-lotes-fields .finca-lote-item")).forEach((item, index) => {
    const lote = lotes[index];
    item.dataset.loteId = lote.id;
    item.querySelector("[data-lote-nombre]").value = lote.nombre || "";
    item.querySelector("[data-lote-area]").value = lote.area || "";
    item.querySelector("[data-lote-uso]").value = lote.uso || "";
  });
  registroEnEdicion = { tipo: "finca", id, lotesIds: (lotes || []).map((lote) => lote.id) };
  actualizarRotulosEdicion("finca");
}

async function cargarCultivos() {
  const { data, error } = await supabase
    .from("cultivos")
    .select(
      "id, id_lote, tipo, variedad, fecha_siembra, fecha_cosecha_estimada, estado, activo",
    )
    .eq("activo", true)
    .order("fecha_siembra", { ascending: false });

  if (error) {
    console.error("No se pudieron cargar los cultivos:", error);
    if (error.code === "PGRST205" || error.code === "42P01") {
      showToast("Falta crear la tabla de cultivos en Supabase.");
    }
    return;
  }

  const cultivos = data || [];
  const loteIds = [...new Set(cultivos.map((cultivo) => cultivo.id_lote))];
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
  const activos = cultivos.filter((cultivo) => cultivo.activo).length;
  updateKpi("kpi-cultivos", activos);

  renderTable("cultivosTable", cultivos, (cultivo) => `
    <tr>
      <td>${escapeHtml(cultivo.tipo)}</td>
      <td>${escapeHtml(cultivo.variedad || "—")}</td>
      <td>${escapeHtml(nombresLotes.get(cultivo.id_lote) || "—")}</td>
      <td>${formatDate(cultivo.fecha_siembra)}</td>
      <td>${formatDate(cultivo.fecha_cosecha_estimada)}</td>
      <td><span class="status info">${escapeHtml(cultivo.estado)}</span></td>
      <td><button class="btn btn-soft btn-sm" onclick="editarCultivo('${cultivo.id}')">Editar</button> <button class="btn btn-soft btn-sm" onclick="archivarCultivo('${cultivo.id}')">Archivar</button></td>
    </tr>
  `);
}

async function editarCultivo(id) {
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
  const tipoSelect = document.getElementById("cultivo-tipo");
  let opcionCultivo = Array.from(tipoSelect.options).find((option) => option.value === cultivo.id_tipo_cultivo);
  if (!opcionCultivo) {
    opcionCultivo = Array.from(tipoSelect.options).find((option) =>
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
  document.getElementById("cultivo-variedad").value = cultivo.variedad || "";
  document.getElementById("selectLoteCultivo").value = cultivo.id_lote;
  document.getElementById("cultivo-semilla").value = cultivo.cantidad_semilla;
  document.getElementById("cultivo-semilla-unidad").value = cultivo.unidad_semilla;
  document.getElementById("cultivo-siembra").value = cultivo.fecha_siembra;
  document.getElementById("cycle").value = cultivo.ciclo_dias;
  calculateHarvest();
  registroEnEdicion = { tipo: "cultivo", id };
  actualizarRotulosEdicion("cultivo");
}

async function cargarReferenciasAgricolas(registros) {
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

async function cargarLabores() {
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
        <td><button class="btn btn-soft btn-sm" onclick="editarLabor('${labor.id}')">Editar</button> <button class="btn btn-soft btn-sm" onclick="anularLabor('${labor.id}')">Archivar</button></td>
      </tr>
    `;
  });
}

async function editarLabor(id) {
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
  document.getElementById("labor-lote").value = labor.id_lote;
  await cargarCultivosDelLote("labor", true);
  document.getElementById("labor-cultivo").value = labor.id_cultivo;
  document.getElementById("labor-producto").value = labor.id_producto || "";
  actualizarUnidadProductoLabor();
  document.getElementById("labor-actividad").value = labor.actividad;
  document.getElementById("labor-fecha").value = labor.fecha;
  document.getElementById("labor-insumo").value = labor.insumo || "";
  document.getElementById("labor-cantidad").value = labor.cantidad_insumo ?? "";
  document.getElementById("labor-unidad").value = labor.unidad_insumo || "kg";
  document.getElementById("labor-observaciones").value = labor.observaciones || "";
  if (labor.id_producto) {
    ["labor-producto", "labor-cantidad", "labor-unidad", "labor-insumo"].forEach((idCampo) => {
      document.getElementById(idCampo).disabled = true;
    });
  }
  registroEnEdicion = { tipo: "labor", id };
  actualizarRotulosEdicion("labor");
}

async function cargarCosechas() {
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
        <td><button class="btn btn-soft btn-sm" onclick="editarCosecha('${cosecha.id}')">Editar</button> <button class="btn btn-soft btn-sm" onclick="anularCosecha('${cosecha.id}')">Archivar</button></td>
    </tr>
  `);
}

async function archivarRegistro(tabla, id, descripcion) {
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

async function archivarTipoCultivo(id) {
  if (await archivarRegistro("tipos_cultivo", id, "cultivos del catálogo")) {
    await cargarCatalogoCultivos();
  }
}

async function archivarFinca(id) {
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

async function archivarCultivo(id) {
  if (await archivarRegistro("cultivos", id, "cultivos activos")) {
    await cargarCultivos();
    cargarDashboard();
  }
}

async function anularLabor(id) {
  if (await archivarRegistro("labores_culturales", id, "labores culturales")) {
    await cargarLabores();
  }
}

async function anularCosecha(id) {
  if (await archivarRegistro("cosechas", id, "cosechas")) {
    await cargarCosechas();
  }
}

async function cargarEspeciesAnimal() {
  const selector = document.getElementById("animal-especie");
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

async function cargarRazasAnimal() {
  const solicitud = ++solicitudRazasAnimal;
  const idEspecie = document.getElementById("animal-especie").value;
  const selector = document.getElementById("animal-raza");
  const especieNombre = document.getElementById("animal-especie").selectedOptions[0]?.text || "";
  const especieEsOtra = especieNombre.toLowerCase() === "otro";
  document.getElementById("animal-especie-detalle-wrap").hidden = !especieEsOtra;
  document.getElementById("animal-especie-detalle").disabled = !especieEsOtra;
  if (!especieEsOtra) document.getElementById("animal-especie-detalle").value = "";
  if (!idEspecie) {
    selector.replaceChildren(new Option("Selecciona una especie primero", ""));
    document.getElementById("animal-raza-detalle-wrap").hidden = true;
    document.getElementById("animal-raza-detalle").disabled = true;
    return;
  }

  selector.replaceChildren(new Option("Cargando razas...", ""));
  const { data, error } = await supabase
    .from("razas")
    .select("id, nombre")
    .eq("id_especie", idEspecie)
    .order("nombre", { ascending: true });
  if (solicitud !== solicitudRazasAnimal || document.getElementById("animal-especie").value !== idEspecie) return;
  if (error) {
    console.error("No se pudieron cargar las razas:", error);
    selector.replaceChildren(new Option("No se pudo cargar el catálogo", ""));
    return;
  }
  selector.replaceChildren(new Option("Sin raza especificada", ""));
  (data || []).forEach((raza) => selector.add(new Option(raza.nombre, raza.id)));
  actualizarDetalleRazaAnimal();
}

function actualizarDetalleRazaAnimal() {
  const selector = document.getElementById("animal-raza");
  const esOtra = (selector?.selectedOptions[0]?.text || "").toLowerCase() === "otra";
  document.getElementById("animal-raza-detalle-wrap").hidden = !esOtra;
  document.getElementById("animal-raza-detalle").disabled = !esOtra;
  if (!esOtra) document.getElementById("animal-raza-detalle").value = "";
}

async function cargarLotesAnimal() {
  const selector = document.getElementById("animal-lote");
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

async function asegurarLoteAnimal(idLote) {
  const selector = document.getElementById("animal-lote");
  if (!idLote || Array.from(selector.options).some((option) => option.value === idLote)) return;
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

async function cargarAnimales() {
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

async function guardarAnimal() {
  const especieSelect = document.getElementById("animal-especie");
  const razaSelect = document.getElementById("animal-raza");
  const idEspecie = especieSelect.value;
  const nombreEspecie = especieSelect.selectedOptions[0]?.text || "";
  const idRaza = razaSelect.value || null;
  const nombreRaza = razaSelect.selectedOptions[0]?.text || "";
  const identificacion = document.getElementById("animal-id").value.trim();
  const especieDetalle = document.getElementById("animal-especie-detalle").value.trim();
  const razaDetalle = document.getElementById("animal-raza-detalle").value.trim();
  const sexo = document.getElementById("animal-sexo").value;
  const fechaNacimiento = document.getElementById("animal-nacimiento").value || null;
  const idLote = document.getElementById("animal-lote").value || null;
  const ubicacion = document.getElementById("animal-ubicacion").value.trim();
  const estado = document.getElementById("animal-estado").value;
  const observaciones = document.getElementById("animal-observaciones").value.trim();
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
  const editando = registroEnEdicion?.tipo === "animal";
  const respuesta = editando
    ? await supabase.from("animales").update(datosAnimal).eq("id", registroEnEdicion.id).select("codigo_trazabilidad").single()
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

async function editarAnimal(id) {
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
  document.getElementById("animal-especie").value = animal.id_especie;
  await cargarRazasAnimal();
  document.getElementById("animal-raza").value = animal.id_raza || "";
  actualizarDetalleRazaAnimal();
  document.getElementById("animal-id").value = animal.identificacion;
  document.getElementById("animal-especie-detalle").value = animal.especie_detalle || "";
  document.getElementById("animal-raza-detalle").value = animal.raza_detalle || "";
  document.getElementById("animal-sexo").value = animal.sexo;
  document.getElementById("animal-nacimiento").value = animal.fecha_nacimiento || "";
  await asegurarLoteAnimal(animal.id_lote);
  document.getElementById("animal-lote").value = animal.id_lote || "";
  document.getElementById("animal-ubicacion").value = animal.ubicacion || "";
  document.getElementById("animal-estado").value = animal.estado;
  document.getElementById("animal-trazabilidad").value = animal.codigo_trazabilidad;
  document.getElementById("animal-observaciones").value = animal.observaciones || "";
  registroEnEdicion = { tipo: "animal", id };
  actualizarRotulosEdicion("animal");
}

async function archivarAnimal(id) {
  if (await archivarRegistro("animales", id, "ficha del animal")) {
    await cargarAnimales();
    cargarDashboard();
  }
}

function exportarAnimalesCSV() {
  const tabla = document.getElementById("animalesTable");
  const filas = Array.from(tabla.querySelectorAll("tr"));
  if (tabla.querySelector("tbody .empty")) {
    showToast("No hay fichas de animales para exportar.");
    return;
  }
  const contenido = filas.map((fila) => Array.from(fila.cells).slice(0, -1).map((celda) => {
    const valor = celda.innerText.trim().replace(/"/g, '""');
    return `"${valor}"`;
  }).join(";")).join("\r\n");
  const archivo = new Blob(["\uFEFF", contenido], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(archivo);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `agrosen-animales-${fechaLocalActual()}.csv`;
  enlace.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function cargarAnimalesEnSelector(selectorId, idSeleccionado = null) {
  const selector = document.getElementById(selectorId);
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
    if (animal && !Array.from(selector.options).some((option) => option.value === animal.id)) {
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

async function cargarRegistrosPecuarios(tipo) {
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
    else if (tipo === "pesaje") celdas = `<td>${formatDate(registro.fecha)}</td><td>${animal}</td><td>${Number(registro.peso).toLocaleString("es-CO")} kg</td><td>${escapeHtml(registro.condicion || "—")}</td><td>${escapeHtml(registro.observaciones || "—")}</td>`;
    else celdas = `<td>${formatDate(registro.fecha)}</td><td>${animal}</td><td>${escapeHtml(registro.tipo)}</td><td>${Number(registro.cantidad).toLocaleString("es-CO")} ${escapeHtml(registro.unidad)}</td><td>${escapeHtml(registro.observaciones || "—")}</td>`;
    const editar = tipo === "eventoSanitario" ? "editarEventoSanitario" : tipo === "pesaje" ? "editarPesaje" : "editarProduccionAnimal";
    const archivar = tipo === "eventoSanitario" ? "archivarEventoSanitario" : tipo === "pesaje" ? "archivarPesaje" : "archivarProduccionAnimal";
    return `<tr>${celdas}<td><button class="btn btn-soft btn-sm" onclick="${editar}('${registro.id}')">Editar</button> <button class="btn btn-soft btn-sm" onclick="${archivar}('${registro.id}')">Archivar</button></td></tr>`;
  });
}

const cargarEventosSanitarios = () => cargarRegistrosPecuarios("eventoSanitario");
const cargarPesajes = () => cargarRegistrosPecuarios("pesaje");
const cargarProduccionesAnimales = () => cargarRegistrosPecuarios("produccionAnimal");

async function guardarRegistroPecuario(tipo, datos) {
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
  const editando = registroEnEdicion?.tipo === tipo;
  const respuesta = editando
    ? await supabase.from(config.tabla).update(datos).eq("id", registroEnEdicion.id).select("id").maybeSingle()
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

function guardarEventoSanitario() {
  const costo = document.getElementById("evento-costo").value;
  return guardarRegistroPecuario("eventoSanitario", {
    id_animal: document.getElementById("evento-animal").value,
    tipo: document.getElementById("evento-tipo").value,
    producto: document.getElementById("evento-producto").value.trim() || null,
    veterinario: document.getElementById("evento-veterinario").value.trim() || null,
    fecha: document.getElementById("evento-fecha").value,
    proxima_fecha: document.getElementById("evento-proxima-fecha").value || null,
    costo: costo === "" ? null : Number(costo),
    observaciones: document.getElementById("evento-observaciones").value.trim() || null,
  });
}

function guardarPesaje() {
  return guardarRegistroPecuario("pesaje", {
    id_animal: document.getElementById("pesaje-animal").value,
    fecha: document.getElementById("pesaje-fecha").value,
    peso: Number(document.getElementById("pesaje-peso").value),
    condicion: document.getElementById("pesaje-condicion").value.trim() || null,
    observaciones: document.getElementById("pesaje-observaciones").value.trim() || null,
  });
}

function guardarProduccionAnimal() {
  return guardarRegistroPecuario("produccionAnimal", {
    id_animal: document.getElementById("produccion-animal").value,
    tipo: document.getElementById("produccion-tipo").value,
    cantidad: Number(document.getElementById("produccion-cantidad").value),
    unidad: document.getElementById("produccion-unidad").value,
    fecha: document.getElementById("produccion-fecha").value,
    observaciones: document.getElementById("produccion-observaciones").value.trim() || null,
  });
}

async function editarRegistroPecuario(tipo, id) {
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
    document.getElementById("evento-tipo").value = data.tipo;
    document.getElementById("evento-producto").value = data.producto || "";
    document.getElementById("evento-veterinario").value = data.veterinario || "";
    document.getElementById("evento-fecha").value = data.fecha;
    document.getElementById("evento-proxima-fecha").value = data.proxima_fecha || "";
    document.getElementById("evento-costo").value = data.costo ?? "";
    document.getElementById("evento-observaciones").value = data.observaciones || "";
  } else if (tipo === "pesaje") {
    document.getElementById("pesaje-fecha").value = data.fecha;
    document.getElementById("pesaje-peso").value = data.peso;
    document.getElementById("pesaje-condicion").value = data.condicion || "";
    document.getElementById("pesaje-observaciones").value = data.observaciones || "";
  } else {
    document.getElementById("produccion-tipo").value = data.tipo;
    document.getElementById("produccion-cantidad").value = data.cantidad;
    document.getElementById("produccion-unidad").value = data.unidad;
    document.getElementById("produccion-fecha").value = data.fecha;
    document.getElementById("produccion-observaciones").value = data.observaciones || "";
  }
  registroEnEdicion = { tipo, id };
  actualizarRotulosEdicion(tipo);
}

const editarEventoSanitario = (id) => editarRegistroPecuario("eventoSanitario", id);
const editarPesaje = (id) => editarRegistroPecuario("pesaje", id);
const editarProduccionAnimal = (id) => editarRegistroPecuario("produccionAnimal", id);

async function archivarRegistroPecuario(tipo, id) {
  const config = configuracionRegistrosPecuarios[tipo];
  if (await archivarRegistro(config.tabla, id, config.descripcion)) await cargarRegistrosPecuarios(tipo);
}

const archivarEventoSanitario = (id) => archivarRegistroPecuario("eventoSanitario", id);
const archivarPesaje = (id) => archivarRegistroPecuario("pesaje", id);
const archivarProduccionAnimal = (id) => archivarRegistroPecuario("produccionAnimal", id);

async function cargarInventario() {
  const categoria = document.getElementById("inventario-filtro-categoria")?.value;
  const consultaProductos = supabase
    .from("productos")
    .select("id, nombre, categoria, unidad, stock, stock_minimo, costo_promedio, activo")
    .eq("activo", true)
    .order("nombre", { ascending: true });

  const [respuestaProductos, respuestaMovimientos] = await Promise.all([
    consultaProductos,
    supabase
      .from("movimientos_inventario")
      .select("id, id_producto, tipo, cantidad, costo_unitario, proveedor, vencimiento, detalle, fecha, activo")
      .order("fecha", { ascending: false })
      .limit(100),
  ]);

  if (respuestaProductos.error || respuestaMovimientos.error) {
    const error = respuestaProductos.error || respuestaMovimientos.error;
    console.error("No se pudo cargar el inventario:", error);
    if (error.code === "PGRST205" || error.code === "42P01") {
      showToast("Falta ejecutar el SQL del módulo de inventarios en Supabase.");
    } else {
      showToast("No se pudo cargar el inventario. Revisa los permisos de Supabase.");
    }
    return;
  }

  const todosLosProductos = respuestaProductos.data || [];
  const productos = categoria
    ? todosLosProductos.filter((producto) => producto.categoria === categoria)
    : todosLosProductos;
  const movimientos = respuestaMovimientos.data || [];
  const idsProductos = [...new Set(movimientos.map((movimiento) => movimiento.id_producto))];
  let referenciasProductos = todosLosProductos;
  if (idsProductos.length) {
    const { data, error } = await supabase
      .from("productos")
      .select("id, nombre, unidad")
      .in("id", idsProductos);
    if (!error) referenciasProductos = [...productos, ...(data || [])];
  }
  const nombresProductos = new Map(referenciasProductos.map((producto) => [producto.id, producto]));

  const stockBajo = todosLosProductos.filter((producto) => Number(producto.stock) <= Number(producto.stock_minimo)).length;
  const valorTotal = todosLosProductos.reduce(
    (total, producto) => total + Number(producto.stock) * Number(producto.costo_promedio),
    0,
  );
  const limiteVencimiento = new Date();
  limiteVencimiento.setDate(limiteVencimiento.getDate() + 30);
  const stockPorId = new Map(todosLosProductos.map((producto) => [producto.id, Number(producto.stock)]));
  const vencimientos = new Set(movimientos
    .filter((movimiento) => movimiento.activo && movimiento.tipo === "Entrada" && movimiento.vencimiento)
    .filter((movimiento) => (stockPorId.get(movimiento.id_producto) || 0) > 0)
    .filter((movimiento) => {
      const fecha = new Date(`${movimiento.vencimiento}T00:00:00`);
      return fecha >= new Date(`${fechaLocalActual()}T00:00:00`) && fecha <= limiteVencimiento;
    })
    .map((movimiento) => movimiento.id_producto));

  updateKpi("kpi-productos", todosLosProductos.length);
  updateKpi("kpi-stock-bajo", stockBajo);
  updateKpi("kpi-por-vencer", vencimientos.size);
  updateKpi("kpi-valor-inv", new Intl.NumberFormat("es-CO", {
    style: "currency", currency: "COP", maximumFractionDigits: 0,
  }).format(valorTotal));

  const vencimientoPorProducto = new Map();
  movimientos.forEach((movimiento) => {
    if (!movimiento.activo || movimiento.tipo !== "Entrada" || !movimiento.vencimiento) return;
    const anterior = vencimientoPorProducto.get(movimiento.id_producto);
    if (!anterior || movimiento.vencimiento < anterior) {
      vencimientoPorProducto.set(movimiento.id_producto, movimiento.vencimiento);
    }
  });

  renderTable("stockTable", productos, (producto) => {
    const stock = Number(producto.stock);
    const minimo = Number(producto.stock_minimo);
    const costo = Number(producto.costo_promedio);
    const estado = stock <= minimo ? "Stock bajo" : "Disponible";
    return `
      <tr>
        <td>${escapeHtml(producto.nombre)}</td>
        <td>${escapeHtml(producto.categoria)}</td>
        <td>${stock.toLocaleString("es-CO")} ${escapeHtml(producto.unidad)}</td>
        <td>${minimo.toLocaleString("es-CO")} ${escapeHtml(producto.unidad)}</td>
        <td>${formatDate(vencimientoPorProducto.get(producto.id))}</td>
        <td>${new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(stock * costo)}</td>
        <td><span class="status ${stock <= minimo ? "warn" : "ok"}">${estado}</span></td>
        <td><button class="btn btn-soft btn-sm" onclick="editarProducto('${producto.id}')">Editar</button> <button class="btn btn-soft btn-sm" onclick="archivarProducto('${producto.id}')">Archivar</button></td>
      </tr>
    `;
  });

  renderTable("movimientosTable", movimientos, (movimiento) => {
    const producto = nombresProductos.get(movimiento.id_producto);
    return `
      <tr>
        <td>${formatDate(movimiento.fecha)}</td>
        <td>${escapeHtml(producto?.nombre || "Producto archivado")}</td>
        <td><span class="status ${movimiento.activo ? (movimiento.tipo === "Entrada" ? "ok" : "info") : "warn"}">${movimiento.activo ? movimiento.tipo : "Anulado"}</span></td>
        <td>${Number(movimiento.cantidad).toLocaleString("es-CO")} ${escapeHtml(producto?.unidad || "")}</td>
        <td>${new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(movimiento.costo_unitario))}</td>
        <td>${escapeHtml(movimiento.proveedor || "—")}</td>
        <td>${formatDate(movimiento.vencimiento)}</td>
        <td>${escapeHtml(movimiento.detalle || "—")}</td>
        <td>${movimiento.activo ? `<button class="btn btn-soft btn-sm" onclick="anularMovimientoInventario('${movimiento.id}')">Anular</button>` : "—"}</td>
      </tr>
    `;
  });
}

async function cargarProductosEnSelector(selectId) {
  const selector = document.getElementById(selectId);
  if (!selector) return;
  selector.replaceChildren(new Option("Cargando productos...", ""));
  const { data, error } = await supabase
    .from("productos")
    .select("id, nombre, unidad, stock")
    .eq("activo", true)
    .order("nombre", { ascending: true });
  if (error) {
    console.error("No se pudieron cargar los productos:", error);
    selector.replaceChildren(new Option("No se pudo cargar el catálogo", ""));
    return;
  }
  selector.replaceChildren(new Option(selectId === "labor-producto" ? "Sin descuento de inventario" : data?.length ? "Selecciona un producto" : "Agrega primero un producto", ""));
  (data || []).forEach((producto) => {
    const opcion = new Option(`${producto.nombre} · ${Number(producto.stock).toLocaleString("es-CO")} ${producto.unidad} disponibles`, producto.id);
    opcion.dataset.unidad = producto.unidad;
    opcion.dataset.nombre = producto.nombre;
    selector.add(opcion);
  });
}

function actualizarUnidadProductoLabor() {
  const selector = document.getElementById("labor-producto");
  const opcion = selector?.selectedOptions[0];
  const hayProducto = Boolean(selector?.value);
  const unidad = document.getElementById("labor-unidad");
  const descripcion = document.getElementById("labor-insumo");
  if (hayProducto && opcion?.dataset.unidad) unidad.value = opcion.dataset.unidad;
  unidad.disabled = hayProducto;
  descripcion.disabled = hayProducto;
  if (hayProducto) descripcion.value = "";
}

async function asegurarProductoEnSelector(selectId, idProducto) {
  const selector = document.getElementById(selectId);
  if (!selector || Array.from(selector.options).some((option) => option.value === idProducto)) return;
  const { data: producto, error } = await supabase
    .from("productos")
    .select("id, nombre, unidad, stock")
    .eq("id", idProducto)
    .maybeSingle();
  if (error || !producto) return;
  const opcion = new Option(`${producto.nombre} · ${Number(producto.stock).toLocaleString("es-CO")} ${producto.unidad} (archivado)`, producto.id);
  opcion.dataset.unidad = producto.unidad;
  opcion.dataset.nombre = producto.nombre;
  selector.add(opcion);
}

async function guardarProducto() {
  const nombre = document.getElementById("producto-nombre").value.trim();
  const categoria = document.getElementById("producto-categoria").value;
  const unidad = document.getElementById("producto-unidad").value;
  const stockMinimo = Number(document.getElementById("producto-stock-minimo").value || 0);
  if (!nombre || !Number.isFinite(stockMinimo) || stockMinimo < 0) {
    showToast("Escribe el nombre y un mínimo de stock válido.");
    return;
  }

  const editando = registroEnEdicion?.tipo === "producto";
  const respuesta = editando
    ? await supabase.from("productos").update({ nombre, categoria, unidad, stock_minimo: stockMinimo }).eq("id", registroEnEdicion.id)
    : await supabase.from("productos").insert({ nombre, categoria, unidad, stock_minimo: stockMinimo });
  if (respuesta.error) {
    console.error("No se pudo guardar el producto:", respuesta.error);
    showToast("No se pudo guardar el producto. Revisa el SQL y los permisos.");
    return;
  }
  closeModals();
  showToast(editando ? "Producto actualizado." : "Producto agregado al inventario.");
  await cargarInventario();
}

async function editarProducto(id) {
  const { data: producto, error } = await supabase
    .from("productos")
    .select("id, nombre, categoria, unidad, stock_minimo")
    .eq("id", id)
    .single();
  if (error || !producto) {
    console.error("No se pudo cargar el producto para editar:", error);
    showToast("No se pudo abrir el producto para editar.");
    return;
  }
  openModal("modalProducto");
  document.getElementById("producto-nombre").value = producto.nombre;
  document.getElementById("producto-categoria").value = producto.categoria;
  document.getElementById("producto-unidad").value = producto.unidad;
  document.getElementById("producto-stock-minimo").value = producto.stock_minimo;
  registroEnEdicion = { tipo: "producto", id };
  actualizarRotulosEdicion("producto");
}

async function archivarProducto(id) {
  if (!window.confirm("¿Archivar este producto? Solo se puede archivar cuando su stock sea cero.")) return;
  const { data, error } = await supabase
    .from("productos")
    .update({ activo: false })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    console.error("No se pudo archivar el producto:", error);
    showToast("No se pudo archivar: verifica que el stock sea cero.");
    return;
  }
  showToast("Producto archivado; el historial de movimientos se conserva.");
  await cargarInventario();
}

async function guardarMovimientoInventario() {
  const idProducto = document.getElementById("mov-producto").value;
  const tipo = document.getElementById("mov-tipo").value;
  const cantidad = Number(document.getElementById("mov-cantidad").value);
  const costo = Number(document.getElementById("mov-precio").value || 0);
  const proveedor = document.getElementById("mov-proveedor").value.trim();
  const vencimiento = document.getElementById("mov-vencimiento").value || null;
  if (!idProducto || !Number.isFinite(cantidad) || cantidad <= 0 || !Number.isFinite(costo) || costo < 0) {
    showToast("Selecciona un producto e ingresa cantidad y costo válidos.");
    return;
  }
  if (tipo === "Entrada" && costo <= 0) {
    showToast("Indica el costo unitario de la entrada.");
    return;
  }
  const { error } = await supabase.rpc("registrar_movimiento_inventario", {
    p_id_producto: idProducto,
    p_tipo: tipo,
    p_cantidad: cantidad,
    p_costo_unitario: costo,
    p_proveedor: proveedor || null,
    p_vencimiento: vencimiento,
    p_detalle: null,
  });
  if (error) {
    console.error("No se pudo registrar el movimiento de inventario:", error);
    showToast(error.code === "PGRST202" ? "Ejecuta el SQL del inventario y vuelve a intentarlo." : error.message || "No se pudo registrar el movimiento.");
    return;
  }
  closeModals();
  showToast(tipo === "Entrada" ? "Entrada registrada y stock actualizado." : "Salida registrada y stock actualizado.");
  await cargarInventario();
}

async function anularMovimientoInventario(id) {
  if (!window.confirm("¿Anular este movimiento? El stock se ajustará y el registro quedará en el historial.")) return;
  const { error } = await supabase.rpc("anular_movimiento_inventario", { p_id_movimiento: id });
  if (error) {
    console.error("No se pudo anular el movimiento:", error);
    showToast(error.message || "No se pudo anular el movimiento.");
    return;
  }
  showToast("Movimiento anulado y stock recalculado.");
  await cargarInventario();
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-CO");
}

function fechaLocalActual() {
  const fecha = new Date();
  fecha.setMinutes(fecha.getMinutes() - fecha.getTimezoneOffset());
  return fecha.toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

/* ============================================================
   6. MÓDULO DE NOTIFICACIONES (Toast)
   ============================================================ */

let toastTimer;

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3000);
}

/**
 * updateBadgeNotif(count)
 * Actualiza el contador del badge de notificaciones en el topbar.
 * EN PRODUCCIÓN: llamar con el total de alertas no leídas del usuario.
 *
 * @param {number} count
 */
function updateBadgeNotif(count) {
  const badge = document.getElementById("badge-notif");
  if (!badge) return;
  badge.textContent = count;
  badge.style.display = count === 0 ? "none" : "";
}

/* ============================================================
   7. MÓDULO DE FORMULARIOS
   ============================================================ */

/**
 * calculateHarvest()
 * Calcula la fecha estimada de cosecha sumando el ciclo
 * en días a la fecha actual y la escribe en #harvest.
 */
function calculateHarvest() {
  const fechaSiembra = document.getElementById("cultivo-siembra")?.value;
  const cicloValue = document.getElementById("cycle")?.value;
  const el = document.getElementById("harvest");
  if (!cicloValue) {
    if (el) el.value = "";
    return;
  }
  const today = fechaSiembra
    ? new Date(`${fechaSiembra}T00:00:00`)
    : new Date();
  const days = Number(cicloValue);
  if (!Number.isFinite(today.getTime()) || !Number.isFinite(days) || days <= 0) {
    if (el) el.value = "";
    return;
  }
  today.setDate(today.getDate() + days);
  if (el) el.value = today.toISOString().slice(0, 10);
}

/**
 * validateArea(el)
 * Evita valores negativos en campos de área.
 */
function validateArea(el) {
  if (Number(el.value) < 0) el.value = 0;
}

/**
 * loadLotesEnSelect(selectId)
 * Carga los lotes activos del usuario en el selector agrícola.
 *
 * @param {string} selectId — ID del elemento <select>
 */
async function loadLotesEnSelect(selectId) {
  const sel = document.getElementById(selectId);
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
    sel.add(new Option(`${lote.nombre} · ${lote.area} ha`, lote.id));
  });
}

async function editarCosecha(id) {
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
  document.getElementById("cosecha-lote").value = cosecha.id_lote;
  await cargarCultivosDelLote("cosecha", true);
  document.getElementById("cosecha-cultivo").value = cosecha.id_cultivo;
  document.getElementById("cosecha-cantidad").value = cosecha.cantidad;
  document.getElementById("cosecha-unidad").value = cosecha.unidad;
  document.getElementById("cosecha-calidad").value = cosecha.calidad;
  document.getElementById("cosecha-fecha").value = cosecha.fecha;
  document.getElementById("cosecha-destino").value = cosecha.destino || "";
  document.getElementById("cosecha-tipo").value = String(cosecha.es_final);
  document.getElementById("cosecha-lote").disabled = true;
  document.getElementById("cosecha-cultivo").disabled = true;
  document.getElementById("cosecha-tipo").disabled = true;
  registroEnEdicion = { tipo: "cosecha", id };
  actualizarRotulosEdicion("cosecha");
}

async function cargarCultivosDelLote(prefijo, incluirInactivos = false) {
  if (prefijo !== "labor" && prefijo !== "cosecha") return;
  const idLote = document.getElementById(`${prefijo}-lote`).value;
  const selector = document.getElementById(`${prefijo}-cultivo`);
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

async function asegurarLoteEnSelector(selectId, idLote) {
  const selector = document.getElementById(selectId);
  if (!selector || Array.from(selector.options).some((option) => option.value === idLote)) return;
  const { data: lote, error } = await supabase
    .from("lotes")
    .select("id, nombre, area")
    .eq("id", idLote)
    .maybeSingle();
  if (error || !lote) return;
  selector.add(new Option(`${lote.nombre} · ${lote.area} ha (archivado)`, lote.id));
}

/* ============================================================
   8. MÓDULO DE TABLAS
   ============================================================ */

/**
 * filterTable(id, q)
 * Filtra filas de una tabla por texto.
 */
function filterTable(id, q) {
  q = q.toLowerCase();
  document.querySelectorAll("#" + id + " tbody tr").forEach((row) => {
    row.style.display = row.innerText.toLowerCase().includes(q) ? "" : "none";
  });
}

/**
 * renderTable(tbodyId, rows, buildRowFn)
 * Inserta filas reales en el tbody de una tabla.
 * Úsalo desde Supabase cuando lleguen los datos.
 *
 * @param {string}   tbodyId    — ID del elemento <tbody>
 * @param {Array}    rows       — array de objetos de Supabase
 * @param {Function} buildRowFn — función que recibe un objeto y retorna string HTML de <tr>
 *
 * EJEMPLO (fincas):
 *   const { data } = await supabase.from('fincas').select('*')
 *   renderTable('farmTable', data, finca => `
 *     <tr>
 *       <td>${finca.nombre}</td>
 *       <td>${finca.municipio}, ${finca.departamento}</td>
 *       <td>${finca.area_total} ha</td>
 *       <td>${finca.tipo_suelo}</td>
 *       <td>—</td>
 *       <td><span class="status ok">Activa</span></td>
 *       <td><button class="btn btn-soft btn-sm" onclick="editarFinca(${finca.id})">Editar</button></td>
 *     </tr>
 *   `)
 */
function renderTable(tbodyId, rows, buildRowFn) {
  const tbody = document.querySelector(`#${tbodyId} tbody`);
  if (!tbody) return;

  if (!rows || rows.length === 0) {
    const cols = tbody.closest("table").querySelectorAll("th").length;
    tbody.innerHTML = `<tr><td colspan="${cols}" class="empty">Sin registros aún.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(buildRowFn).join("");
}

/**
 * updateKpi(elementId, value)
 * Actualiza el número de una tarjeta KPI desde Supabase.
 *
 * EJEMPLO:
 *   const { count } = await supabase.from('cultivos').select('*', { count: 'exact', head: true }).eq('estado', 'Activo')
 *   updateKpi('kpi-cultivos', count)
 *
 * @param {string} elementId — ID del <h3> dentro de la KPI card
 * @param {string|number} value
 */
function updateKpi(elementId, value) {
  const el = document.getElementById(elementId);
  if (el) el.textContent = value;
}

/* ============================================================
   9. MÓDULO DE GRÁFICAS (Chart.js)
   Las funciones ya no tienen datos hardcodeados.
   Se inicializan con arrays vacíos; llama a updateProductionChart()
   o updateFinanceChart() con datos reales de Supabase.
   ============================================================ */

/**
 * initProductionChart()
 * Crea la gráfica de líneas del dashboard con datos vacíos.
 * EN PRODUCCIÓN: después de initProductionChart(),
 * consulta Supabase y llama a updateProductionChart(labels, dataset1, dataset2).
 */
function initProductionChart() {
  const canvas = document.getElementById("productionChart");
  if (!canvas || charts.prod) return;

  charts.prod = new Chart(canvas, {
    type: "line",
    data: {
      labels: [], // meses — se llenarán con datos de Supabase
      datasets: [
        {
          label: "Producción (t)",
          data: [], // datos reales desde tabla cosechas/producciones
          tension: 0.35,
          borderWidth: 3,
        },
        {
          label: "Ingresos (M COP)",
          data: [], // datos reales desde tabla ingresos
          tension: 0.35,
          borderWidth: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
      scales: {
        y: { beginAtZero: true, grid: { color: "#edf1e9" } },
        x: { grid: { display: false } },
      },
    },
  });
}

/**
 * updateProductionChart(labels, produccion, ingresos)
 * Actualiza la gráfica de producción con datos reales.
 *
 * EJEMPLO (Supabase):
 *   // Agrupar cosechas y ingresos por mes en Supabase y llamar:
 *   updateProductionChart(
 *     ['Ago', 'Sep', 'Oct'],
 *     [12.5, 18.0, 22.3],
 *     [8.1, 14.2, 19.0]
 *   )
 *
 * @param {string[]} labels     — meses del eje X
 * @param {number[]} produccion — toneladas por mes
 * @param {number[]} ingresos   — millones COP por mes
 */
function updateProductionChart(labels, produccion, ingresos) {
  if (!charts.prod) return;
  charts.prod.data.labels = labels;
  charts.prod.data.datasets[0].data = produccion;
  charts.prod.data.datasets[1].data = ingresos;
  charts.prod.update();
}

// Alias: updateChart() se usaba desde el select del dashboard
function updateChart() {
  // EN PRODUCCIÓN: leer el valor del select, consultar Supabase
  // con el rango correcto (6 o 12 meses) y llamar a updateProductionChart()
  showToast("Conecta Supabase para cargar datos históricos reales.");
}

/**
 * initFinanceChart()
 * Crea la gráfica de barras del módulo financiero con datos vacíos.
 */
function initFinanceChart() {
  const canvas = document.getElementById("financeChart");
  if (!canvas || charts.fin) return;

  charts.fin = new Chart(canvas, {
    type: "bar",
    data: {
      labels: [], // meses — desde Supabase
      datasets: [
        {
          label: "Ingresos",
          data: [], // desde tabla ingresos agrupados por mes
          borderRadius: 7,
        },
        {
          label: "Egresos",
          data: [], // desde tabla gastos agrupados por mes
          borderRadius: 7,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
      scales: {
        y: { beginAtZero: true, grid: { color: "#edf1e9" } },
        x: { grid: { display: false } },
      },
    },
  });
}

/**
 * updateFinanceChart(labels, ingresos, egresos)
 * Actualiza la gráfica financiera con datos reales de Supabase.
 *
 * EJEMPLO:
 *   updateFinanceChart(['Ago','Sep','Oct'], [14.2, 19.0, 24.1], [10.1, 14.5, 17.3])
 *
 * @param {string[]} labels   — meses
 * @param {number[]} ingresos — millones COP
 * @param {number[]} egresos  — millones COP
 */
function updateFinanceChart(labels, ingresos, egresos) {
  if (!charts.fin) return;
  charts.fin.data.labels = labels;
  charts.fin.data.datasets[0].data = ingresos;
  charts.fin.data.datasets[1].data = egresos;
  charts.fin.update();
}

/* ============================================================
   10. INICIALIZACIÓN
   ============================================================ */

async function cargarDashboard() {
  // KPI: Cultivos activos
  const { count: cultivos, error: errorCultivos } = await supabase
    .from("cultivos")
    .select("*", { count: "exact", head: true })
    .eq("activo", true)
    .in("estado", ["Planificado", "En desarrollo"]);
  if (errorCultivos) {
    console.error("No se pudieron cargar los cultivos:", errorCultivos);
  } else {
    updateKpi("kpi-cultivos", cultivos ?? 0);
  }

  // KPI: Animales activos
  const { count: animales, error: errorAnimales } = await supabase
    .from("animales")
    .select("*", { count: "exact", head: true })
    .eq("activo", true)
    .eq("estado", "Activo");
  if (errorAnimales) {
    console.error("No se pudieron cargar los animales:", errorAnimales);
  } else {
    updateKpi("kpi-animales", animales ?? 0);
  }

  const { data: productos, error: errorProductos } = await supabase
    .from("productos")
    .select("stock, costo_promedio")
    .eq("activo", true);
  if (errorProductos) {
    console.error("No se pudo cargar el valor del inventario:", errorProductos);
  } else {
    const valorInventario = (productos || []).reduce(
      (total, producto) => total + Number(producto.stock) * Number(producto.costo_promedio),
      0,
    );
    updateKpi("kpi-inventario", new Intl.NumberFormat("es-CO", {
      style: "currency", currency: "COP", maximumFractionDigits: 0,
    }).format(valorInventario));
  }

  // Alertas no leídas
  const { data: alertas, error: errorAlertas } = await supabase
    .from("alertas")
    .select("*")
    .eq("leida", false)
    .order("fecha_creacion", { ascending: false })
    .limit(5);

  if (errorAlertas) {
    console.error("No se pudieron cargar las alertas:", errorAlertas);
  } else {
    updateBadgeNotif(alertas?.length ?? 0);
  }
}

window.addEventListener("load", async () => {
  checkGoogleRedirect();
  initProductionChart();
  updateBadgeNotif(0);

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    const { data: perfil, error: perfilError } = await supabase
      .from("usuarios")
      .select("nombre, rol")
      .eq("id", session.user.id)
      .single();

    if (perfilError) {
      console.error("No se pudo cargar el perfil de usuarios:", perfilError);
    }

    document.getElementById("login").classList.add("hidden");
    setTopbarUser(
      perfil || {
        nombre:
          session.user.user_metadata?.nombre ||
          session.user.email?.split("@")[0] ||
          "Usuario",
        rol: "Usuario",
      },
    );
    cargarDashboard();
  }
});

window.login = login;
window.logout = logout;
window.showPage = showPage;
window.openModal = openModal;
window.cambiarTema = cambiarTema;
window.closeModals = closeModals;
window.saveForm = saveForm;
window.saveFinca = saveFinca;
window.editarFinca = editarFinca;
window.saveCultivo = saveCultivo;
window.editarCultivo = editarCultivo;
window.guardarLabor = guardarLabor;
window.actualizarUnidadProductoLabor = actualizarUnidadProductoLabor;
window.editarLabor = editarLabor;
window.guardarCosecha = guardarCosecha;
window.editarCosecha = editarCosecha;
window.guardarTipoCultivo = guardarTipoCultivo;
window.editarTipoCultivo = editarTipoCultivo;
window.seleccionarCultivoCatalogo = seleccionarCultivoCatalogo;
window.cargarCultivosDelLote = cargarCultivosDelLote;
window.archivarTipoCultivo = archivarTipoCultivo;
window.archivarFinca = archivarFinca;
window.archivarCultivo = archivarCultivo;
window.cargarRazasAnimal = cargarRazasAnimal;
window.actualizarDetalleRazaAnimal = actualizarDetalleRazaAnimal;
window.guardarAnimal = guardarAnimal;
window.editarAnimal = editarAnimal;
window.archivarAnimal = archivarAnimal;
window.exportarAnimalesCSV = exportarAnimalesCSV;
window.guardarEventoSanitario = guardarEventoSanitario;
window.editarEventoSanitario = editarEventoSanitario;
window.archivarEventoSanitario = archivarEventoSanitario;
window.guardarPesaje = guardarPesaje;
window.editarPesaje = editarPesaje;
window.archivarPesaje = archivarPesaje;
window.guardarProduccionAnimal = guardarProduccionAnimal;
window.editarProduccionAnimal = editarProduccionAnimal;
window.archivarProduccionAnimal = archivarProduccionAnimal;
window.anularLabor = anularLabor;
window.anularCosecha = anularCosecha;
window.cargarInventario = cargarInventario;
window.guardarProducto = guardarProducto;
window.editarProducto = editarProducto;
window.archivarProducto = archivarProducto;
window.guardarMovimientoInventario = guardarMovimientoInventario;
window.anularMovimientoInventario = anularMovimientoInventario;
window.renderLoteFields = renderLoteFields;
window.toggleSidebar = toggleSidebar;
window.showRegister = showRegister;
window.showLoginScreen = showLoginScreen;
window.register = register;
window.signInWithGoogle = signInWithGoogle;
window.recoverPassword = recoverPassword;
window.filterTable = filterTable;
window.validateArea = validateArea;
window.updateChart = updateChart;
window.calculateHarvest = calculateHarvest;
