import Chart from "chart.js/auto";
import { supabase } from "../../lib/supabase";
import { appState } from "../../shared/state";
import { escapeHtml, fechaLocalActual, formatDate, renderTable, showToast, updateKpi } from "../../shared/dom";
import { archivarRegistro, actualizarRotulosEdicion, cargarDashboard, closeModals, openModal } from "../../app/controller";
import { formatCurrency, getCurrency, getStockWarningPercent } from "../../shared/preferences";
const doc: any = document;
const arrayFrom: any = Array.from;
let inventoryChart: Chart | null = null;

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

export async function cargarInventario() {
  const categoria = doc.getElementById("inventario-filtro-categoria")?.value;
  const consultaProductos = supabase
    .from("productos")
    .select("id, nombre, categoria, unidad, stock, stock_minimo, costo_promedio, activo, id_finca, id_lote")
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
        <td><button class="btn btn-soft btn-sm" data-legacy-click="editarProducto('${producto.id}')">Editar</button> <button class="btn btn-soft btn-sm" data-legacy-click="archivarProducto('${producto.id}')">Archivar</button></td>
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
        <td>${movimiento.activo ? `<button class="btn btn-soft btn-sm" data-legacy-click="anularMovimientoInventario('${movimiento.id}')">Anular</button>` : "—"}</td>
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
  if (!nombre || !idFinca || !idLote || !Number.isFinite(stockMinimo) || stockMinimo < 0) {
    showToast("Escribe el nombre y un mínimo de stock válido.");
    return;
  }

  const valores = { nombre, categoria, unidad, id_finca: idFinca, id_lote: idLote, stock_minimo: stockMinimo };
  const editando = appState.registroEnEdicion?.tipo === "producto";
  const respuesta = editando
    ? await supabase.from("productos").update(valores).eq("id", appState.registroEnEdicion.id)
    : await supabase.from("productos").insert(valores);
  if (respuesta.error) {
    console.error("No se pudo guardar el producto:", respuesta.error);
    showToast(respuesta.error.code === "PGRST204" || respuesta.error.code === "42703"
      ? "Ejecuta inventario_ubicacion_supabase.sql en Supabase y vuelve a intentarlo."
      : "No se pudo guardar el producto. Revisa el SQL y los permisos.");
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
    .single();
  if (error || !producto) {
    console.error("No se pudo cargar el producto para editar:", error);
    showToast("No se pudo abrir el producto para editar.");
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
  const costo = esUsoEnFinca ? 0 : Number(doc.getElementById("mov-precio").value || 0);
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

