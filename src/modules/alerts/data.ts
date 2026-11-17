import { supabase } from "../../lib/supabase";
import { showToast, updateBadgeNotif } from "../../shared/dom";

export type Alerta = {
  id: string;
  tipo: string;
  mensaje: string;
  fecha: string;
  estado: "pendiente" | "vista" | "resuelta";
  modulo_origen: string;
};

export async function cargarAlertas(): Promise<Alerta[]> {
  const { data, error } = await supabase.from("alertas")
    .select("id, tipo, mensaje, fecha, estado, modulo_origen")
    .order("fecha", { ascending: false }).limit(200);
  if (error) {
    console.error("No se pudieron cargar las alertas:", error);
    updateBadgeNotif(0);
    showToast(error.code === "PGRST205" || error.code === "42P01"
      ? "Falta ejecutar rrhh_alertas_supabase.sql en Supabase."
      : "No se pudieron cargar las alertas.");
    return [];
  }
  updateBadgeNotif((data || []).filter((alerta) => alerta.estado === "pendiente").length);
  return data || [];
}

export async function cambiarEstadoAlerta(id: string, estado: "vista" | "resuelta"): Promise<boolean> {
  const { data, error } = await supabase.from("alertas").update({ estado }).eq("id", id).select("id");
  if (error || !data?.length) {
    console.error("No se pudo actualizar la alerta:", error);
    showToast("No se pudo actualizar la alerta.");
    return false;
  }
  showToast(estado === "resuelta" ? "Alerta resuelta." : "Alerta marcada como vista.");
  return true;
}

export async function eliminarAlerta(id: string): Promise<boolean> {
  const { data, error } = await supabase.from("alertas").delete().eq("id", id).select("id").maybeSingle();
  if (error || !data) {
    console.error("No se pudo eliminar la alerta:", error);
    showToast("No se pudo eliminar la alerta.");
    return false;
  }
  showToast("Alerta eliminada permanentemente.");
  return true;
}
