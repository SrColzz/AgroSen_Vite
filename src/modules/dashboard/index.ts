import Chart from "chart.js/auto";
import { supabase } from "../../lib/supabase";
import { escapeHtml, fechaLocalActual, updateBadgeNotif, updateKpi } from "../../shared/dom";
import { formatCurrency, getCurrency } from "../../shared/preferences";

type DashboardCharts = {
  inventory?: Chart;
  crops?: Chart;
  financeTrend?: Chart;
  milk?: Chart;
  fin?: Chart;
};

const charts: DashboardCharts = {};
const documentRef = window.document;

window.addEventListener("agrosen:preferences-updated", () => {
  charts.inventory?.update();
  charts.financeTrend?.update();
  charts.fin?.update();
  void cargarDashboard();
});

function mostrarMensajeGrafica(id: string, mensaje: string): void {
  const elemento = documentRef.getElementById(id);
  if (!elemento) return;
  elemento.textContent = mensaje;
  elemento.hidden = !mensaje;
}

function formatoCOP(valor: number, compacto = false): string {
  const numero = Number.isFinite(valor) ? valor : 0;
  if (!compacto) return formatCurrency(numero);
  const absoluto = Math.abs(numero);
  const divisor = absoluto >= 1_000_000_000 ? 1_000_000_000 : absoluto >= 1_000_000 ? 1_000_000 : absoluto >= 1_000 ? 1_000 : 1;
  const sufijo = divisor === 1_000_000_000 ? " mil M" : divisor === 1_000_000 ? " M" : divisor === 1_000 ? " mil" : "";
  const decimales = divisor > 1 && absoluto / divisor < 10 ? 1 : 0;
  return `${new Intl.NumberFormat("es-CO", { style: "currency", currency: getCurrency(), maximumFractionDigits: decimales }).format(numero / divisor)}${sufijo}`;
}

