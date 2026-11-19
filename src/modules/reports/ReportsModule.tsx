import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { Icon } from "../../shared/Icon";
import { escapeHtml, showToast } from "../../shared/dom";

type ReportKind = "inventory" | "movements" | "finance" | "payroll";
type Row = Record<string, string | number | boolean | null>;
type ReportPreview = { kind: ReportKind; title: string; rows: Row[] };

const REPORTS: { id: ReportKind; title: string; description: string; icon: "box" | "coins" | "users" }[] = [
  { id: "inventory", title: "Inventario actual", description: "Productos, ubicación, existencias y valorización.", icon: "box" },
  { id: "movements", title: "Movimientos de inventario", description: "Entradas, salidas y usos registrados en el período.", icon: "box" },
  { id: "finance", title: "Estado financiero", description: "Ingresos y egresos registrados en el período.", icon: "coins" },
  { id: "payroll", title: "Nómina", description: "Pagos de nómina por período.", icon: "users" },
];

function xmlEscape(value: unknown): string {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function columnName(index: number): string {
  let name = "";
  for (let number = index + 1; number > 0; number = Math.floor((number - 1) / 26)) name = String.fromCharCode(65 + (number - 1) % 26) + name;
  return name;
}

function makeXlsx(rows: Row[]): Uint8Array {
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const matrix: unknown[][] = [keys, ...rows.map((row) => keys.map((key) => row[key] ?? ""))];
  const sheetRows = matrix.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, colIndex) => {
    const ref = `${columnName(colIndex)}${rowIndex + 1}`;
    return typeof value === "number" && Number.isFinite(value)
      ? `<c r="${ref}"><v>${value}</v></c>`
      : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
  }).join("")}</row>`).join("");
  const files: Record<string, string> = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Informe" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`,
  };
  const encoder = new TextEncoder();
  const bytes = (value: string) => encoder.encode(value);
  const crc32 = (data: Uint8Array) => {
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  for (const [path, content] of Object.entries(files)) {
    const filename = bytes(path);
    const body = bytes(content);
    const crc = crc32(body);
    const local = new Uint8Array(30 + filename.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true); localView.setUint16(4, 20, true); localView.setUint16(6, 0x0800, true);
    localView.setUint32(14, crc, true); localView.setUint32(18, body.length, true); localView.setUint32(22, body.length, true);
    localView.setUint16(26, filename.length, true); local.set(filename, 30);
    localParts.push(local, body);
    const central = new Uint8Array(46 + filename.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true); centralView.setUint16(4, 20, true); centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true); centralView.setUint32(16, crc, true); centralView.setUint32(20, body.length, true);
    centralView.setUint32(24, body.length, true); centralView.setUint16(28, filename.length, true); centralView.setUint32(42, offset, true);
    central.set(filename, 46);
    centralParts.push(central);
    offset += local.length + body.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true); endView.setUint16(8, centralParts.length, true); endView.setUint16(10, centralParts.length, true);
  endView.setUint32(12, centralSize, true); endView.setUint32(16, offset, true);
  const all = [...localParts, ...centralParts, end];
  const output = new Uint8Array(all.reduce((sum, part) => sum + part.length, 0));
  let cursor = 0;
  all.forEach((part) => { output.set(part, cursor); cursor += part.length; });
  return output;
}

