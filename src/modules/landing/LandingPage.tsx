import { Icon } from "../../shared/Icon";

export function LandingPage({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  return (
    <main className="landing-page">
      <div className="landing-glow landing-glow-one" aria-hidden="true" />
      <div className="landing-glow landing-glow-two" aria-hidden="true" />
      <nav className="landing-nav">
        <a className="landing-brand" href="#inicio" aria-label="AgroNext inicio">
          <span className="landing-mark"><Icon name="sprout" /></span>
          <span><span className="landing-brand-name">Agro<span>Next</span></span><small>GESTIÓN AGROPECUARIA</small></span>
        </a>
        <div className="landing-nav-links"><a href="#solucion">Solución</a><a href="#modulos">Módulos</a><a href="#flujo">Cómo funciona</a></div>
        <div className="landing-account-actions"><button className="landing-register-btn" onClick={onRegister}>Registrarse</button><button className="landing-login-btn" onClick={onLogin}><Icon name="lock" /> Iniciar sesión</button></div>
      </nav>

      <section className="landing-hero" id="inicio">
        <div className="landing-copy">
          <span className="landing-eyebrow"><i /> CONTROL CLARO PARA CADA JORNADA</span>
          <h1>Tu operación agropecuaria, <em>en un solo lugar.</em></h1>
          <p>Organiza fincas, cultivos, inventario, finanzas y equipo con información conectada y fácil de consultar.</p>
          <div className="landing-hero-actions">
            <button className="landing-primary-btn" onClick={onLogin}>Entrar a AgroNext <span aria-hidden="true">↗</span></button>
            <button className="landing-secondary-link landing-register-link" onClick={onRegister}>Crear cuenta</button>
            <a className="landing-secondary-link" href="#modulos">Conocer los módulos <span>↓</span></a>
          </div>
          <div className="landing-proof"><span className="landing-proof-icon"><Icon name="shield" /></span><span><b>Información organizada</b><small>Seguimiento desde la finca hasta el resultado.</small></span></div>
        </div>

        <div className="landing-visual" aria-label="Vista previa de los módulos de AgroNext">
          <div className="landing-orbit orbit-one" /><div className="landing-orbit orbit-two" />
          <div className="landing-preview-card">
            <div className="landing-preview-head"><span className="landing-preview-logo"><Icon name="sprout" /></span><span><b>AgroNext</b><small>Panel de operación</small></span><i className="landing-live-dot" /></div>
            <div className="landing-preview-welcome"><span>RESUMEN DE TU OPERACIÓN</span><b>Todo conectado.</b><small>Consulta cada área desde un mismo panel.</small></div>
            <div className="landing-preview-stats">
              <div><span className="preview-stat-icon farm-stat"><Icon name="farm" /></span><small>Fincas y lotes</small><b>Organización</b></div>
              <div><span className="preview-stat-icon crop-stat"><Icon name="leaf" /></span><small>Agricultura</small><b>Seguimiento</b></div>
            </div>
            <div className="landing-preview-row"><span className="preview-stat-icon inventory-stat"><Icon name="box" /></span><span><b>Inventario</b><small>Entradas, salidas y existencias</small></span><span className="preview-arrow">↗</span></div>
            <div className="landing-preview-footer"><span><i /> Datos de tu operación</span><span>AgroNext</span></div>
          </div>
          <div className="landing-float-chip"><span className="landing-chip-icon"><Icon name="activity" /></span><span><b>Visibilidad completa</b><small>Del campo a la gestión</small></span></div>
          <div className="landing-float-leaf"><Icon name="leaf" /></div>
        </div>
      </section>

      <section className="landing-modules" id="modulos">
        <div className="landing-section-heading" id="solucion"><span className="landing-eyebrow">UNA HERRAMIENTA, TODA LA OPERACIÓN</span><h2>Cada área conectada con <em>tu trabajo diario.</em></h2><p>Reúne los datos de campo y administración para consultar el estado de la operación sin saltar entre archivos.</p></div>
        <div className="landing-module-grid">
          <article><span className="landing-module-icon"><Icon name="farm" /></span><h3>Fincas y lotes</h3><p>Registra predios, áreas, lotes y usos para mantener su información organizada.</p></article>
          <article><span className="landing-module-icon"><Icon name="leaf" /></span><h3>Producción agrícola</h3><p>Da seguimiento a cultivos activos, labores realizadas y cosechas registradas.</p></article>
          <article><span className="landing-module-icon"><Icon name="cattle" /></span><h3>Gestión pecuaria</h3><p>Consulta animales, ubicación, trazabilidad y registros de producción.</p></article>
          <article><span className="landing-module-icon"><Icon name="box" /></span><h3>Inventario</h3><p>Controla productos, existencias, entradas, salidas y movimientos.</p></article>
          <article><span className="landing-module-icon"><Icon name="coins" /></span><h3>Finanzas</h3><p>Organiza ingresos y gastos para tener una lectura más clara de tus cuentas.</p></article>
          <article><span className="landing-module-icon"><Icon name="users" /></span><h3>Equipo y administración</h3><p>Administra personal, reportes, alertas y actividad del sistema desde un mismo lugar.</p></article>
        </div>
      </section>

      <section className="landing-process" id="flujo">
        <div className="landing-section-heading"><span className="landing-eyebrow">UN FLUJO SENCILLO</span><h2>De la finca a una <em>visión completa.</em></h2><p>AgroNext reúne registros de distintas áreas para que puedas consultar cómo avanza tu operación.</p></div>
        <div className="landing-process-grid">
          <article><span>01</span><div><h3>Organiza tu operación</h3><p>Registra fincas, lotes, cultivos, animales y equipo.</p></div></article>
          <article><span>02</span><div><h3>Actualiza la actividad</h3><p>Anota labores, cosechas, movimientos y novedades cuando ocurren.</p></div></article>
          <article><span>03</span><div><h3>Consulta la información</h3><p>Revisa indicadores, reportes y registros desde los módulos conectados.</p></div></article>
        </div>
      </section>

      <section className="landing-benefits">
        <div className="landing-benefit-copy"><span className="landing-eyebrow">MÁS CLARIDAD EN CADA DECISIÓN</span><h2>Una vista ordenada para <em>trabajar con confianza.</em></h2><p>Encuentra la información que necesitas, sigue los cambios importantes y mantén los datos de la operación en un espacio centralizado.</p><button className="landing-primary-btn" onClick={onLogin}>Ingresar al sistema <span aria-hidden="true">↗</span></button></div>
        <div className="landing-benefit-list"><div><span><Icon name="dashboard" /></span><p><b>Una operación conectada</b><small>Áreas productivas y administrativas en la misma plataforma.</small></p></div><div><span><Icon name="activity" /></span><p><b>Seguimiento de actividad</b><small>Consulta registros y movimientos con más contexto.</small></p></div><div><span><Icon name="shield" /></span><p><b>Acceso protegido</b><small>Inicia sesión para acceder a la información de tu organización.</small></p></div></div>
      </section>

      <section className="landing-final-cta"><span className="landing-eyebrow">AGRONEXT · GESTIÓN AGROPECUARIA</span><h2>Tu trabajo en el campo merece una gestión <em>más clara.</em></h2><p>Ingresa a AgroNext y consulta tu operación desde un espacio diseñado para conectar cada área.</p><button className="landing-primary-btn" onClick={onLogin}><Icon name="lock" /> Iniciar sesión</button></section>
      <footer className="landing-footer"><span>AgroNext · Gestión Agropecuaria</span><button onClick={onLogin}>Iniciar sesión <Icon name="lock" /></button></footer>
    </main>
  );
}
