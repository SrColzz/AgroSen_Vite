import { getAppPreferences } from "./preferences";

const doc = document;
let toastTimer: ReturnType<typeof setTimeout>;

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-CO");
}

export function fechaLocalActual(): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: getAppPreferences().zona_horaria || "America/Bogota",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const valor = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value || "00";
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] || character);
}

export function showToast(message: string): void {
  const toast = doc.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
}

export function updateBadgeNotif(count: number): void {
  const badge = doc.getElementById("badge-notif");
  if (!badge) return;
  badge.textContent = String(count);
  badge.style.display = count === 0 ? "none" : "";
}

export function calculateHarvest(): void {
  const fechaSiembra = (doc.getElementById("cultivo-siembra") as HTMLInputElement | null)?.value;
  const cicloValue = (doc.getElementById("cycle") as HTMLInputElement | null)?.value;
  const harvest = doc.getElementById("harvest") as HTMLInputElement | null;
  if (!cicloValue) {
    if (harvest) harvest.value = "";
    return;
  }
  const fecha = fechaSiembra ? new Date(`${fechaSiembra}T00:00:00`) : new Date();
  const dias = Number(cicloValue);
  if (!Number.isFinite(fecha.getTime()) || !Number.isFinite(dias) || dias <= 0) {
    if (harvest) harvest.value = "";
    return;
  }
  fecha.setDate(fecha.getDate() + dias);
  if (harvest) harvest.value = fecha.toISOString().slice(0, 10);
}

export function validateArea(input: HTMLInputElement): void {
  if (Number(input.value) < 0) input.value = "0";
}

export function filterTable(id: string, query: string): void {
  const normalizedQuery = query.toLowerCase();
  doc.querySelectorAll<HTMLElement>(`#${id} tbody tr`).forEach((row) => {
    row.style.display = row.innerText.toLowerCase().includes(normalizedQuery) ? "" : "none";
  });
}

export function renderTable<T>(tbodyId: string, rows: T[] | null | undefined, buildRow: (row: T) => string): void {
  const tbody = doc.querySelector<HTMLTableSectionElement>(`#${tbodyId} tbody`);
  if (!tbody) return;
  if (!rows?.length) {
    const columns = tbody.closest("table")?.querySelectorAll("th").length || 1;
    tbody.innerHTML = `<tr><td colspan="${columns}" class="empty">Sin registros aún.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(buildRow).join("");
}

export function updateKpi(elementId: string, value: string | number | null | undefined): void {
  const element = doc.getElementById(elementId);
  if (element) element.textContent = String(value ?? "—");
}
