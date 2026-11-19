import { lazy, Suspense, useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthScreen } from "./modules/auth/AuthScreen";
import { LandingPage } from "./modules/landing/LandingPage";
import { supabase } from "./lib/supabase";

const LegacyWorkspace = lazy(() => import("./app/LegacyWorkspace").then((module) => ({
  default: module.LegacyWorkspace,
})));

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [hasWorkspace, setHasWorkspace] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [recovering, setRecovering] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryNotice, setRecoveryNotice] = useState("");
  const [recoveryBusy, setRecoveryBusy] = useState(false);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (nextSession) { setHasWorkspace(true); setAuthOpen(false); }
      if (event === "PASSWORD_RECOVERY") { setRecovering(true); setAuthOpen(true); }
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error("No se pudo recuperar la sesión:", error);
      setSession(data.session);
      if (data.session) setHasWorkspace(true);
      setAuthReady(true);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword.length < 8) { setRecoveryNotice("La contraseña debe tener al menos 8 caracteres."); return; }
    if (newPassword !== confirmPassword) { setRecoveryNotice("Las contraseñas no coinciden."); return; }
    setRecoveryBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setRecoveryBusy(false);
    if (error) { setRecoveryNotice("No se pudo actualizar la contraseña. Solicita un nuevo enlace e inténtalo otra vez."); return; }
    setRecovering(false);
    setNewPassword(""); setConfirmPassword(""); setRecoveryNotice("");
  }

  return (
    <>
      {authReady && !session && !authOpen && !recovering && <LandingPage onLogin={() => { setAuthMode("login"); setAuthOpen(true); }} onRegister={() => { setAuthMode("register"); setAuthOpen(true); }} />}
      <AuthScreen visible={authReady && !session && authOpen} initialMode={authMode} onBack={() => setAuthOpen(false)} />
      {hasWorkspace && <Suspense fallback={null}><LegacyWorkspace session={session} /></Suspense>}
      {recovering && <div className="login"><div className="login-box"><div className="login-brand"><h1>Restablecer contraseña</h1><p>Elige una contraseña nueva para tu cuenta.</p></div><form onSubmit={(event) => void updatePassword(event)}>
        <div className="field"><label htmlFor="recovery-password">Nueva contraseña</label><input id="recovery-password" type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></div>
        <div className="field"><label htmlFor="recovery-confirm">Confirmar contraseña</label><input id="recovery-confirm" type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></div>
        <button className="btn btn-primary" type="submit" disabled={recoveryBusy} style={{ width: "100%" }}>{recoveryBusy ? "Guardando…" : "Actualizar contraseña"}</button>
        <p className="login-note" aria-live="polite">{recoveryNotice}</p>
      </form></div></div>}
      <div className="toast" id="toast" role="status" aria-live="polite" />
    </>
  );
}
