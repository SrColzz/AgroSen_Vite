let logged = false,
  charts = {};
function login() {
  document.getElementById("login").classList.add("hidden");
  logged = true;
  showToast("Sesión iniciada como Administrador");
}
function logout() {
  document.getElementById("login").classList.remove("hidden");
  showToast("Sesión cerrada");
}
function recoverPassword() {
  showToast("Se enviaría un enlace de recuperación por correo (RF-003)");
}
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
  login();
  initProductionChart();
});