export function initProductionChart(): void {
  const inventoryCanvas = documentRef.getElementById("dashboardInventoryChart");
  if (charts.inventory && charts.inventory.canvas !== inventoryCanvas) { charts.inventory.destroy(); charts.inventory = undefined; }
  if (inventoryCanvas instanceof HTMLCanvasElement && !charts.inventory) {
    charts.inventory = new Chart(inventoryCanvas, {
      type: "pie",
      data: { labels: [], datasets: [{ data: [], backgroundColor: ["#2f855a", "#d69e2e", "#3182ce", "#dd6b20", "#805ad5"] }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom" },
          tooltip: { callbacks: { label: (context) => `${context.label || "Categoría"}: ${formatoCOP(Number(context.parsed))}` } },
        },
      },
    });
  }

  const cropsCanvas = documentRef.getElementById("dashboardCropsChart");
  if (charts.crops && charts.crops.canvas !== cropsCanvas) { charts.crops.destroy(); charts.crops = undefined; }
  if (cropsCanvas instanceof HTMLCanvasElement && !charts.crops) {
    charts.crops = new Chart(cropsCanvas, {
      type: "bar",
      data: { labels: [], datasets: [{ label: "Cultivos planificados", data: [], backgroundColor: ["#2f855a", "#d69e2e", "#3182ce", "#dd6b20", "#805ad5", "#319795"] }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => `${Number(context.parsed.y).toLocaleString("es-CO", { maximumFractionDigits: 0 })} plan(es) de cultivo` } } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0, stepSize: 1, callback: (value) => Number(value).toLocaleString("es-CO", { maximumFractionDigits: 0 }) } } },
      },
    });
  }

  const financeCanvas = documentRef.getElementById("dashboardFinanceChart");
  if (charts.financeTrend && charts.financeTrend.canvas !== financeCanvas) { charts.financeTrend.destroy(); charts.financeTrend = undefined; }
  if (financeCanvas instanceof HTMLCanvasElement && !charts.financeTrend) {
    charts.financeTrend = new Chart(financeCanvas, {
      type: "line",
      data: { labels: [], datasets: [
        { label: "Ingresos", data: [], borderColor: "#2f855a", backgroundColor: "#2f855a", tension: 0.3 },
        { label: "Egresos", data: [], borderColor: "#dd6b20", backgroundColor: "#dd6b20", tension: 0.3 },
      ] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom" },
          tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${formatoCOP(Number(context.parsed.y))}` } },
        },
        scales: { y: { beginAtZero: true, ticks: { callback: (value) => formatoCOP(Number(value), true) } }, x: { grid: { display: false } } },
      },
    });
  }

  const milkCanvas = documentRef.getElementById("dashboardMilkChart");
  if (charts.milk && charts.milk.canvas !== milkCanvas) { charts.milk.destroy(); charts.milk = undefined; }
  if (milkCanvas instanceof HTMLCanvasElement && !charts.milk) {
    charts.milk = new Chart(milkCanvas, {
      type: "line",
      data: { labels: [], datasets: [{ label: "Litros", data: [], borderColor: "#3182ce", backgroundColor: "rgba(49, 130, 206, 0.22)", fill: true, tension: 0.35 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom" },
          tooltip: { callbacks: { label: (context) => `${Number(context.parsed.y).toLocaleString("es-CO", { maximumFractionDigits: 2 })} L` } },
        },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 1, callback: (value) => `${Number(value).toLocaleString("es-CO", { maximumFractionDigits: 1 })} L` } },
          x: { grid: { display: false } },
        },
      },
    });
  }
  window.requestAnimationFrame(() => {
    charts.inventory?.resize();
    charts.crops?.resize();
    charts.financeTrend?.resize();
    charts.milk?.resize();
    void cargarGraficasDashboard("6");
  });
}

export async function updateChart(chart: "finance" | "milk", period: string | number = "6"): Promise<void> {
  await cargarGraficasDashboard(period, chart);
}

async function cargarGraficasDashboard(period: string | number, target: "all" | "finance" | "milk" = "all"): Promise<void> {
  const mesesSeleccionados = Number(period);
  const meses = mesesSeleccionados === 3 || mesesSeleccionados === 12 ? mesesSeleccionados : 6;
  const ahora = new Date();
  const claves = Array.from({ length: meses }, (_, indice) => {
    const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - meses + 1 + indice, 1);
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
  });
  const inicio = `${claves[0]}-01`;
  const [respuestaProductos, respuestaCultivos, respuestaFinanzas, respuestaLeche] = await Promise.all([
    supabase.from("productos").select("categoria, stock, costo_promedio").eq("activo", true),
    supabase.from("cultivos").select("tipo").eq("activo", true).eq("estado", "Planificado"),
    supabase.from("movimientos_financieros").select("fecha, tipo, monto").eq("activo", true).gte("fecha", inicio),
    supabase.from("producciones_animal").select("fecha, tipo, cantidad, unidad").eq("activo", true).eq("tipo", "Leche").gte("fecha", inicio),
  ]);
  if (respuestaProductos.error) console.error("No se pudo cargar la distribución del inventario:", respuestaProductos.error);
  if (respuestaCultivos.error) console.error("No se pudieron cargar los cultivos planificados:", respuestaCultivos.error);
  if (respuestaFinanzas.error) console.error("No se pudieron cargar los movimientos financieros del dashboard:", respuestaFinanzas.error);
  if (respuestaLeche.error) console.error("No se pudo cargar la producción de leche:", respuestaLeche.error);

  const valorPorCategoria = new Map<string, number>();
  (respuestaProductos.data || []).forEach((producto) => {
    const categoria = producto.categoria || "Sin categoría";
    valorPorCategoria.set(categoria, (valorPorCategoria.get(categoria) || 0) + Number(producto.stock) * Number(producto.costo_promedio));
  });
  if (target === "all" && charts.inventory) {
    charts.inventory.data.labels = [...valorPorCategoria.keys()];
    charts.inventory.data.datasets[0].data = [...valorPorCategoria.values()];
    charts.inventory.update();
  }
  if (target === "all") mostrarMensajeGrafica("dashboardInventoryEmpty", respuestaProductos.error
    ? "No se pudo cargar el inventario. Revisa la consola y los permisos de Supabase."
    : valorPorCategoria.size ? "" : "Aún no hay productos activos con valor en inventario.");

  const cultivosPlanificadosPorTipo = new Map<string, number>();
  (respuestaCultivos.data || []).forEach((cultivo) => {
    const tipo = cultivo.tipo?.trim() || "Sin tipo";
    cultivosPlanificadosPorTipo.set(tipo, (cultivosPlanificadosPorTipo.get(tipo) || 0) + 1);
  });
  if (target === "all" && charts.crops) {
    charts.crops.data.labels = [...cultivosPlanificadosPorTipo.keys()];
    charts.crops.data.datasets[0].data = [...cultivosPlanificadosPorTipo.values()];
    charts.crops.update();
  }
  if (target === "all") mostrarMensajeGrafica("dashboardCropsEmpty", respuestaCultivos.error
    ? "No se pudieron cargar los cultivos planificados. Revisa la consola y los permisos de Supabase."
    : cultivosPlanificadosPorTipo.size ? "" : "Aún no hay cultivos planificados registrados.");

  const ingresosPorMes = new Map(claves.map((clave) => [clave, 0]));
  const egresosPorMes = new Map(claves.map((clave) => [clave, 0]));
  (respuestaFinanzas.data || []).forEach((registro) => {
    const mes = registro.fecha?.slice(0, 7);
    if (registro.tipo === "Ingreso" && ingresosPorMes.has(mes)) ingresosPorMes.set(mes, (ingresosPorMes.get(mes) || 0) + Number(registro.monto));
    if (registro.tipo === "Egreso" && egresosPorMes.has(mes)) egresosPorMes.set(mes, (egresosPorMes.get(mes) || 0) + Number(registro.monto));
  });
  const labels = claves.map((clave) => new Date(`${clave}-01T00:00:00`).toLocaleDateString("es-CO", { month: "short" }));
  if ((target === "all" || target === "finance") && charts.financeTrend) {
    charts.financeTrend.data.labels = labels;
    charts.financeTrend.data.datasets[0].data = claves.map((clave) => ingresosPorMes.get(clave) || 0);
    charts.financeTrend.data.datasets[1].data = claves.map((clave) => egresosPorMes.get(clave) || 0);
    charts.financeTrend.update();
  }
  if (target === "all" || target === "finance") mostrarMensajeGrafica("dashboardFinanceEmpty", respuestaFinanzas.error
    ? "No se pudieron cargar los movimientos financieros. Revisa la consola y los permisos de Supabase."
    : (respuestaFinanzas.data || []).length ? "" : "No hay movimientos financieros en este período.");

  const litrosPorMes = new Map(claves.map((clave) => [clave, 0]));
  (respuestaLeche.data || []).forEach((registro) => {
    const mes = registro.fecha?.slice(0, 7);
    if (!litrosPorMes.has(mes)) return;
    const unidad = String(registro.unidad).toLowerCase();
    if (unidad === "l") litrosPorMes.set(mes, (litrosPorMes.get(mes) || 0) + Number(registro.cantidad));
    else if (unidad === "ml") litrosPorMes.set(mes, (litrosPorMes.get(mes) || 0) + Number(registro.cantidad) / 1000);
    else if (unidad === "gal") litrosPorMes.set(mes, (litrosPorMes.get(mes) || 0) + Number(registro.cantidad) * 3.785411784);
  });
  if ((target === "all" || target === "milk") && charts.milk) {
    charts.milk.data.labels = labels;
    charts.milk.data.datasets[0].data = claves.map((clave) => litrosPorMes.get(clave) || 0);
    charts.milk.update();
  }
  if (target === "all" || target === "milk") mostrarMensajeGrafica("dashboardMilkEmpty", respuestaLeche.error
    ? "No se pudo cargar la producción animal. Revisa la consola y los permisos de Supabase."
    : (respuestaLeche.data || []).some((registro) => ["l", "ml", "gal"].includes(String(registro.unidad).toLowerCase()))
      ? ""
      : "No hay registros de leche en este período; se muestran solo datos en litros o mililitros.");
}

export function initFinanceChart(): void {
  const canvas = documentRef.getElementById("financeChart");
  if (!(canvas instanceof HTMLCanvasElement) || charts.fin) return;
  charts.fin = new Chart(canvas, {
    type: "bar",
    data: { labels: [], datasets: [
      { label: "Ingresos", data: [], borderRadius: 7 },
      { label: "Egresos", data: [], borderRadius: 7 },
    ] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
        tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${formatoCOP(Number(context.parsed.y))}` } },
      },
      scales: {
        y: { beginAtZero: true, grid: { color: "#edf1e9" }, ticks: { callback: (value) => formatoCOP(Number(value), true) } },
        x: { grid: { display: false } },
      },
    },
  });
}

