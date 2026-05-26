// build: 2026-05-26 01:37:21 UTC
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [senha,    setSenha]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [erro,     setErro]     = useState('')
  const [mostrar,  setMostrar]  = useState(false)
  const [mounted,  setMounted]  = useState(false)
  const router = useRouter()

  useEffect(() => { setMounted(true) }, [])

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setErro('')
    const res  = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
    })
    const data = await res.json()
    if (data.ok) router.push('/dashboard')
    else { setErro(data.error ?? 'E-mail ou senha incorretos'); setLoading(false) }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300&family=DM+Mono:wght@400;500&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0 }

        .login-root {
          min-height: 100vh;
          display: flex;
          align-items: stretch;
          background: #080e1a;
          font-family: 'DM Sans', sans-serif;
          overflow: hidden;
          position: relative;
        }

        /* ── Lado esquerdo — arte abstrata ────────────────────────── */
        .login-art {
          flex: 1;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .login-art::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 80% 60% at 30% 40%, rgba(99,102,241,0.35) 0%, transparent 60%),
            radial-gradient(ellipse 60% 80% at 70% 70%, rgba(139,92,246,0.25) 0%, transparent 55%),
            radial-gradient(ellipse 50% 50% at 10% 80%, rgba(56,189,248,0.15) 0%, transparent 50%);
          z-index: 0;
        }

        .login-art-content {
          position: relative;
          z-index: 1;
          text-align: center;
          padding: 48px;
        }

        .login-art-title {
          font-size: 44px;
          font-weight: 700;
          color: #fff;
          letter-spacing: -1.5px;
          line-height: 1.1;
          margin-bottom: 16px;
        }

        .login-art-title span {
          background: linear-gradient(135deg, #818cf8, #a78bfa, #38bdf8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .login-art-sub {
          font-size: 15px;
          color: rgba(255,255,255,0.45);
          font-weight: 300;
          letter-spacing: 0.02em;
          line-height: 1.6;
          max-width: 340px;
          margin: 0 auto;
        }

        .login-art-badges {
          display: flex;
          gap: 10px;
          justify-content: center;
          margin-top: 40px;
          flex-wrap: wrap;
        }

        .login-art-badge {
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 99px;
          padding: 6px 14px;
          font-size: 12px;
          color: rgba(255,255,255,0.55);
          font-weight: 500;
          letter-spacing: 0.03em;
        }

        /* ── Lado direito — formulário ─────────────────────────────── */
        .login-form-side {
          width: 480px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px 40px;
          background: rgba(255,255,255,0.03);
          border-left: 1px solid rgba(255,255,255,0.07);
          position: relative;
          backdrop-filter: blur(20px);
        }

        .login-form-wrap {
          width: 100%;
          max-width: 380px;
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 500ms ease, transform 500ms ease;
        }

        .login-form-wrap.visible {
          opacity: 1;
          transform: translateY(0);
        }

        .login-logo-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 40px;
        }

        .login-logo-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: linear-gradient(135deg, #6366f1, #818cf8);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          box-shadow: 0 0 24px rgba(99,102,241,0.5);
          flex-shrink: 0;
        }

        .login-logo-text {
          font-size: 20px;
          font-weight: 700;
          color: #fff;
          letter-spacing: -0.5px;
        }

        .login-logo-text span { color: #818cf8 }

        .login-logo-sub {
          font-size: 11px;
          color: rgba(255,255,255,0.3);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-top: 1px;
        }

        .login-heading {
          font-size: 26px;
          font-weight: 700;
          color: #fff;
          letter-spacing: -0.5px;
          margin-bottom: 8px;
        }

        .login-sub {
          font-size: 14px;
          color: rgba(255,255,255,0.4);
          font-weight: 300;
          margin-bottom: 36px;
          line-height: 1.5;
        }

        .login-field {
          margin-bottom: 20px;
        }

        .login-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: rgba(255,255,255,0.55);
          text-transform: uppercase;
          letter-spacing: 0.07em;
          margin-bottom: 8px;
        }

        .login-input-wrap {
          position: relative;
        }

        .login-input {
          width: 100%;
          height: 52px;
          background: rgba(255,255,255,0.08);
          border: 1.5px solid rgba(255,255,255,0.12);
          border-radius: 12px;
          padding: 0 16px;
          font-size: 15px;
          color: #fff;
          font-family: 'DM Sans', sans-serif;
          outline: none;
          transition: border-color 200ms, background 200ms, box-shadow 200ms;
          color-scheme: dark;
        }

        .login-input::placeholder {
          color: rgba(255,255,255,0.22);
        }

        .login-input:focus {
          border-color: rgba(129,140,248,0.7);
          background: rgba(129,140,248,0.08);
          box-shadow: 0 0 0 4px rgba(129,140,248,0.12);
        }

        .login-input-icon {
          position: absolute;
          right: 16px;
          top: 50%;
          transform: translateY(-50%);
          cursor: pointer;
          color: rgba(255,255,255,0.3);
          font-size: 18px;
          background: none;
          border: none;
          padding: 0;
          display: flex;
          align-items: center;
          transition: color 150ms;
        }

        .login-input-icon:hover { color: rgba(255,255,255,0.6) }

        .login-erro {
          background: rgba(248,113,113,0.12);
          border: 1px solid rgba(248,113,113,0.35);
          border-radius: 10px;
          padding: 12px 16px;
          font-size: 13px;
          color: #fca5a5;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .login-btn {
          width: 100%;
          height: 54px;
          background: linear-gradient(135deg, #6366f1, #818cf8);
          border: none;
          border-radius: 12px;
          color: #fff;
          font-size: 16px;
          font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          transition: opacity 200ms, transform 150ms, box-shadow 200ms;
          box-shadow: 0 0 24px rgba(99,102,241,0.4);
          margin-top: 8px;
          letter-spacing: 0.01em;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .login-btn:hover:not(:disabled) {
          opacity: 0.92;
          transform: translateY(-1px);
          box-shadow: 0 4px 32px rgba(99,102,241,0.6);
        }

        .login-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
          transform: none;
        }

        .login-spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg) } }

        .login-footer {
          text-align: center;
          margin-top: 32px;
          font-size: 12px;
          color: rgba(255,255,255,0.2);
        }

        /* ── Responsive ────────────────────────────────────────────── */
        @media (max-width: 900px) {
          .login-art { display: none }
          .login-form-side {
            width: 100%;
            background: #080e1a;
            border-left: none;
          }
        }

        /* ── Orbs animados de fundo ───────────────────────────────── */
        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
          z-index: 0;
        }
        .orb-1 {
          width: 500px; height: 500px;
          background: rgba(99,102,241,0.18);
          top: -150px; left: -100px;
          animation: drift1 12s ease-in-out infinite alternate;
        }
        .orb-2 {
          width: 400px; height: 400px;
          background: rgba(139,92,246,0.15);
          bottom: -100px; right: -80px;
          animation: drift2 15s ease-in-out infinite alternate;
        }
        .orb-3 {
          width: 300px; height: 300px;
          background: rgba(56,189,248,0.10);
          top: 50%; left: 50%;
          transform: translate(-50%,-50%);
          animation: drift3 18s ease-in-out infinite alternate;
        }

        @keyframes drift1 {
          from { transform: translate(0, 0) scale(1) }
          to   { transform: translate(60px, 40px) scale(1.1) }
        }
        @keyframes drift2 {
          from { transform: translate(0, 0) scale(1) }
          to   { transform: translate(-50px, -30px) scale(1.08) }
        }
        @keyframes drift3 {
          from { transform: translate(-50%,-50%) scale(1) }
          to   { transform: translate(-40%,-60%) scale(1.15) }
        }
      `}</style>

      <div className="login-root">
        {/* Orbs de fundo */}
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />

        {/* ── Lado esquerdo — arte abstrata ─────────────────────── */}
        <div className="login-art">
          {/* SVG abstrato — formas geométricas índigo/violeta */}
          <svg
            style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:0.35 }}
            viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice"
            xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.8"/>
                <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.2"/>
              </linearGradient>
              <linearGradient id="g2" x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.5"/>
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.1"/>
              </linearGradient>
              <linearGradient id="g3" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.6"/>
                <stop offset="100%" stopColor="#ec4899" stopOpacity="0.1"/>
              </linearGradient>
            </defs>
            {/* Hexágonos e formas geométricas */}
            <polygon points="400,50 550,140 550,320 400,410 250,320 250,140" fill="url(#g1)" stroke="rgba(129,140,248,0.3)" strokeWidth="1"/>
            <polygon points="400,100 520,175 520,325 400,400 280,325 280,175" fill="none" stroke="rgba(167,139,250,0.2)" strokeWidth="1"/>
            <polygon points="160,200 280,130 280,270 160,340 40,270 40,130" fill="url(#g2)" stroke="rgba(56,189,248,0.2)" strokeWidth="1"/>
            <polygon points="640,160 760,230 760,370 640,440 520,370 520,230" fill="url(#g3)" stroke="rgba(167,139,250,0.2)" strokeWidth="1"/>
            <polygon points="400,300 480,345 480,435 400,480 320,435 320,345" fill="rgba(99,102,241,0.3)" stroke="rgba(129,140,248,0.4)" strokeWidth="1"/>
            {/* Linhas de conexão */}
            <line x1="280" y1="270" x2="400" y2="300" stroke="rgba(129,140,248,0.25)" strokeWidth="1" strokeDasharray="4,4"/>
            <line x1="520" y1="230" x2="480" y2="300" stroke="rgba(56,189,248,0.2)" strokeWidth="1" strokeDasharray="4,4"/>
            <line x1="400" y1="410" x2="400" y2="480" stroke="rgba(167,139,250,0.2)" strokeWidth="1"/>
            {/* Círculos decorativos */}
            <circle cx="400" cy="230" r="8" fill="rgba(129,140,248,0.6)"/>
            <circle cx="400" cy="230" r="16" fill="none" stroke="rgba(129,140,248,0.3)" strokeWidth="1"/>
            <circle cx="160" cy="270" r="5" fill="rgba(56,189,248,0.5)"/>
            <circle cx="640" cy="300" r="5" fill="rgba(167,139,250,0.5)"/>
            <circle cx="400" cy="390" r="4" fill="rgba(99,102,241,0.8)"/>
            {/* Pontos menores */}
            <circle cx="250" cy="140" r="3" fill="rgba(129,140,248,0.4)"/>
            <circle cx="550" cy="140" r="3" fill="rgba(129,140,248,0.4)"/>
            <circle cx="550" cy="320" r="3" fill="rgba(129,140,248,0.4)"/>
            <circle cx="250" cy="320" r="3" fill="rgba(129,140,248,0.4)"/>
          </svg>

          <div className="login-art-content">
            <div className="login-art-title">
              Gestão de<br/><span>Locações</span><br/>Inteligente
            </div>
            <p className="login-art-sub">
              Controle completo de contratos, equipamentos,
              financeiro e documentos em um só lugar.
            </p>
            <div className="login-art-badges">
              {['📄 Contratos', '🔧 Equipamentos', '💰 Financeiro', '📊 Relatórios'].map(b => (
                <span key={b} className="login-art-badge">{b}</span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Lado direito — formulário ──────────────────────────── */}
        <div className="login-form-side">
          <div className={`login-form-wrap ${mounted ? 'visible' : ''}`}>

            {/* Logo */}
            <div className="login-logo-row">
              <div className="login-logo-icon">L</div>
              <div>
                <div className="login-logo-text">
                  Loca<span>System</span>
                </div>
                <div className="login-logo-sub">Gestão de Locação</div>
              </div>
            </div>

            <h1 className="login-heading">Bem-vindo de volta</h1>
            <p className="login-sub">
              Acesse sua conta para continuar gerenciando suas locações.
            </p>

            {erro && (
              <div className="login-erro">
                <span>⚠</span>
                {erro}
              </div>
            )}

            <form onSubmit={login}>
              <div className="login-field">
                <label className="login-label">E-mail</label>
                <div className="login-input-wrap">
                  <input
                    type="email"
                    className="login-input"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="login-field">
                <label className="login-label">Senha</label>
                <div className="login-input-wrap">
                  <input
                    type={mostrar ? 'text' : 'password'}
                    className="login-input"
                    placeholder="••••••••"
                    value={senha}
                    onChange={e => setSenha(e.target.value)}
                    required
                    style={{ paddingRight: 48 }}
                  />
                  <button
                    type="button"
                    className="login-input-icon"
                    onClick={() => setMostrar(m => !m)}
                    title={mostrar ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {mostrar ? '🙈' : '👁'}
                  </button>
                </div>
              </div>

              <button type="submit" className="login-btn" disabled={loading}>
                {loading ? (
                  <>
                    <div className="login-spinner" />
                    Entrando...
                  </>
                ) : (
                  <>
                    Entrar
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </>
                )}
              </button>
            </form>

            <div className="login-footer">
              © {new Date().getFullYear()} LocaSystem · H8 Digital
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
