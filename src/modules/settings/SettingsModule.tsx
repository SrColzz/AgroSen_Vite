import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import { Icon } from "../../shared/Icon";

type Tab = "general" | "alertas" | "catalogos" | "equipo" | "datos";
type Config = { organizacion: string; zona_horaria: string; moneda: string; unidad_area: string; unidad_peso: string; unidad_volumen: string; tema: string };
type AlertPref = { tipo: string; activo: boolean; anticipacion_dias: number; canal: string; umbral: number };
type CatalogItem = { id: string; nombre: string; activo: boolean };
type Member = { id: string; nombre: string; rol: string };
type AuditEntry = { id: string; tabla: string; accion: string; registro_id: string | null; fecha: string };

const DEFAULT_CONFIG: Config = { organizacion: "AgroNext", zona_horaria: "America/Bogota", moneda: "COP", unidad_area: "ha", unidad_peso: "kg", unidad_volumen: "L", tema: "dark" };
const ALERT_TYPES = ["Stock bajo", "Vencimientos", "Actividades pendientes", "Eventos sanitarios"];
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "general", label: "General", icon: "settings" }, { id: "alertas", label: "Alertas", icon: "bell" },
  { id: "catalogos", label: "Catálogos", icon: "box" }, { id: "equipo", label: "Equipo y acceso", icon: "users" },
  { id: "datos", label: "Datos y actividad", icon: "chart" },
];
const EXPORT_TABLES = ["fincas", "lotes", "cultivos", "productos", "movimientos_inventario", "movimientos_financieros", "animales", "empleados", "alertas", "agrosen_configuracion", "agrosen_preferencias_alerta", "agrosen_catalogos", "agrosen_auditoria"];

function localRead<T>(key: string, fallback: T): T {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}
const accountKey = (key: string, id: string) => `${key}:${id}`;
function csvCell(value: unknown): string {
  const text = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}