export function updateFinanceChart(labels: string[], ingresos: number[], egresos: number[]): void {
  const chart = charts.fin;
  if (!chart) return;
  chart.data.labels = labels;
  chart.data.datasets[0].data = ingresos;
  chart.data.datasets[1].data = egresos;
  chart.update();
}

export async function cargarDashboard(): Promise<void> {
  const { count: cultivos, error: errorCultivos } = await supabase
    .from("cultivos")
    .select("*", { count: "exact", head: true })
    .eq("activo", true)
    .in("estado", ["Planificado", "En desarrollo"]);
  if (errorCultivos) console.error("No se pudieron cargar los cultivos:", errorCultivos);
  else updateKpi("kpi-cultivos", cultivos ?? 0);

  const { count: animales, error: errorAnimales } = await supabase
    .from("animales")
    .select("*", { count: "exact", head: true })
    .eq("activo", true)
    .eq("estado", "Activo");
  if (errorAnimales) console.error("No se pudieron cargar los animales:", errorAnimales);
  else updateKpi("kpi-animales", animales ?? 0);

  const { data: productos, error: errorProductos } = await supabase
    .from("productos")
    .select("stock, costo_promedio")
    .eq("activo", true);
  if (errorProductos) console.error("No se pudo cargar el valor del inventario:", errorProductos);
  else {
    const valorInventario = (productos || []).reduce((total, producto) => total + Number(producto.stock) * Number(producto.costo_promedio), 0);
    updateKpi("kpi-inventario", formatCurrency(valorInventario));
  }

  const { data: movimientos, error: errorMovimientos } = await supabase
    .from("movimientos_financieros")
    .select("tipo, monto, fecha")
    .eq("activo", true);
  if (errorMovimientos) console.error("No se pudo cargar el balance financiero:", errorMovimientos);
  else {
    const mesActual = fechaLocalActual().slice(0, 7);
    const balance = (movimientos || [])
      .filter((movimiento) => movimiento.fecha?.startsWith(mesActual))
      .reduce((total, movimiento) => total + (movimiento.tipo === "Ingreso" ? Number(movimiento.monto) : -Number(movimiento.monto)), 0);
    updateKpi("kpi-balance", formatCurrency(balance));
  }

  const { data: alertas, error: errorAlertas } = await supabase
    .from("alertas")
    .select("id, tipo, mensaje, fecha, estado, modulo_origen")
    .eq("estado", "pendiente")
    .order("fecha", { ascending: false })
    .limit(5);
  if (errorAlertas) console.error("No se pudieron cargar las alertas:", errorAlertas);
  else {
    updateBadgeNotif(alertas?.length ?? 0);
    const contenedor = documentRef.querySelector("#page-dashboard .alerts");
    if (contenedor) {
      contenedor.innerHTML = alertas?.length
        ? alertas.map((alerta) => `<article class="alert-item"><div><b>${escapeHtml(alerta.tipo || "Alerta")}</b><p>${escapeHtml(alerta.mensaje || "")}</p><small>${escapeHtml(alerta.modulo_origen || "Sistema")} · ${escapeHtml(new Date(alerta.fecha).toLocaleString("es-CO"))}</small></div></article>`).join("")
        : '<p class="empty">Sin alertas activas.</p>';
    }
  }
}
