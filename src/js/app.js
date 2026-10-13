/* ============================================================
   AgroNext — app.js  (versión limpia, lista para Supabase)
   ─────────────────────────────────────────────────────────────
   TODOS los datos hardcodeados fueron eliminados.
   Las funciones de gráficas ahora reciben datos reales
   como parámetro; mientras no haya conexión muestran
   un estado vacío.
   ============================================================ */

/* ============================================================
   1. ESTADO GLOBAL
   ============================================================ */

let charts = {}; // instancias de Chart.js (evita duplicados)

/* ============================================================
   2. MÓDULO DE AUTENTICACIÓN
   ============================================================ */

function login() {
  document.getElementById("login").classList.add("hidden");
  showToast("Sesión iniciada");
}

function logout() {
  document.getElementById("register").classList.add("hidden");
  document.getElementById("login").classList.remove("hidden");

  // Limpiar datos del topbar al cerrar sesión
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

function register() {
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

  // EN PRODUCCIÓN:
  // const { error } = await supabase.auth.signUp({ email, password: pass })
  // Luego insertar en tabla "usuarios" el nombre y rol
  showToast("Registro listo para conectar con Supabase.");
  showLoginScreen();
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
}

document
  .querySelectorAll(".nav-item[data-page]")
  .forEach((b) => b.addEventListener("click", () => showPage(b.dataset.page)));

/* ============================================================
   5. MÓDULO DE MODALES
   ============================================================ */

function openModal(id) {
  closeModals();
  document.getElementById(id).classList.add("show");
  if (id === "modalCultivo") {
    calculateHarvest();
    // EN PRODUCCIÓN: cargar lotes reales del usuario desde Supabase
    // loadLotesEnSelect('selectLoteCultivo')
  }
}

function closeModals() {
  document
    .querySelectorAll(".modal")
    .forEach((m) => m.classList.remove("show"));
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
  const today = new Date();
  const days = Number(document.getElementById("cycle")?.value || 120);
  today.setDate(today.getDate() + days);
  const el = document.getElementById("harvest");
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
 * Carga los lotes reales desde Supabase y los inyecta en un <select>.
 * EN PRODUCCIÓN (Supabase):
 *   const { data, error } = await supabase
 *     .from('lotes').select('id, nombre').eq('disponible', true)
 *   const sel = document.getElementById(selectId)
 *   sel.innerHTML = '<option value="">Selecciona un lote</option>'
 *   data.forEach(l => {
 *     const opt = document.createElement('option')
 *     opt.value = l.id
 *     opt.textContent = l.nombre
 *     sel.appendChild(opt)
 *   })
 *
 * @param {string} selectId — ID del elemento <select>
 */
function loadLotesEnSelect(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = '<option value="">Cargando lotes...</option>';
  // TODO: reemplazar con llamada real a Supabase (ver docstring arriba)
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

window.addEventListener("load", () => {
  checkGoogleRedirect(); // detectar retorno de Google OAuth
  initProductionChart(); // crear gráfica vacía del dashboard
  updateBadgeNotif(0); // badge en 0 hasta que carguen alertas reales

  // ── CUANDO TENGAS SUPABASE CONECTADO, AGREGA AQUÍ: ──────────
  //
  // 1. Obtener sesión activa:
  //    const { data: { session } } = await supabase.auth.getSession()
  //    if (session) {
  //      document.getElementById('login').classList.add('hidden')
  //      // cargar perfil del usuario:
  //      const { data: perfil } = await supabase
  //        .from('usuarios').select('nombre,rol').eq('id', session.user.id).single()
  //      setTopbarUser(perfil)
  //    }
  //
  // 2. Cargar KPIs del dashboard:
  //    const { count: cultivos } = await supabase.from('cultivos')
  //      .select('*', { count: 'exact', head: true }).eq('estado', 'Activo')
  //    updateKpi('kpi-cultivos', cultivos)
  //    ... igual para animales, inventario y balance
  //
  // 3. Cargar alertas recientes:
  //    const { data: alertas } = await supabase.from('alertas')
  //      .select('*').eq('leida', false).order('fecha_creacion', { ascending: false }).limit(5)
  //    renderAlertas(alertas)
  //    updateBadgeNotif(alertas.length)
  //
  // ────────────────────────────────────────────────────────────
});