function downloadCsv(filename: string, rows: Record<string, unknown>[]): void {
  if (!rows.length) return;
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const csv = [columns.map(csvCell).join(","), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}
function applyInventoryCategories(items: CatalogItem[]): void {
  const builtIns = new Set(["Agrícolas", "Pecuarios", "Herramientas", "Terminados"]);
  ["producto-categoria", "inventario-filtro-categoria"].forEach((id) => {
    const select = document.getElementById(id) as HTMLSelectElement | null;
    if (!select) return;
    const selected = select.value;
    [...select.options].filter((option) => option.dataset.customCatalog === "true").forEach((option) => option.remove());
    items.filter((item) => !builtIns.has(item.nombre)).forEach((item) => {
      const option = new Option(item.nombre, item.nombre);
      option.dataset.customCatalog = "true";
      select.add(option);
    });
    if ([...select.options].some((option) => option.value === selected)) select.value = selected;
  });
}
function applyFormDefaults(settings: Config): void {
  const areaLabel = document.getElementById("finca-area")?.previousElementSibling;
  if (areaLabel) areaLabel.textContent = `Área total (${settings.unidad_area})`;
  document.querySelectorAll<HTMLElement>(".finca-lote-item label[data-area-label]").forEach((label) => { label.textContent = `Área (${settings.unidad_area})`; });
  const weightLabel = document.getElementById("pesaje-peso")?.previousElementSibling;
  if (weightLabel) weightLabel.textContent = `Peso (${settings.unidad_peso})`;
  const productUnit = document.getElementById("producto-unidad") as HTMLSelectElement | null;
  const productionUnit = document.getElementById("produccion-unidad") as HTMLSelectElement | null;
  const mappedWeight = settings.unidad_peso === "t" ? "toneladas" : settings.unidad_peso === "kg" || settings.unidad_peso === "lb" ? settings.unidad_peso : "";
  const mappedVolume = settings.unidad_volumen.toLowerCase() === "l" ? "l" : settings.unidad_volumen.toLowerCase() === "ml" ? "ml" : settings.unidad_volumen.toLowerCase() === "gal" ? "gal" : "";
  const preferredProductUnit = mappedWeight || mappedVolume;
  if (productUnit && preferredProductUnit && [...productUnit.options].some((option) => option.value === preferredProductUnit)) productUnit.value = preferredProductUnit;
  if (productionUnit) {
    const preferred = mappedVolume || mappedWeight;
    if (preferred && [...productionUnit.options].some((option) => option.value === preferred)) productionUnit.value = preferred;
  }
}

export function SettingsModule() {
  const [tab, setTab] = useState<Tab>("general");
  const [user, setUser] = useState<User | null>(null);
  const [profileName, setProfileName] = useState("");
  const [config, setConfig] = useState<Config>(() => {
    const saved = { ...DEFAULT_CONFIG, ...localRead("agrosen-config", DEFAULT_CONFIG) };
    return { ...saved, tema: localStorage.getItem("agrosen-theme") || saved.tema || "dark" };
  });
  const [alerts, setAlerts] = useState<AlertPref[]>(() => localRead("agrosen-alert-preferences", ALERT_TYPES.map((tipo) => ({ tipo, activo: true, anticipacion_dias: 7, canal: "Dashboard", umbral: 0 }))));
  const [catalog, setCatalog] = useState<CatalogItem[]>(() => localRead("agrosen-inventory-categories", []));
  const [members, setMembers] = useState<Member[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [schemaReady, setSchemaReady] = useState(true);

  useEffect(() => { applyFormDefaults(config); }, [config.unidad_area, config.unidad_peso, config.unidad_volumen]);

  const userName = useMemo(() => members.find((member) => member.id === user?.id)?.nombre || profileName || user?.user_metadata?.nombre || user?.email || "Usuario", [members, profileName, user]);

  useEffect(() => {
    let current = true;
    void supabase.auth.getUser().then(({ data: auth }) => { if (current) setUser(auth.user); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (current) setUser(session?.user || null);
    });
    return () => { current = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    let current = true;
    if (!user) return () => { current = false; };
    setMembers([]); setAdmin(false); setProfileName(user.user_metadata?.nombre || "");
    void (async () => {
      const uid = user.id;
      if (localStorage.getItem("agrosen-config-user") !== uid) {
        const accountConfig = { ...DEFAULT_CONFIG, ...localRead(accountKey("agrosen-config", uid), DEFAULT_CONFIG), moneda: "COP" };
        const accountAlerts = localRead<AlertPref[]>(accountKey("agrosen-alert-preferences", uid), ALERT_TYPES.map((tipo) => ({ tipo, activo: true, anticipacion_dias: 7, canal: "Dashboard", umbral: 0 })));
        const accountCatalog = localRead<CatalogItem[]>(accountKey("agrosen-inventory-categories", uid), []);
        localStorage.setItem("agrosen-config-user", uid);
        localStorage.setItem("agrosen-config", JSON.stringify(accountConfig));
        localStorage.setItem("agrosen-theme", accountConfig.tema);
        localStorage.setItem("agrosen-alert-preferences", JSON.stringify(accountAlerts));
        localStorage.setItem("agrosen-inventory-categories", JSON.stringify(accountCatalog));
        document.documentElement.dataset.theme = accountConfig.tema;
        document.documentElement.style.colorScheme = accountConfig.tema;
        window.dispatchEvent(new CustomEvent("agrosen:preferences-updated", { detail: accountConfig }));
        setConfig(accountConfig); setAlerts(accountAlerts); setCatalog(accountCatalog); applyInventoryCategories(accountCatalog);
      }
      const [configRes, alertsRes, catalogRes, memberRes, auditRes] = await Promise.all([
        supabase.from("agrosen_configuracion").select("organizacion,zona_horaria,moneda,unidad_area,unidad_peso,unidad_volumen,tema").eq("id_usuario", uid).maybeSingle(),
        supabase.from("agrosen_preferencias_alerta").select("tipo,activo,anticipacion_dias,canal,umbral").eq("id_usuario", uid),
        supabase.from("agrosen_catalogos").select("id,nombre,activo").eq("id_usuario", uid).eq("tipo", "inventario").eq("activo", true).order("nombre"),
        supabase.from("usuarios").select("id,nombre,rol").order("nombre"),
        supabase.from("agrosen_auditoria").select("id,tabla,accion,registro_id,fecha").order("fecha", { ascending: false }).limit(50),
      ]);
      if (!current) return;
        if (configRes.data) {
        const next = { ...DEFAULT_CONFIG, ...configRes.data, moneda: "COP" };
        setConfig(next);
        localStorage.setItem("agrosen-config", JSON.stringify(next));
          localStorage.setItem(accountKey("agrosen-config", uid), JSON.stringify(next));
        localStorage.setItem("agrosen-theme", next.tema);
        document.documentElement.dataset.theme = next.tema;
        document.documentElement.style.colorScheme = next.tema;
        const crumb = document.getElementById("crumb");
        if (crumb?.parentElement?.firstChild) crumb.parentElement.firstChild.textContent = `${next.organizacion} / `;
        window.dispatchEvent(new CustomEvent("agrosen:preferences-updated", { detail: next }));
      }
      if (alertsRes.data?.length) {
        const defaults = ALERT_TYPES.map((tipo) => ({ tipo, activo: true, anticipacion_dias: 7, canal: "Dashboard", umbral: 0 }));
        const next = defaults.map((base) => alertsRes.data?.find((item) => item.tipo === base.tipo) || base);
        setAlerts(next); localStorage.setItem("agrosen-alert-preferences", JSON.stringify(next)); localStorage.setItem(accountKey("agrosen-alert-preferences", uid), JSON.stringify(next));
      }
      const localCatalog = localRead<CatalogItem[]>(accountKey("agrosen-inventory-categories", uid), []);
      const remoteCatalog = catalogRes.data || [];
      const localOnly = localCatalog.filter((item) => item.id.startsWith("local-") && !remoteCatalog.some((remote) => remote.nombre === item.nombre));
      let syncedCatalog: CatalogItem[] = [];
      if (!catalogRes.error && localOnly.length) {
        const { data } = await supabase.from("agrosen_catalogos").insert(localOnly.map((item) => ({ id_usuario: uid, tipo: "inventario", nombre: item.nombre, activo: true }))).select("id,nombre,activo");
        syncedCatalog = data || [];
      }
      const catalogItems = catalogRes.error ? localCatalog : [...remoteCatalog, ...syncedCatalog, ...localOnly.filter((item) => !syncedCatalog.some((synced) => synced.nombre === item.nombre))];
      setCatalog(catalogItems); applyInventoryCategories(catalogItems);
      localStorage.setItem("agrosen-inventory-categories", JSON.stringify(catalogItems));
      if (memberRes.data) {
        setMembers(memberRes.data);
        setAdmin(["administrador", "admin"].includes(String(memberRes.data.find((member) => member.id === uid)?.rol || "").toLowerCase()));
        setProfileName(memberRes.data.find((member) => member.id === uid)?.nombre || user.user_metadata?.nombre || "");
      }
      if (auditRes.data) setAudit(auditRes.data);
      setSchemaReady(!configRes.error && !alertsRes.error && !catalogRes.error);
    })();
    return () => { current = false; };
  }, [user?.id]);

  async function saveConfig(event?: FormEvent) {
    event?.preventDefault(); if (!user) return;
    setBusy(true); setStatus("");
    const next = { ...config, moneda: "COP" };
    document.documentElement.dataset.theme = next.tema;
    document.documentElement.style.colorScheme = next.tema;
    localStorage.setItem("agrosen-theme", next.tema);
    localStorage.setItem("agrosen-config", JSON.stringify(next));
    localStorage.setItem(accountKey("agrosen-config", user.id), JSON.stringify(next));
    const crumb = document.getElementById("crumb");
    if (crumb?.parentElement?.firstChild) crumb.parentElement.firstChild.textContent = `${next.organizacion} / `;
    applyFormDefaults(next);
    const { error } = await supabase.from("agrosen_configuracion").upsert({ ...next, id_usuario: user.id, actualizado_en: new Date().toISOString() }, { onConflict: "id_usuario" });
    let profileError: { message: string } | null = null;
    const cleanProfileName = profileName.trim();
    if (cleanProfileName) {
      const profileResult = await supabase.from("usuarios").update({ nombre: cleanProfileName }).eq("id", user.id).select("id").maybeSingle();
      profileError = profileResult.error || (!profileResult.data ? { message: "Perfil no encontrado o sin permiso de edición." } : null);
      if (!profileError) {
        setMembers((items) => items.map((item) => item.id === user.id ? { ...item, nombre: cleanProfileName } : item));
        const nameElement = document.getElementById("topbar-nombre"); if (nameElement) nameElement.textContent = cleanProfileName;
        const avatar = document.getElementById("topbar-avatar"); if (avatar) avatar.textContent = cleanProfileName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
      }
    }
    setSchemaReady(!error);
    window.dispatchEvent(new CustomEvent("agrosen:preferences-updated", { detail: next }));
    setStatus(error ? "Preferencias guardadas en este navegador. Ejecuta el script de configuración de Supabase para sincronizarlas con tu cuenta." : profileError ? "Preferencias guardadas, pero no se pudo actualizar el nombre del perfil." : "Preferencias y perfil guardados en tu cuenta.");
    setBusy(false);
  }

  async function saveAlerts(event: FormEvent) {
    event.preventDefault(); if (!user) return;
    setBusy(true); setStatus("");
    localStorage.setItem("agrosen-alert-preferences", JSON.stringify(alerts));
    localStorage.setItem(accountKey("agrosen-alert-preferences", user.id), JSON.stringify(alerts));
    const rows = alerts.map((item) => ({ ...item, id_usuario: user.id }));
    const { error } = await supabase.from("agrosen_preferencias_alerta").upsert(rows, { onConflict: "id_usuario,tipo" });
    window.dispatchEvent(new CustomEvent("agrosen:alert-preferences-updated", { detail: alerts }));
    setSchemaReady(!error);
    setStatus(error ? "Preferencias guardadas en este navegador; falta instalar las tablas de configuración en Supabase." : "Preferencias de alertas guardadas.");
    setBusy(false);
  }

  async function addCategory(event: FormEvent) {
    event.preventDefault(); if (!user || !newCategory.trim()) return;
    setBusy(true);
    const name = newCategory.trim();
    if (["Agrícolas", "Pecuarios", "Herramientas", "Terminados", ...catalog.map((item) => item.nombre)].some((existing) => existing.toLocaleLowerCase("es") === name.toLocaleLowerCase("es"))) {
      setStatus("Esa categoría ya está en el catálogo."); setBusy(false); return;
    }
    const { data, error } = await supabase.from("agrosen_catalogos").insert({ id_usuario: user.id, tipo: "inventario", nombre: name, activo: true }).select("id,nombre,activo").single();
    if (!error && data) { const next = [...catalog, data].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")); setCatalog(next); localStorage.setItem("agrosen-inventory-categories", JSON.stringify(next)); localStorage.setItem(accountKey("agrosen-inventory-categories", user.id), JSON.stringify(next)); applyInventoryCategories(next); setNewCategory(""); setStatus("Categoría añadida al catálogo."); }
    else { const localItem = { id: `local-${Date.now()}`, nombre: name, activo: true }; const next = [...catalog, localItem].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")); setCatalog(next); localStorage.setItem("agrosen-inventory-categories", JSON.stringify(next)); localStorage.setItem(accountKey("agrosen-inventory-categories", user.id), JSON.stringify(next)); applyInventoryCategories(next); setNewCategory(""); setStatus("Categoría guardada en este navegador. Ejecuta el SQL para sincronizarla con tu cuenta."); setSchemaReady(false); }
    setBusy(false);
  }

  async function removeCategory(item: CatalogItem) {
    if (item.id.startsWith("local-")) {
      const next = catalog.filter((entry) => entry.id !== item.id); setCatalog(next); localStorage.setItem("agrosen-inventory-categories", JSON.stringify(next)); if (user) localStorage.setItem(accountKey("agrosen-inventory-categories", user.id), JSON.stringify(next)); applyInventoryCategories(next); return;
    }
    const { data, error } = await supabase.from("agrosen_catalogos").update({ activo: false }).eq("id", item.id).select("id").maybeSingle();
    if (error || !data) { setStatus("No se pudo retirar la categoría."); return; }
    const next = catalog.filter((entry) => entry.id !== item.id); setCatalog(next); localStorage.setItem("agrosen-inventory-categories", JSON.stringify(next)); if (user) localStorage.setItem(accountKey("agrosen-inventory-categories", user.id), JSON.stringify(next)); applyInventoryCategories(next); setStatus("Categoría retirada; los productos existentes conservan su registro.");
  }

  async function changeRole(member: Member, rol: string) {
    if (!admin || !user || member.id === user.id) { setStatus("Solo una persona administradora puede cambiar roles de otros usuarios."); return; }
    const { data, error } = await supabase.from("usuarios").update({ rol }).eq("id", member.id).select("id").maybeSingle();
    if (error || !data) { setStatus("No se pudo cambiar el rol. Instala las políticas de administración incluidas en configuracion_supabase.sql."); return; }
    setMembers((items) => items.map((item) => item.id === member.id ? { ...item, rol } : item)); setStatus("Rol actualizado.");
  }

  async function exportTable(table: string) {
    setBusy(true); setStatus("");
    const { data, error } = await supabase.from(table).select("*").limit(10000);
    if (error) setStatus(`No se pudo exportar ${table}: ${error.message}`);
    else if (!data?.length) setStatus(`No hay datos disponibles para exportar de ${table}.`);
    else { downloadCsv(`agronext-${table}-${new Date().toISOString().slice(0, 10)}.csv`, data as Record<string, unknown>[]); setStatus(`Exportación descargada: ${data.length} registros.`); }
    setBusy(false);
  }

  function updateAlert(index: number, changes: Partial<AlertPref>) {
    setAlerts((items) => items.map((item, position) => position === index ? { ...item, ...changes } : item));
  }

  async function refreshAudit() {
    const { data, error } = await supabase.from("agrosen_auditoria").select("id,tabla,accion,registro_id,fecha").order("fecha", { ascending: false }).limit(50);
    if (!error && data) setAudit(data);
  }

  return <>
    <div className="page-head"><div><span className="eyebrow">Administración</span><h1>Configuración</h1><p>Preferencias, avisos, catálogos y datos de tu operación.</p></div></div>
    {!schemaReady && <div className="card settings-notice"><Icon name="warning" /><span>La configuración está en modo local. Para sincronizarla con tu cuenta, ejecuta <b>configuracion_supabase.sql</b> en el editor SQL de Supabase.</span></div>}
    {status && <div className="card settings-status" role="status">{status}</div>}
    <div className="settings-layout">
      <nav className="settings-tabs" aria-label="Secciones de configuración">{TABS.map((item) => <button key={item.id} className={`settings-tab ${tab === item.id ? "active" : ""}`} onClick={() => { setTab(item.id); if (item.id === "datos") void refreshAudit(); }}><Icon name={item.icon as never} />{item.label}</button>)}</nav>
      <div className="settings-content">
        {tab === "general" && <form className="card settings-panel" onSubmit={(event) => void saveConfig(event)}>
          <div className="card-head"><div><h2>Preferencias generales</h2><span>Se aplican a esta cuenta y a los próximos registros.</span></div></div>
          <div className="grid form-grid settings-fields">
            <div className="field"><label htmlFor="settings-profile">Nombre de perfil</label><input id="settings-profile" value={profileName} onChange={(event) => setProfileName(event.target.value)} maxLength={100} /></div>
            <div className="field"><label htmlFor="settings-org">Nombre de la organización</label><input id="settings-org" value={config.organizacion} onChange={(event) => setConfig({ ...config, organizacion: event.target.value })} maxLength={100} /></div>
            <div className="field"><label htmlFor="settings-timezone">Zona horaria</label><select id="settings-timezone" value={config.zona_horaria} onChange={(event) => setConfig({ ...config, zona_horaria: event.target.value })}><option value="America/Bogota">Colombia (Bogotá)</option><option value="America/Lima">Perú (Lima)</option><option value="America/Mexico_City">México (Ciudad de México)</option><option value="America/Santiago">Chile (Santiago)</option><option value="UTC">UTC</option></select></div>
            <div className="field"><label htmlFor="settings-currency">Moneda de reportes</label><select id="settings-currency" value="COP" disabled><option value="COP">Peso colombiano (COP)</option></select><small className="muted">Los importes del sistema están guardados en COP. La conversión a otras monedas requiere definir y aplicar tasas de cambio.</small></div>
            <div className="field"><label htmlFor="settings-area">Unidad de área</label><select id="settings-area" value={config.unidad_area} onChange={(event) => setConfig({ ...config, unidad_area: event.target.value })}><option value="ha">Hectáreas (ha)</option><option value="m²">Metros cuadrados (m²)</option><option value="ac">Acres (ac)</option></select></div>
            <div className="field"><label htmlFor="settings-weight">Unidad de peso</label><select id="settings-weight" value={config.unidad_peso} onChange={(event) => setConfig({ ...config, unidad_peso: event.target.value })}><option value="kg">Kilogramos (kg)</option><option value="t">Toneladas (t)</option><option value="lb">Libras (lb)</option></select></div>
            <div className="field"><label htmlFor="settings-volume">Unidad de volumen</label><select id="settings-volume" value={config.unidad_volumen} onChange={(event) => setConfig({ ...config, unidad_volumen: event.target.value })}><option value="L">Litros (L)</option><option value="mL">Mililitros (mL)</option><option value="gal">Galones (gal)</option></select></div>
            <div className="field"><label htmlFor="theme-select">Tema de interfaz</label><select id="theme-select" value={config.tema} onChange={(event) => { const tema = event.target.value; setConfig({ ...config, tema }); document.documentElement.dataset.theme = tema; document.documentElement.style.colorScheme = tema; localStorage.setItem("agrosen-theme", tema); }}><option value="dark">Cristal oscuro</option><option value="light">Cristal claro</option></select></div>
          </div>
          <div className="settings-actions"><span className="muted">Sesión: {userName}</span><button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Guardando…" : "Guardar preferencias"}</button></div>
        </form>}

        {tab === "alertas" && <form className="card settings-panel" onSubmit={(event) => void saveAlerts(event)}>
          <div className="card-head"><div><h2>Preferencias de alertas</h2><span>Define qué avisos quieres recibir y con cuánta anticipación.</span></div></div>
          <div className="settings-alert-list">{alerts.map((item, index) => <div className="settings-alert-row" key={item.tipo}>
            <label className="settings-toggle"><input type="checkbox" checked={item.activo} onChange={(event) => updateAlert(index, { activo: event.target.checked })} /><span>{item.tipo}</span></label>
            <label className="field"><span>Anticipación</span><select value={item.anticipacion_dias} onChange={(event) => updateAlert(index, { anticipacion_dias: Number(event.target.value) })}><option value={1}>1 día</option><option value={3}>3 días</option><option value={7}>7 días</option><option value={15}>15 días</option><option value={30}>30 días</option></select></label>
            <label className="field"><span>Canal</span><select value={item.canal} onChange={(event) => updateAlert(index, { canal: event.target.value })}><option>Dashboard</option><option>Email</option><option>Dashboard + Email</option></select></label>
            {item.tipo === "Stock bajo" && <label className="field"><span>Aviso antes del mínimo (%)</span><input type="number" min="0" max="100" value={item.umbral} onChange={(event) => updateAlert(index, { umbral: Number(event.target.value) })} /></label>}
          </div>)}</div>
          <div className="settings-actions"><span className="muted">El envío por correo requiere un servicio de correo configurado.</span><button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Guardando…" : "Guardar alertas"}</button></div>
        </form>}

        {tab === "catalogos" && <div className="card settings-panel">
          <div className="card-head"><div><h2>Catálogo de inventario</h2><span>Administra categorías disponibles para nuevos productos.</span></div></div>
          <form className="settings-add-row" onSubmit={(event) => void addCategory(event)}><input aria-label="Nueva categoría" placeholder="Ej. Semillas" value={newCategory} onChange={(event) => setNewCategory(event.target.value)} maxLength={60} /><button className="btn btn-primary" disabled={busy || !newCategory.trim()}>Añadir categoría</button></form>
          <div className="settings-catalog-list">{["Agrícolas", "Pecuarios", "Herramientas", "Terminados"].map((name) => <div className="settings-catalog-item" key={name}><span>{name}</span><small>Predeterminada</small></div>)}{catalog.map((item) => <div className="settings-catalog-item" key={item.id}><span>{item.nombre}</span><button className="btn btn-soft btn-sm" onClick={() => void removeCategory(item)}>Retirar</button></div>)}</div>
          <p className="settings-help">Las categorías existentes en productos se conservan; retirarlas solo evita seleccionarlas en registros nuevos.</p>
        </div>}

        {tab === "equipo" && <div className="card settings-panel">
          <div className="card-head"><div><h2>Equipo y acceso</h2><span>Usuarios registrados y nivel de acceso de la cuenta.</span></div></div>
          <div className="settings-current-user"><div className="avatar">{String(userName).slice(0, 1).toUpperCase()}</div><div><b>{userName}</b><span>{user?.email}</span></div><span className="status ok">{members.find((member) => member.id === user?.id)?.rol || "Usuario"}</span></div>
          {admin ? <div className="table-wrap"><table className="table"><thead><tr><th>Usuario</th><th>Rol</th><th>Correo</th></tr></thead><tbody>{members.map((member) => <tr key={member.id}><td>{member.nombre || "Usuario"}</td><td>{member.id === user?.id ? <span className="status ok">Administrador (tú)</span> : <select value={member.rol} onChange={(event) => void changeRole(member, event.target.value)}><option>Administrador</option><option>Supervisor</option><option>Operario</option><option>Consulta</option></select>}</td><td>{member.id === user?.id ? user.email : "Protegido por Supabase Auth"}</td></tr>)}</tbody></table></div>
            : <div className="settings-help-card"><Icon name="shield" /><div><b>Acceso de administrador</b><p>La lista del equipo y la edición de roles solo están disponibles para una cuenta administradora. La base actual mantiene los registros aislados por usuario.</p></div></div>}
          <p className="settings-help">Los roles organizan los perfiles, pero la base actual mantiene los datos aislados por usuario: cambiar el rol no comparte fincas ni sustituye las políticas RLS. Tampoco se permite invitar cuentas desde el navegador; se requiere un servicio seguro de servidor.</p>
        </div>}

        {tab === "datos" && <div className="card settings-panel">
          <div className="card-head"><div><h2>Datos y actividad</h2><span>Exporta tus registros y consulta cambios recientes.</span></div></div>
          <div className="settings-export"><label className="field"><span>Datos a exportar (CSV)</span><select id="settings-export-table">{EXPORT_TABLES.map((table) => <option key={table} value={table}>{table.replaceAll("_", " ")}</option>)}</select></label><button className="btn btn-primary" disabled={busy} onClick={() => void exportTable((document.getElementById("settings-export-table") as HTMLSelectElement).value)}><Icon name="file" /> Exportar</button></div>
          <div className="settings-audit-head"><div><h3>Actividad reciente</h3><span>Últimos cambios registrados en la cuenta</span></div></div>
          <div className="table-wrap"><table className="table"><thead><tr><th>Fecha</th><th>Módulo / tabla</th><th>Acción</th><th>Registro</th></tr></thead><tbody>{audit.length ? audit.map((entry) => <tr key={entry.id}><td>{new Date(entry.fecha).toLocaleString("es-CO")}</td><td>{entry.tabla}</td><td>{entry.accion}</td><td>{entry.registro_id || "—"}</td></tr>) : <tr><td className="empty" colSpan={4}>El historial aparecerá después de instalar la auditoría de Supabase.</td></tr>}</tbody></table></div>
          <p className="settings-help">Las exportaciones respetan las políticas RLS del usuario conectado. La auditoría guarda metadatos de acción, tabla y registro; no almacena copias de datos sensibles.</p>
        </div>}
      </div>
    </div>
  </>;
}