function downloadExcel(name: string, rows: Row[]) {
  if (!rows.length) { showToast("No hay registros para exportar con esos filtros."); return; }
  const workbook = makeXlsx(rows);
  const url = URL.createObjectURL(new Blob([workbook.buffer as ArrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function printReport(title: string, rows: Row[]) {
  if (!rows.length) { showToast("No hay registros para imprimir con esos filtros."); return; }
  const printWindow = window.open("", "_blank");
  if (!printWindow) { showToast("Permite las ventanas emergentes para guardar el informe como PDF."); return; }
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const table = `<table><thead><tr>${keys.map((key) => `<th>${escapeHtml(key)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${keys.map((key) => `<td>${escapeHtml(row[key] == null ? "" : String(row[key]))}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  printWindow.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font:12px Arial,sans-serif;color:#17221c;padding:24px}h1{font-size:22px;margin:0 0 6px}p{color:#526258;margin:0 0 18px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #cbd5ce;padding:7px;text-align:left;overflow-wrap:anywhere}th{background:#e8f0ea}tr{break-inside:avoid}@page{size:landscape;margin:14mm}</style></head><body><h1>${escapeHtml(title)}</h1><p>AgroNext · Generado ${escapeHtml(new Date().toLocaleString("es-CO"))} · ${rows.length} registros</p>${table}<script>window.onload=()=>{window.focus();window.print()}</script></body></html>`);
  printWindow.document.close();
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
  const [preview, setPreview] = useState<ReportPreview | null>(null);

  async function exportReport(kind: ReportKind) {
    if (from && to && from > to) { showToast("La fecha inicial no puede ser posterior a la fecha final."); return; }
    setBusy(kind);
    try {
      const rows = await loadReport(kind, from, to);
      const report = REPORTS.find((item) => item.id === kind);
      setPreview({ kind, title: report?.title || "Informe", rows });
      if (rows.length) showToast(`Informe listo: ${rows.length} registros.`);
      else showToast("No hay registros para mostrar con esos filtros.");
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
      downloadExcel("agronext-reportes", combined);
    } catch (error) {
      console.error("No se pudieron generar los reportes:", error);
      showToast("No se pudieron generar todos los reportes. Revisa la configuración de Supabase.");
    } finally { setBusy(null); }
  }

  return <>
    <div className="page-head"><div><h1>Reportes y Analytics</h1><p>Consulta y exporta datos reales de inventario, movimientos, finanzas y nómina.</p></div>
      <div className="actions"><button className="btn btn-primary" disabled={busy !== null} onClick={() => void exportAll()}>{busy === "all" ? "Preparando…" : "Exportar todos (Excel)"}</button></div>
    </div>
    <div className="card" style={{ marginBottom: 18 }}><div className="toolbar">
      <div className="field"><label htmlFor="reporte-desde">Desde</label><input id="reporte-desde" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></div>
      <div className="field"><label htmlFor="reporte-hasta">Hasta</label><input id="reporte-hasta" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></div>
      <span className="muted" style={{ alignSelf: "end" }}>El rango se aplica a los reportes con fecha.</span>
    </div></div>
    <div className="grid module-grid">{REPORTS.map((report) => <article className="card module-card" key={report.id}>
      <div className="module-icon"><Icon name={report.icon} /></div><h3>{report.title}</h3><p>{report.description}</p>
      <button className="btn btn-soft btn-sm" disabled={busy !== null} onClick={() => void exportReport(report.id)}>{busy === report.id ? "Generando…" : preview?.kind === report.id ? "Actualizar vista previa" : "Ver informe"}</button>
    </article>)}</div>
    {preview && <section className="card report-preview" aria-label={`Vista previa: ${preview.title}`}>
      <div className="report-preview-head"><div><span className="eyebrow">VISTA PREVIA DEL INFORME</span><h2>{preview.title}</h2><p>{preview.rows.length.toLocaleString("es-CO")} registros{from || to ? ` · Período: ${from || "inicio"} — ${to || "actualidad"}` : " · Todos los registros"}</p></div>
        <div className="actions"><button className="btn btn-soft" disabled={!preview.rows.length} onClick={() => downloadExcel(`agronext-${preview.kind}`, preview.rows)}>Descargar Excel</button><button className="btn btn-primary" disabled={!preview.rows.length} onClick={() => printReport(preview.title, preview.rows)}>Imprimir / Guardar PDF</button></div>
      </div>
      {preview.rows.length ? <div className="report-preview-table-wrap"><table className="report-preview-table"><thead><tr>{Object.keys(preview.rows[0]).map((key) => <th key={key}>{key.replaceAll("_", " ")}</th>)}</tr></thead><tbody>{preview.rows.slice(0, 100).map((row, index) => <tr key={index}>{Object.keys(preview.rows[0]).map((key) => <td key={key}>{row[key] == null ? "—" : String(row[key])}</td>)}</tr>)}</tbody></table></div> : <p className="report-preview-empty">No hay registros para este informe y período.</p>}
      {preview.rows.length > 100 && <p className="muted report-preview-note">Se muestran los primeros 100 registros en pantalla. Las descargas incluyen los {preview.rows.length.toLocaleString("es-CO")} registros.</p>}
    </section>}
  </>;
}
