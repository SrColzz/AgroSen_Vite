import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { LegacyMarkup } from "./LegacyMarkup";

type Controller = typeof import("./controller");

export function LegacyWorkspace({ session }: { session: Session | null }) {
  const [controller, setController] = useState<Controller | null>(null);

  useEffect(() => {
    let active = true;
    void import("./controller")
      .then(async (legacyController) => {
        if (!active) return;
        setController(legacyController);
        await legacyController.initializeLegacyApp();
      })
      .catch((error) => console.error("No se pudo iniciar AgroSen:", error));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!controller) return;
    if (!session) {
      controller.setTopbarUser(null);
      return;
    }
    let active = true;
    void (async () => {
      const { data: profile, error } = await supabase
        .from("usuarios")
        .select("nombre, rol")
        .eq("id", session.user.id)
        .maybeSingle();
      if (!active) return;
      if (error) console.error("No se pudo cargar el perfil:", error);
      controller.setTopbarUser(profile || {
        nombre: session.user.user_metadata?.nombre || session.user.email?.split("@")[0] || "Usuario",
        rol: "Usuario",
      });
      controller.initProductionChart();
      await controller.cargarDashboard();
    })();
    return () => { active = false; };
  }, [controller, session?.user.id]);

  return <LegacyMarkup authenticated={Boolean(session)} actions={controller?.legacyActions || null} />;
}
