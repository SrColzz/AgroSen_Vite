import Chart from "chart.js/auto";
import { supabase } from "../../lib/supabase";
import { appState } from "../../shared/state";
import { escapeHtml, fechaLocalActual, formatDate, renderTable, showToast, updateKpi } from "../../shared/dom";
import { archivarRegistro, actualizarRotulosEdicion, cargarDashboard, closeModals, openModal } from "../../app/controller";
import { formatCurrency, getCurrency, getStockWarningPercent } from "../../shared/preferences";
const doc: any = document;
const arrayFrom: any = Array.from;
let inventoryChart: Chart | null = null;
let inventoryCashflowChart: Chart | null = null;

window.addEventListener("agrosen:preferences-updated", () => { void cargarInventario(); });
window.addEventListener("agrosen:alert-preferences-updated", () => { void cargarInventario(); });

function formatoCOP(valor: number): string {
  return formatCurrency(Number.isFinite(valor) ? valor : 0);
}

function actualizarGraficaInventario(productos: any[]) {
  const canvas = doc.getElementById("inventoryChart");
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const valores = new Map<string, number>();
  productos.forEach((producto) => {
    const categoria = producto.categoria || "Sin categoría";
    valores.set(categoria, (valores.get(categoria) || 0) + Number(producto.stock) * Number(producto.costo_promedio));
  });
  const labels = [...valores.keys()];
  const data = [...valores.values()];
  if (!inventoryChart || inventoryChart.canvas !== canvas) {
    inventoryChart?.destroy();
    inventoryChart = new Chart(canvas, {
      type: "doughnut",
      data: { labels, datasets: [{ label: `Valor por categoría (${getCurrency()})`, data }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom" },
          tooltip: { callbacks: { label: (context) => `${context.label || "Categoría"}: ${formatoCOP(Number(context.parsed))}` } },
        },
      },
    });
    return;
  }
  inventoryChart.data.labels = labels;
  inventoryChart.data.datasets[0].label = `Valor por categoría (${getCurrency()})`;
  inventoryChart.data.datasets[0].data = data;
  inventoryChart.update();
}

function clavesMesesFlujo(meses: number): string[] {
  const ahora = new Date();
  return Array.from({ length: meses }, (_, index) => {
    const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - meses + index + 1, 1);
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
  });
}

function mesLocalMovimiento(fecha: string): string {
  if (!fecha) return "";
  if (!fecha.includes("T")) return fecha.slice(0, 7);
  const valor = new Date(fecha);
  if (Number.isNaN(valor.getTime())) return fecha.slice(0, 7);
  return `${valor.getFullYear()}-${String(valor.getMonth() + 1).padStart(2, "0")}`;
}

