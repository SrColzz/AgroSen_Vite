import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../../lib/supabase";
import { Icon } from "../../shared/Icon";

export function AuthScreen({ visible, initialMode = "login", onBack }: { visible: boolean; initialMode?: "login" | "register"; onBack?: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [allowAutofill, setAllowAutofill] = useState(false);

  useEffect(() => {
    if (visible) {
      setMode(initialMode);
    } else {
      setMode("login");
      setName("");
      setEmail("");
      setPassword("");
      setConfirmation("");
      setNotice("");
      setAllowAutofill(false);
    }
  }, [visible, initialMode]);

  function clearFields() {
    setName("");
    setEmail("");
    setPassword("");
    setConfirmation("");
  }

  function changeMode(nextMode: "login" | "register") {
    clearFields();
    setNotice("");
    setMode(nextMode);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEmail = email.trim();
    const formPassword = password;
    const formName = name.trim();
    const formConfirmation = confirmation;
    clearFields();

    if (mode === "login") {
      if (!formEmail || !formPassword) {
        setNotice("Ingresa tu correo y contraseña.");
        return;
      }
      setBusy(true);
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: formEmail,
          password: formPassword,
        });
        setNotice(error ? "Credenciales incorrectas." : "");
      } catch (error) {
        console.error("No se pudo iniciar sesión:", error);
        setNotice("No se pudo conectar para iniciar sesión.");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!formName || !formEmail || !formPassword) {
      setNotice("Completa todos los campos para registrarte.");
      return;
    }
    if (formPassword !== formConfirmation) {
      setNotice("Las contraseñas no coinciden.");
      return;
    }

    setBusy(true);
    let data;
    let error;
    try {
      ({ data, error } = await supabase.auth.signUp({
        email: formEmail,
        password: formPassword,
        options: { data: { nombre: formName } },
      }));
    } catch (signupFailure) {
      console.error("No se pudo crear la cuenta:", signupFailure);
      setNotice("No se pudo conectar para crear la cuenta.");
      setBusy(false);
      return;
    }
    setBusy(false);

    if (error) {
      const signupError = `${error.code || ""} ${error.message || ""}`.toLowerCase();
      setNotice(
        signupError.includes("over_email_send_rate_limit") || signupError.includes("email rate limit exceeded")
          ? "Supabase alcanzó el límite de correos. Espera antes de volver a intentarlo."
          : "No se pudo crear la cuenta. Revisa el correo y la contraseña.",
      );
      return;
    }

    setMode("login");
    setNotice(data.session
      ? "Cuenta creada. Ya puedes iniciar sesión."
      : "Cuenta creada. Revisa tu correo para confirmar el registro.");
  }

  async function runAuthUtility(action: "google" | "recover") {
    if (action === "recover") {
      const destination = email.trim();
      if (!destination) { setNotice("Escribe tu correo para enviarte el enlace de recuperación."); return; }
      setBusy(true);
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(destination, { redirectTo: window.location.origin });
        setNotice(error ? "No se pudo enviar el enlace. Verifica el correo y la configuración de Supabase." : "Si existe una cuenta con ese correo, recibirás un enlace para restablecer la contraseña.");
      } catch (error) {
        console.error("No se pudo solicitar la recuperación de contraseña:", error);
        setNotice("No se pudo conectar para enviar el enlace de recuperación.");
      } finally { setBusy(false); }
      return;
    }
    try {
      const legacy = await import("../../app/controller");
      legacy.signInWithGoogle();
    } catch (error) {
      console.error("No se pudo abrir la acción de autenticación:", error);
      setNotice("No se pudo iniciar esa acción.");
    }
  }

  return (
    <div className={`login ${visible ? "" : "hidden"}`}>
      {onBack && <button className="login-back" onClick={onBack} type="button">← Volver al inicio</button>}
      <div className="login-box" key={mode}>
        <div className="login-brand">
          <div className="brand-mark"><Icon name="sprout" /></div>
          <h1>Agro<span style={{ color: "var(--primary)" }}>Next</span></h1>
          <p>{mode === "login" ? "Sistema Integral de Gestión Agropecuaria" : "Crear una cuenta nueva"}</p>
        </div>
        <form onSubmit={submit} autoComplete="off">
          {mode === "register" && <div className="field">
            <label htmlFor="auth-name">Nombre completo</label>
            <input id="auth-name" autoComplete="new-password" autoCapitalize="off" spellCheck={false} readOnly={!allowAutofill} onFocus={() => setAllowAutofill(true)} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej: Ana Torres" />
          </div>}
          <div className="field">
            <label htmlFor="auth-email">Correo electrónico</label>
            <input id="auth-email" type="email" autoComplete="new-password" autoCapitalize="off" spellCheck={false} readOnly={!allowAutofill} onFocus={() => setAllowAutofill(true)} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="correo@ejemplo.com" />
          </div>
          <div className="field">
            <label htmlFor="auth-password">Contraseña</label>
            <input id="auth-password" type="password" autoComplete="new-password" readOnly={!allowAutofill} onFocus={() => setAllowAutofill(true)} value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          {mode === "register" && <div className="field">
            <label htmlFor="auth-confirmation">Confirmar contraseña</label>
            <input id="auth-confirmation" type="password" autoComplete="new-password" readOnly={!allowAutofill} onFocus={() => setAllowAutofill(true)} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
          </div>}
          <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: "100%", marginTop: 8 }}>
            {busy ? "Procesando..." : <><Icon name={mode === "login" ? "lock" : "file"} /> {mode === "login" ? "Iniciar sesión" : "Crear cuenta"}</>}
          </button>
        </form>
        <div className="login-divider">o</div>
        <button className="btn btn-white google-btn" onClick={() => void runAuthUtility("google")} type="button">
          Registrarse o iniciar sesión con Google
        </button>
        {mode === "login" && <div style={{ textAlign: "center", marginTop: 14 }}>
          <button className="btn btn-soft btn-sm" onClick={() => void runAuthUtility("recover")} type="button">¿Olvidaste tu contraseña?</button>
        </div>}
        <div className="login-switch">
          {mode === "login" ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? "}
          <button className="link-btn" onClick={() => changeMode(mode === "login" ? "register" : "login")} type="button">
            {mode === "login" ? "Regístrate" : "Inicia sesión"}
          </button>
        </div>
        <p className="login-note" aria-live="polite">{notice}</p>
      </div>
    </div>
  );
}
