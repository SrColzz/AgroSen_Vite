let logged = false,
  charts = {};
function login() {
  document.getElementById("login").classList.add("hidden");
  logged = true;
  showToast("Sesión iniciada como Administrador");
}
function logout() {
  document.getElementById("register").classList.add("hidden");
  document.getElementById("login").classList.remove("hidden");
  showToast("Sesión cerrada");
}
function recoverPassword() {
  showToast("Se enviaría un enlace de recuperación por correo (RF-003)");
}

/* ---------- Registro y navegación entre pantallas ---------- */
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
  showToast("Cuenta creada (prototipo). El registro real requiere backend.");
  showLoginScreen();
}

/* ---------- Inicio de sesión con Google (OAuth 2.0, sin SDK) ---------- */
// 1) Crea un Client ID OAuth 2.0 en Google Cloud Console y pégalo aquí.
const GOOGLE_CLIENT_ID = "TU_CLIENT_ID.apps.googleusercontent.com";
// A dónde debe volver Google después de iniciar sesión (esta misma página).
const GOOGLE_REDIRECT_URI = window.location.origin + window.location.pathname;

function signInWithGoogle() {
  if (GOOGLE_CLIENT_ID.startsWith("TU_CLIENT_ID")) {
    showToast(
      "Falta configurar tu GOOGLE_CLIENT_ID en app.js para activar el inicio de sesión con Google",
    );
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

// Al volver de Google, la URL trae el token en el fragmento (#access_token=...)
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
      logged = true;
      showToast("Bienvenido/a, " + (profile.name || profile.email));
      history.replaceState(null, "", window.location.pathname);
    })
    .catch(() => showToast("No se pudo obtener el perfil de Google"));
}
window.addEventListener("load", checkGoogleRedirect);
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
  if (innerWidth < 760)
    document.getElementById("sidebar").classList.remove("open");
  if (name === "financiero") setTimeout(initFinanceChart, 50);
  if (name === "dashboard") setTimeout(initProductionChart, 50);
}
document
  .querySelectorAll(".nav-item[data-page]")
  .forEach((b) => b.addEventListener("click", () => showPage(b.dataset.page)));
function openModal(id) {
  closeModals();
  document.getElementById(id).classList.add("show");
  if (id === "modalCultivo") calculateHarvest();
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
function saveForm(msg) {
  closeModals();
  showToast("✓ " + msg);
}
let toastTimer;
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3000);
}
function calculateHarvest() {
  const d = new Date();
  const days = Number(document.getElementById("cycle")?.value || 120);
  d.setDate(d.getDate() + days);
  const el = document.getElementById("harvest");
  if (el) el.value = d.toISOString().slice(0, 10);
}
function validateArea(el) {
  if (Number(el.value) < 0) el.value = 0;
}
function filterTable(id, q) {
  q = q.toLowerCase();
  document
    .querySelectorAll("#" + id + " tbody tr")
    .forEach(
      (r) =>
        (r.style.display = r.innerText.toLowerCase().includes(q) ? "" : "none"),
    );
}
function initProductionChart() {
  const c = document.getElementById("productionChart");
  if (!c || charts.prod) return;
  charts.prod = new Chart(c, {
    type: "line",
    data: {
      labels: ["Abr", "May", "Jun", "Jul", "Ago", "Sep"],
      datasets: [
        {
          label: "Producción (t)",
          data: [18, 22, 20, 27, 31, 35],
          tension: 0.35,
          borderWidth: 3,
        },
        {
          label: "Ingresos (M COP)",
          data: [12, 14, 13, 17, 19, 24],
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
function updateChart() {
  if (charts.prod) {
    charts.prod.data.labels = [
      "Oct",
      "Nov",
      "Dic",
      "Ene",
      "Feb",
      "Mar",
      "Abr",
      "May",
      "Jun",
      "Jul",
      "Ago",
      "Sep",
    ];
    charts.prod.data.datasets[0].data = [
      16, 19, 21, 18, 23, 25, 18, 22, 20, 27, 31, 35,
    ];
    charts.prod.update();
  }
}
function initFinanceChart() {
  const c = document.getElementById("financeChart");
  if (!c || charts.fin) return;
  charts.fin = new Chart(c, {
    type: "bar",
    data: {
      labels: ["Abr", "May", "Jun", "Jul", "Ago", "Sep"],
      datasets: [
        { label: "Ingresos", data: [12, 14, 13, 17, 19, 24], borderRadius: 7 },
        { label: "Egresos", data: [9, 10, 11, 12, 14, 17], borderRadius: 7 },
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
window.addEventListener("load", () => {
  initProductionChart();
});