async function actualizarGraficaFlujoCaja(productos: any[]) {
  const canvas = doc.getElementById("inventoryCashflowChart");
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const rango = Number((doc.getElementById("inventory-cashflow-range") as HTMLSelectElement | null)?.value || 6);
  const meses = rango === 3 || rango === 12 ? rango : 6;
  const claves = clavesMesesFlujo(meses);
  const [anioInicio, mesInicio] = claves[0].split("-").map(Number);
  const fechaDesde = new Date(anioInicio, mesInicio - 1, 1).toISOString();
  const fechaHasta = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString();
  const movimientos: any[] = [];
  const tamanoPagina = 1000;
  for (let desde = 0; ; desde += tamanoPagina) {
    const { data, error } = await supabase.from("movimientos_inventario")
      .select("id,id_producto,tipo,cantidad,costo_unitario,fecha")
      .eq("activo", true)
      .gte("fecha", fechaDesde)
      .lt("fecha", fechaHasta)
      .order("fecha", { ascending: true })
      .order("id", { ascending: true })
      .range(desde, desde + tamanoPagina - 1);
    if (error) {
      console.error("No se pudieron cargar todos los movimientos para el flujo de inventario:", error);
      showToast("No se pudo completar la gráfica de flujo de inventario.");
      return;
    }
    movimientos.push(...(data || []));
    if (!data || data.length < tamanoPagina) break;
  }
  const compras = new Map(claves.map((mes) => [mes, 0]));
  const salidas = new Map(claves.map((mes) => [mes, 0]));
  const costoPromedio = new Map(productos.map((producto) => [producto.id, Number(producto.costo_promedio) || 0]));
  movimientos.forEach((movimiento) => {
    const mes = mesLocalMovimiento(movimiento.fecha);
    const costoGuardado = Number(movimiento.costo_unitario) || 0;
    const promedio = costoPromedio.get(movimiento.id_producto) || 0;
    const costo = movimiento.tipo === "Entrada" ? costoGuardado || promedio : promedio || costoGuardado;
    const total = Number(movimiento.cantidad) * costo;
    if (movimiento.tipo === "Entrada" && compras.has(mes)) compras.set(mes, (compras.get(mes) || 0) + total);
    if (movimiento.tipo === "Salida" && salidas.has(mes)) salidas.set(mes, (salidas.get(mes) || 0) + total);
  });
  const labels = claves.map((mes) => new Date(`${mes}-01T00:00:00`).toLocaleDateString("es-CO", { month: "short", year: meses === 12 ? "2-digit" : undefined }));
  if (!inventoryCashflowChart || inventoryCashflowChart.canvas !== canvas) {
    inventoryCashflowChart?.destroy();
    inventoryCashflowChart = new Chart(canvas, {
      type: "line",
      data: { labels, datasets: [
        { label: "Compras", data: [...compras.values()], borderColor: "#2f855a", backgroundColor: "#2f855a", tension: 0.3 },
        { label: "Salidas valorizadas", data: [...salidas.values()], borderColor: "#dd6b20", backgroundColor: "#dd6b20", tension: 0.3 },
      ] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${formatCurrency(Number(context.parsed.y))}` } } }, scales: { y: { beginAtZero: true, ticks: { callback: (value) => formatCurrency(Number(value), 0) } }, x: { grid: { display: false } } } },
    });
    return;
  }
  inventoryCashflowChart.data.labels = labels;
  inventoryCashflowChart.data.datasets[0].data = [...compras.values()];
  inventoryCashflowChart.data.datasets[1].data = [...salidas.values()];
  inventoryCashflowChart.update();
}

export async function cargarInventario() {
  const categoria = doc.getElementById("inventario-filtro-categoria")?.value;
  const consultaProductos = supabase
    .from("productos")
    .select("id, nombre, categoria, unidad, stock, stock_minimo, costo_promedio, activo, id_finca, id_lote")
    .order("nombre", { ascending: true });

  const [respuestaProductos, respuestaMovimientos] = await Promise.all([
    consultaProductos,
    supabase
      .from("movimientos_inventario")
      .select("id, id_producto, tipo, cantidad, costo_unitario, proveedor, vencimiento, detalle, fecha, activo")
      .order("fecha", { ascending: false })
      .limit(5000),
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
  const fincaIds = [...new Set(todosLosProductos.map((producto) => producto.id_finca).filter(Boolean))];
  const loteIds = [...new Set(todosLosProductos.map((producto) => producto.id_lote).filter(Boolean))];
  const [respuestaFincas, respuestaLotes] = await Promise.all([
    fincaIds.length ? supabase.from("fincas").select("id, nombre").in("id", fincaIds) : Promise.resolve({ data: [], error: null }),
    loteIds.length ? supabase.from("lotes").select("id, nombre").in("id", loteIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (respuestaFincas.error) console.error("No se pudieron cargar las fincas de los productos:", respuestaFincas.error);
  if (respuestaLotes.error) console.error("No se pudieron cargar los lotes de los productos:", respuestaLotes.error);
  const fincasPorId = new Map((respuestaFincas.data || []).map((finca) => [finca.id, finca.nombre]));
  const lotesPorId = new Map((respuestaLotes.data || []).map((lote) => [lote.id, lote.nombre]));
  const productos = categoria
    ? todosLosProductos.filter((producto) => producto.categoria === categoria)
    : todosLosProductos;
  const movimientos = respuestaMovimientos.data || [];
  const idsProductos = [...new Set(movimientos.map((movimiento) => movimiento.id_producto))];
  let referenciasProductos: any[] = todosLosProductos;
  if (idsProductos.length) {
    const { data, error } = await supabase
      .from("productos")
      .select("id, nombre, unidad")
      .in("id", idsProductos);
    if (!error) referenciasProductos = [...productos, ...(data || [])];
  }
  const nombresProductos = new Map(referenciasProductos.map((producto) => [producto.id, producto]));

  const margenStock = getStockWarningPercent() / 100;
  const estaBajoMinimo = (producto: any) => Number(producto.stock) <= Number(producto.stock_minimo) * (1 + margenStock);
  const stockBajo = todosLosProductos.filter(estaBajoMinimo).length;
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
  updateKpi("kpi-valor-inv", formatCurrency(valorTotal));
  actualizarGraficaInventario(todosLosProductos);
  await actualizarGraficaFlujoCaja(todosLosProductos);

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
    const stockLimitado = stock <= minimo * (1 + margenStock);
    const estado = stockLimitado ? "Stock bajo" : "Disponible";
    return `
      <tr>
        <td>${escapeHtml(producto.nombre)}</td>
        <td>${escapeHtml(producto.categoria)}</td>
        <td>${escapeHtml(fincasPorId.get(producto.id_finca) || "—")}</td>
        <td>${escapeHtml(lotesPorId.get(producto.id_lote) || "—")}</td>
        <td>${stock.toLocaleString("es-CO")} ${escapeHtml(producto.unidad)}</td>
        <td>${minimo.toLocaleString("es-CO")} ${escapeHtml(producto.unidad)}</td>
        <td>${formatDate(vencimientoPorProducto.get(producto.id))}</td>
        <td>${formatCurrency(stock * costo)}</td>
        <td><span class="status ${stockLimitado ? "warn" : "ok"}">${estado}</span></td>
      <td><button class="btn btn-soft btn-sm" data-legacy-click="editarProducto('${producto.id}')">Editar</button> ${producto.activo ? `<button class="btn btn-soft btn-sm" data-legacy-click="archivarProducto('${producto.id}')">Archivar</button>` : `<button class="btn btn-primary btn-sm" data-legacy-click="reactivarProducto('${producto.id}')">Activar</button>`} <button class="btn btn-danger btn-sm" data-legacy-click="eliminarProducto('${producto.id}')">Eliminar</button></td>
      </tr>
    `;
  });

  renderTable("movimientosTable", movimientos, (movimiento) => {
    const producto = nombresProductos.get(movimiento.id_producto);
    const esUsoEnFinca = movimiento.detalle?.startsWith("Uso en finca |");
    const tipoMovimiento = esUsoEnFinca ? "Uso en finca" : movimiento.tipo;
    return `
      <tr>
        <td>${formatDate(movimiento.fecha)}</td>
        <td>${escapeHtml(producto?.nombre || "Producto archivado")}</td>
        <td><span class="status ${movimiento.activo ? (movimiento.tipo === "Entrada" ? "ok" : "info") : "warn"}">${movimiento.activo ? tipoMovimiento : "Anulado"}</span></td>
        <td>${Number(movimiento.cantidad).toLocaleString("es-CO")} ${escapeHtml(producto?.unidad || "")}</td>
        <td>${formatCurrency(Number(movimiento.costo_unitario))}</td>
        <td>${escapeHtml(movimiento.proveedor || "—")}</td>
        <td>${formatDate(movimiento.vencimiento)}</td>
        <td>${escapeHtml(movimiento.detalle || "—")}</td>
        <td>${movimiento.activo ? `<button class="btn btn-soft btn-sm" data-legacy-click="anularMovimientoInventario('${movimiento.id}')">Anular</button>` : "—"} <button class="btn btn-danger btn-sm" data-legacy-click="eliminarMovimientoInventario('${movimiento.id}')">Eliminar</button></td>
      </tr>
    `;
  });
}

export async function cargarProductosEnSelector(selectId) {
  const selector = doc.getElementById(selectId);
  if (!selector) return;
  selector.replaceChildren(new Option("Cargando productos...", ""));
  const { data, error } = await supabase
    .from("productos")
    .select("id, nombre, unidad, stock, id_finca, id_lote")
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
    opcion.dataset.finca = producto.id_finca || "";
    opcion.dataset.lote = producto.id_lote || "";
    selector.add(opcion);
  });
}

export async function cargarFincasProducto(idSeleccionado = "") {
  const selector = doc.getElementById("producto-finca");
  if (!selector) return;
  selector.replaceChildren(new Option("Cargando fincas...", ""));
  const { data, error } = await supabase.from("fincas").select("id, nombre").eq("activo", true).order("nombre");
  if (error) {
    console.error("No se pudieron cargar las fincas para el producto:", error);
    selector.replaceChildren(new Option("No se pudieron cargar las fincas", ""));
    return;
  }
  selector.replaceChildren(new Option("Selecciona una finca", ""));
  (data || []).forEach((finca) => selector.add(new Option(finca.nombre, finca.id)));
  if (idSeleccionado) selector.value = idSeleccionado;
  await cargarLotesProducto();
}

export async function cargarLotesProducto(idSeleccionado = "") {
  const idFinca = doc.getElementById("producto-finca")?.value;
  const selector = doc.getElementById("producto-lote");
  if (!selector) return;
  selector.replaceChildren(new Option(idFinca ? "Cargando lotes..." : "Selecciona primero una finca", ""));
  if (!idFinca) return;
  const { data, error } = await supabase.from("lotes").select("id, nombre").eq("id_finca", idFinca).eq("activo", true).order("nombre");
  if (error) {
    console.error("No se pudieron cargar los lotes para el producto:", error);
    selector.replaceChildren(new Option("No se pudieron cargar los lotes", ""));
    return;
  }
  selector.replaceChildren(new Option("Selecciona un lote", ""));
  (data || []).forEach((lote) => selector.add(new Option(lote.nombre, lote.id)));
  if (idSeleccionado) selector.value = idSeleccionado;
}

export function actualizarFormularioMovimiento() {
  const esUsoEnFinca = doc.getElementById("mov-tipo")?.value === "Uso finca";
  doc.getElementById("mov-uso-fields").hidden = !esUsoEnFinca;
  ["mov-precio-field", "mov-proveedor-field", "mov-vencimiento-field"].forEach((id) => {
    doc.getElementById(id).hidden = esUsoEnFinca;
  });
  if (esUsoEnFinca) void actualizarUbicacionProductoInventario();
}

export async function actualizarUbicacionProductoInventario() {
  if (doc.getElementById("mov-tipo")?.value !== "Uso finca") return;
  const opcion = doc.getElementById("mov-producto")?.selectedOptions[0];
  const idFinca = opcion?.dataset.finca || "";
  const idLote = opcion?.dataset.lote || "";
  await cargarFincasUsoInventario();
  const finca = doc.getElementById("mov-uso-finca");
  if (!idFinca || !arrayFrom(finca.options).some((item) => item.value === idFinca)) return;
  finca.value = idFinca;
  await cargarLotesUsoInventario();
  const lote = doc.getElementById("mov-uso-lote");
  if (idLote && arrayFrom(lote.options).some((item) => item.value === idLote)) {
    lote.value = idLote;
    await cargarCultivosUsoInventario();
  }
}

export async function cargarResponsableUsoInventario() {
  const campo = doc.getElementById("mov-uso-responsable");
  if (!campo) return;
  const { data } = await supabase.auth.getUser();
  const usuario = data?.user;
  if (!usuario) {
    campo.value = "Usuario no identificado";
    return;
  }
  const { data: perfil, error } = await supabase
    .from("usuarios")
    .select("nombre")
    .eq("id", usuario.id)
    .maybeSingle();
  if (error) console.error("No se pudo cargar el responsable del movimiento:", error);
  campo.value = perfil?.nombre || usuario.user_metadata?.nombre || usuario.email || usuario.id;
}

export async function cargarFincasUsoInventario() {
  const selector = doc.getElementById("mov-uso-finca");
  if (!selector) return;
  selector.replaceChildren(new Option("Cargando fincas...", ""));
  const { data, error } = await supabase
    .from("fincas")
    .select("id, nombre")
    .eq("activo", true)
    .order("nombre", { ascending: true });
  if (error) {
    console.error("No se pudieron cargar las fincas para el uso de inventario:", error);
    selector.replaceChildren(new Option("No se pudieron cargar las fincas", ""));
    return;
  }
  selector.replaceChildren(new Option(data?.length ? "Selecciona una finca" : "No hay fincas activas", ""));
  (data || []).forEach((finca) => selector.add(new Option(finca.nombre, finca.id)));
  await cargarLotesUsoInventario();
}

export async function cargarLotesUsoInventario() {
  const idFinca = doc.getElementById("mov-uso-finca")?.value;
  const selector = doc.getElementById("mov-uso-lote");
  const cultivos = doc.getElementById("mov-uso-cultivo");
  if (!selector || !cultivos) return;
  selector.replaceChildren(new Option(idFinca ? "Cargando lotes..." : "Selecciona primero una finca", ""));
  cultivos.replaceChildren(new Option("Selecciona primero un lote", ""));
  if (!idFinca) return;
  const { data, error } = await supabase
    .from("lotes")
    .select("id, nombre")
    .eq("id_finca", idFinca)
    .eq("activo", true)
    .order("nombre", { ascending: true });
  if (error) {
    console.error("No se pudieron cargar los lotes para el uso de inventario:", error);
    selector.replaceChildren(new Option("No se pudieron cargar los lotes", ""));
    return;
  }
  selector.replaceChildren(new Option(data?.length ? "Selecciona un lote" : "No hay lotes activos", ""));
  (data || []).forEach((lote) => selector.add(new Option(lote.nombre, lote.id)));
}

export async function cargarCultivosUsoInventario() {
  const idLote = doc.getElementById("mov-uso-lote")?.value;
  const selector = doc.getElementById("mov-uso-cultivo");
  if (!selector) return;
  selector.replaceChildren(new Option(idLote ? "Cargando plantas/cultivos..." : "Selecciona primero un lote", ""));
  if (!idLote) return;
  const { data, error } = await supabase
    .from("cultivos")
    .select("id, tipo, variedad")
    .eq("id_lote", idLote)
    .eq("activo", true)
    .order("tipo", { ascending: true });
  if (error) {
    console.error("No se pudieron cargar los cultivos para el uso de inventario:", error);
    selector.replaceChildren(new Option("No se pudieron cargar los cultivos", ""));
    return;
  }
  selector.replaceChildren(new Option(data?.length ? "Selecciona una planta/cultivo" : "No hay plantas o cultivos activos", ""));
  (data || []).forEach((cultivo) => selector.add(new Option(`${cultivo.tipo}${cultivo.variedad ? ` · ${cultivo.variedad}` : ""}`, cultivo.id)));
}

export function actualizarUnidadProductoLabor() {
  const selector = doc.getElementById("labor-producto");
  const opcion = selector?.selectedOptions[0];
  const hayProducto = Boolean(selector?.value);
  const unidad = doc.getElementById("labor-unidad");
  const descripcion = doc.getElementById("labor-insumo");
  if (hayProducto && opcion?.dataset.unidad) unidad.value = opcion.dataset.unidad;
  unidad.disabled = hayProducto;
  descripcion.disabled = hayProducto;
  if (hayProducto) descripcion.value = "";
}

export async function asegurarProductoEnSelector(selectId, idProducto) {
  const selector = doc.getElementById(selectId);
  if (!selector || arrayFrom(selector.options).some((option) => option.value === idProducto)) return;
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

export async function guardarProducto() {
  const nombre = doc.getElementById("producto-nombre").value.trim();
  const categoria = doc.getElementById("producto-categoria").value;
  const unidad = doc.getElementById("producto-unidad").value;
  const idFinca = doc.getElementById("producto-finca").value;
  const idLote = doc.getElementById("producto-lote").value;
  const stockMinimo = Number(doc.getElementById("producto-stock-minimo").value || 0);
  if (!nombre || !categoria || !unidad || !idFinca || !idLote || !Number.isFinite(stockMinimo) || stockMinimo < 0) {
    showToast("Completa nombre, categoría, unidad, finca, lote y un mínimo de stock válido.");
    return;
  }

  const valores = { nombre, categoria, unidad, id_finca: idFinca, id_lote: idLote, stock_minimo: stockMinimo };
  const editando = appState.registroEnEdicion?.tipo === "producto";
  const respuesta = editando
    ? await supabase.from("productos").update(valores).eq("id", appState.registroEnEdicion.id).select("id").maybeSingle()
    : await supabase.from("productos").insert(valores).select("id").single();
  if (respuesta.error || !respuesta.data) {
    console.error("No se pudo guardar el producto:", respuesta.error);
    const { data: { session } } = await supabase.auth.getSession();
    console.error("Rol de la petición de Supabase:", session ? "authenticated" : "anon");
    const detalleError = respuesta.error
      ? [respuesta.error.message, respuesta.error.details, respuesta.error.hint].filter(Boolean).join(" · ")
      : "No se recibió un registro actualizado";
    showToast(!respuesta.error ? "No se encontró el producto o no tienes permiso para editarlo." : respuesta.error.code === "23514" && respuesta.error.message.includes("productos_categoria_check")
      ? "La base de datos rechazó esta categoría. Ejecuta ajustes_categorias_productos_supabase.sql en Supabase y vuelve a guardar."
      : respuesta.error.code === "PGRST204" || respuesta.error.code === "42703"
      ? "Ejecuta inventario_ubicacion_supabase.sql en Supabase y vuelve a intentarlo."
      : respuesta.error.code === "42501" ? `PostgreSQL negó ${editando ? "UPDATE" : "INSERT"} en productos: ${detalleError} (sesión ${session ? "autenticada" : "anónima"})` : `No se pudo guardar el producto: ${detalleError}`);
    return;
  }
  closeModals();
  showToast(editando ? "Producto actualizado." : "Producto agregado al inventario.");
  await cargarInventario();
}

export async function editarProducto(id) {
  const { data: producto, error } = await supabase
    .from("productos")
    .select("id, nombre, categoria, unidad, stock_minimo, id_finca, id_lote")
    .eq("id", id)
    .maybeSingle();
  if (error || !producto) {
    console.error("No se pudo cargar el producto para editar:", error);
    showToast(error?.code === "42703" || error?.code === "PGRST204"
      ? "Faltan las columnas de ubicación del inventario. Ejecuta inventario_ubicacion_supabase.sql en Supabase."
      : error?.code === "42501" ? "Supabase bloqueó la lectura del producto. Revisa la política SELECT de productos para tu usuario."
        : !producto && !error ? "No se encontró el producto activo." : `No se pudo abrir el producto: ${error?.message || "error desconocido"}`);
    return;
  }
  await openModal("modalProducto");
  doc.getElementById("producto-nombre").value = producto.nombre;
  doc.getElementById("producto-categoria").value = producto.categoria;
  doc.getElementById("producto-unidad").value = producto.unidad;
  doc.getElementById("producto-stock-minimo").value = producto.stock_minimo;
  await cargarFincasProducto(producto.id_finca || "");
  doc.getElementById("producto-lote").value = producto.id_lote || "";
  appState.registroEnEdicion = { tipo: "producto", id };
  actualizarRotulosEdicion("producto");
}

export async function archivarProducto(id) {
  if (!window.confirm("¿Archivar este producto? Solo se puede archivar cuando su stock sea cero.")) return;
  const { data: producto, error: errorProducto } = await supabase.from("productos").select("stock").eq("id", id).maybeSingle();
  if (errorProducto || !producto) {
    console.error("No se pudo comprobar el stock antes de archivar:", errorProducto);
    showToast("No se pudo comprobar el producto. Revisa los permisos de lectura.");
    return;
  }
  if (Number(producto.stock) !== 0) {
    showToast("No se puede archivar mientras tenga stock. Registra o anula movimientos hasta dejarlo en cero.");
    return;
  }
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
  await cargarDashboard();
}

export async function guardarMovimientoInventario() {
  const idProducto = doc.getElementById("mov-producto").value;
  const tipoSeleccionado = doc.getElementById("mov-tipo").value;
  const esUsoEnFinca = tipoSeleccionado === "Uso finca";
  const tipo = esUsoEnFinca ? "Salida" : tipoSeleccionado;
  const cantidad = Number(doc.getElementById("mov-cantidad").value);
  const costo = esUsoEnFinca ? 0 : parsearImporte(doc.getElementById("mov-precio").value);
  const proveedor = esUsoEnFinca ? null : doc.getElementById("mov-proveedor").value.trim() || null;
  const vencimiento = esUsoEnFinca ? null : doc.getElementById("mov-vencimiento").value || null;
  if (!idProducto || !Number.isFinite(cantidad) || cantidad <= 0 || !Number.isFinite(costo) || costo < 0) {
    showToast("Selecciona un producto e ingresa cantidad y costo válidos.");
    return;
  }
  if (!esUsoEnFinca && tipo === "Entrada" && costo <= 0) {
    showToast("Indica el costo unitario de la entrada.");
    return;
  }
  let detalle = null;
  if (esUsoEnFinca) {
    const finca = doc.getElementById("mov-uso-finca");
    const lote = doc.getElementById("mov-uso-lote");
    const cultivo = doc.getElementById("mov-uso-cultivo");
    if (!finca.value || !lote.value || !cultivo.value) {
      showToast("Selecciona la finca, el lote y la planta o cultivo donde se usó el producto.");
      return;
    }
    const fechaHora = doc.getElementById("mov-uso-fecha").value;
    const responsable = doc.getElementById("mov-uso-responsable").value.trim() || "Usuario no identificado";
    const observaciones = doc.getElementById("mov-uso-observaciones").value.trim() || "Sin observaciones";
    detalle = [
      "Uso en finca",
      `Finca: ${finca.selectedOptions[0]?.textContent} (${finca.value})`,
      `Lote: ${lote.selectedOptions[0]?.textContent} (${lote.value})`,
      `Planta/cultivo: ${cultivo.selectedOptions[0]?.textContent} (${cultivo.value})`,
      `Observaciones: ${observaciones}`,
      `Fecha y hora: ${fechaHora}`,
      `Registrado por: ${responsable}`,
    ].join(" | ");
  }
  const { error } = await supabase.rpc("registrar_movimiento_inventario", {
    p_id_producto: idProducto,
    p_tipo: tipo,
    p_cantidad: cantidad,
    p_costo_unitario: costo,
    p_proveedor: proveedor || null,
    p_vencimiento: vencimiento,
    p_detalle: detalle,
  });
  if (error) {
    console.error("No se pudo registrar el movimiento de inventario:", error);
    showToast(error.code === "PGRST202" ? "Ejecuta el SQL del inventario y vuelve a intentarlo." : error.message || "No se pudo registrar el movimiento.");
    return;
  }
  closeModals();
  showToast(esUsoEnFinca ? "Uso en finca registrado y stock actualizado." : tipo === "Entrada" ? "Entrada registrada y stock actualizado." : "Salida registrada y stock actualizado.");
  await cargarInventario();
  await cargarDashboard();
}

function parsearImporte(valor: string): number {
  const limpio = valor.trim().replace(/\s/g, "");
  if (!limpio) return 0;
  // Los importes escritos con coma o punto de miles se convierten a entero.
  if (/^\d{1,3}([,.]\d{3})+$/.test(limpio)) return Number(limpio.replace(/[,.]/g, ""));
  // También permite decimales con coma o punto.
  return Number(limpio.replace(/,(?=\d{1,2}$)/, ".").replace(/\.(?=.*\.)/g, "").replace(/,(?=.*[,])/g, ""));
}

export async function reactivarProducto(id: string): Promise<void> {
  const { data, error } = await supabase.from("productos").update({ activo: true }).eq("id", id).select("id").maybeSingle();
  if (error || !data) { console.error("No se pudo reactivar el producto:", error); showToast("No se pudo activar el producto."); return; }
  showToast("Producto activado nuevamente.");
  await cargarInventario();
}

export async function eliminarProducto(id: string): Promise<void> {
  if (!window.confirm("¿Eliminar permanentemente este producto y todos sus movimientos de inventario? Las labores vinculadas conservarán su descripción, pero perderán el vínculo al producto.")) return;
  const { error } = await supabase.rpc("eliminar_producto_inventario", { p_id_producto: id });
  if (error) {
    console.error("No se pudo eliminar el producto y su historial:", error);
    showToast(error.code === "PGRST202"
      ? "Falta ejecutar eliminar_producto_inventario_supabase.sql en Supabase."
      : `No se pudo eliminar el producto: ${error.message}`);
    return;
  }
  showToast("Producto y movimientos eliminados permanentemente.");
  await cargarInventario();
  await cargarDashboard();
}

export async function anularMovimientoInventario(id) {
  if (!window.confirm("¿Anular este movimiento? El stock se ajustará y el registro quedará en el historial.")) return;
  const { error } = await supabase.rpc("anular_movimiento_inventario", { p_id_movimiento: id });
  if (error) {
    console.error("No se pudo anular el movimiento:", error);
    showToast(error.message || "No se pudo anular el movimiento.");
    return;
  }
  showToast("Movimiento anulado y stock recalculado.");
  await cargarInventario();
  await cargarDashboard();
}

export async function eliminarMovimientoInventario(id: string): Promise<void> {
  if (!window.confirm("¿Eliminar permanentemente este movimiento? Si sigue activo, primero se revertirá su efecto sobre el stock.")) return;
  const { data: movimiento, error: errorLectura } = await supabase.from("movimientos_inventario").select("activo").eq("id", id).maybeSingle();
  if (errorLectura || !movimiento) { showToast("No se pudo comprobar el movimiento."); return; }
  let stockRevertido = false;
  if (movimiento.activo) {
    const { error } = await supabase.rpc("anular_movimiento_inventario", { p_id_movimiento: id });
    if (error) { console.error("No se pudo revertir el stock antes de eliminar:", error); showToast(error.message || "No se pudo revertir el efecto del movimiento."); return; }
    stockRevertido = true;
  }
  const { data, error } = await supabase.from("movimientos_inventario").delete().eq("id", id).select("id").maybeSingle();
  if (error || !data) {
    console.error("No se pudo eliminar el movimiento:", error);
    const motivo = error?.code === "42501"
      ? "Supabase bloqueó el DELETE por permisos. Ejecuta ajustes_eliminar_movimientos_inventario_supabase.sql en Supabase."
      : error?.code === "23503"
        ? "Otro registro depende de este movimiento; la base de datos impidió borrarlo."
        : error?.message || "No se encontró el movimiento o no tienes permiso para borrarlo.";
    showToast(`${stockRevertido ? "El stock se revirtió, pero " : ""}${motivo}`);
    return;
  }
  showToast("Movimiento eliminado permanentemente.");
  await cargarInventario();
  await cargarDashboard();
}

