import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { Icon } from "../../shared/Icon";
import { showToast } from "../../shared/dom";

type ReportKind = "inventory" | "movements" | "finance" | "payroll";
type Row = Record<string, string | number | boolean | null>;

const REPORTS: { id: ReportKind; title: string; description: string; icon: "box" | "coins" | "users" }[] = [
  { id: "inventory", title: "Inventario actual", description: "Productos, ubicación, existencias y valorización.", icon: "box" },
  { id: "movements", title: "Movimientos de inventario", description: "Entradas, salidas y usos registrados en el período.", icon: "box" },
  { id: "finance", title: "Estado financiero", description: "Ingresos y egresos registrados en el período.", icon: "coins" },
  { id: "payroll", title: "Nómina", description: "Pagos de nómina por período.", icon: "users" },
];

function csvValue(value: unknown): string {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(name: string, rows: Row[]) {
  if (!rows.length) { showToast("No hay registros para exportar con esos filtros."); return; }
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const content = `\uFEFF${[keys.map(csvValue).join(";"), ...rows.map((row) => keys.map((key) => csvValue(row[key])).join(";"))].join("\r\n")}`;
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function loadReport(kind: ReportKind, from: string, to: string): Promise<Row[]> {
  if (kind === "inventory") {
    const { data, error } = await supabase.from("productos").select("nombre,categoria,unidad,stock,stock_minimo,costo_promedio,id_finca,id_lote").eq("activo", true).order("nombre");
    if (error) throw error;
    return (data || []).map((item) => ({ ...item, valor_total: Number(item.stock) * Number(item.costo_promedio) }));
  }
  if (kind === "movements") {
    let query = supabase.from("movimientos_inventario").select("tipo,cantidad,costo_unitario,proveedor,detalle,fecha,activo").eq("activo", true).order("fecha", { ascending: false }).limit(5000);
    if (from) query = query.gte("fecha", from);
    if (to) query = query.lte("fecha", `${to}T23:59:59`);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }
  if (kind === "finance") {
    let query = supabase.from("movimientos_financieros").select("tipo,categoria,monto,fecha,descripcion,tercero,finca_id").eq("activo", true).order("fecha", { ascending: false }).limit(5000);
    if (from) query = query.gte("fecha", from);
    if (to) query = query.lte("fecha", to);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }
  let query = supabase.from("nomina").select("periodo,salario_base,deducciones,total_pagado,fecha_pago,empleado_id").order("periodo", { ascending: false }).limit(5000);
  if (from) query = query.gte("fecha_pago", from);
  if (to) query = query.lte("fecha_pago", to);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export function ReportsModule() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState<ReportKind | "all" | null>(null);

  async function exportReport(kind: ReportKind) {
    if (from && to && from > to) { showToast("La fecha inicial no puede ser posterior a la fecha final."); return; }
    setBusy(kind);
    try {
      const rows = await loadReport(kind, from, to);
      downloadCsv(`agronext-${kind}`, rows);
      if (rows.length) showToast(`Reporte exportado: ${rows.length} registros.`);
    } catch (error) {
      console.error("No se pudo generar el reporte:", error);
      showToast("No se pudo generar el reporte. Verifica las tablas y permisos de Supabase.");
    } finally { setBusy(null); }
  }

  async function exportAll() {
    setBusy("all");
    try {
      const reports = await Promise.all(REPORTS.map(async (report) => [report, await loadReport(report.id, from, to)] as const));
      const combined = reports.flatMap(([report, rows]) => rows.map((row) => ({ modulo: report.title, ...row })));
      downloadCsv("agronext-reportes", combined);
    } catch (error) {
      console.error("No se pudieron generar los reportes:", error);
      showToast("No se pudieron generar todos los reportes. Revisa la configuración de Supabase.");
    } finally { setBusy(null); }
  }

  return <>
    <div className="page-head"><div><h1>Reportes y Analytics</h1><p>Consulta y exporta datos reales de inventario, movimientos, finanzas y nómina.</p></div>
      <div className="actions"><button className="btn btn-white" onClick={() => window.print()}><Icon name="file" /> Imprimir página</button><button className="btn btn-primary" disabled={busy !== null} onClick={() => void exportAll()}>{busy === "all" ? "Preparando…" : "Exportar todos (CSV)"}</button></div>
    </div>
    <div className="card" style={{ marginBottom: 18 }}><div className="toolbar">
      <div className="field"><label htmlFor="reporte-desde">Desde</label><input id="reporte-desde" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></div>
      <div className="field"><label htmlFor="reporte-hasta">Hasta</label><input id="reporte-hasta" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></div>
      <span className="muted" style={{ alignSelf: "end" }}>El rango se aplica a los reportes con fecha.</span>
    </div></div>
    <div className="grid module-grid">{REPORTS.map((report) => <article className="card module-card" key={report.id}>
      <div className="module-icon"><Icon name={report.icon} /></div><h3>{report.title}</h3><p>{report.description}</p>
      <button className="btn btn-soft btn-sm" disabled={busy !== null} onClick={() => void exportReport(report.id)}>{busy === report.id ? "Generando…" : "Descargar CSV"}</button>
    </article>)}</div>
    <p className="muted" style={{ marginTop: 14 }}>Los archivos CSV se abren en Excel y conservan los valores originales guardados en la base de datos.</p>
  </>;
}
