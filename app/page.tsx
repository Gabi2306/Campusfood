'use client'

import { useState, useEffect, useRef } from 'react'
import { signIn, signOut, useSession } from 'next-auth/react'
import CafeApp from '@/components/cafe-app'
import { Coffee, Check } from 'lucide-react'

type AuthView = 'login' | 'register'

export default function Page() {
  const { data: session, status } = useSession()

  const [view, setView]           = useState<AuthView>('login')
  const [animating, setAnimating] = useState(false)
  const [visible, setVisible]     = useState<AuthView>('login')

  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [name, setName]           = useState('')
  const [confirm, setConfirm]     = useState('')
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const cardRef = useRef<HTMLDivElement>(null)

  const resetForm = () => {
    setEmail(''); setPassword(''); setName(''); setConfirm('')
    setError(''); setSuccess('')
  }

  const switchView = (v: AuthView) => {
    if (v === view || animating) return
    setAnimating(true)
    resetForm()
    // fade out → swap → fade in
    setTimeout(() => { setVisible(v); setView(v) }, 220)
    setTimeout(() => setAnimating(false), 440)
  }

  // Restringe la altura animada de la card
  useEffect(() => {
    if (cardRef.current) {
      cardRef.current.style.transition = 'none'
    }
  }, [])

  // ── Login ────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    const result = await signIn('credentials', {
      email:    email.trim().toLowerCase(),
      password,
      redirect: false,
    })
    setIsLoading(false)
    if (result?.error) setError('Correo o contraseña incorrectos. Verifica tus datos.')
  }

  // ── Registro ─────────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return }
    setIsLoading(true)
    const res  = await fetch('/api/auth/register', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, email, password }),
    })
    const data = await res.json()
    setIsLoading(false)
    if (!res.ok) { setError(data.error ?? 'Ocurrió un error al registrarte.'); return }
    setSuccess('¡Cuenta creada! Ya puedes iniciar sesión.')
    setTimeout(() => switchView('login'), 2000)
  }

  if (status === 'loading') {
    return (
      <div className="auth-shell">
        <div className="auth-card" style={{ textAlign: 'center', color: 'var(--muted)' }}>
          Cargando sesión...
        </div>
      </div>
    )
  }

  if (session?.user) {
    return (
      <CafeApp
        role={session.user.role as 'admin' | 'student'}
        userName={session.user.name}
        email={session.user.email}
        onLogout={() => signOut({ callbackUrl: '/' })}
      />
    )
  }

  return (
    <div className="auth-shell">
      <div className="auth-card" ref={cardRef}>

        {/* Logo */}
        <div className="auth-mark"><Coffee size={24} /></div>

        {/* Tabs */}
        <div className="auth-tabs">
          <button
            className={view === 'login' ? 'auth-tab-active' : ''}
            onClick={() => switchView('login')}
          >
            Iniciar sesión
          </button>
          <button
            className={view === 'register' ? 'auth-tab-active' : ''}
            onClick={() => switchView('register')}
          >
            Crear cuenta
          </button>
          {/* Píldora deslizante */}
          <span className={`auth-tab-slider ${view === 'register' ? 'right' : 'left'}`} />
        </div>

        {/* Contenido animado */}
        <div className={`auth-body ${animating ? 'auth-body--out' : 'auth-body--in'}`}>

          {/* ── Login ── */}
          {visible === 'login' && (
            <>
              <p className="auth-copy">Ingresa con tu correo institucional para acceder a Café Campus.</p>
              <form onSubmit={handleLogin}>
                <label>
                  Correo electrónico
                  <input type="email" placeholder="estudiante@campusucc.ecu.co"
                    value={email} onChange={(e) => setEmail(e.target.value)} required />
                </label>
                <label>
                  Contraseña
                  <input type="password" placeholder="••••••••"
                    value={password} onChange={(e) => setPassword(e.target.value)} required />
                </label>
                {error && <p className="form-error">{error}</p>}
                <button type="submit" className="primary-button auth-submit" disabled={isLoading}>
                  {isLoading ? 'Verificando...' : 'Entrar a mi cuenta'}
                </button>
              </form>
              <p className="auth-note">
                ¿No tienes cuenta?{' '}
                <button className="auth-link" onClick={() => switchView('register')}>Regístrate aquí</button>
              </p>
            </>
          )}

          {/* ── Registro ── */}
          {visible === 'register' && (
            <>
              <p className="auth-copy">Crea tu cuenta con tu correo institucional.</p>

              {success ? (
                <div className="auth-success">
                  <span className="auth-success-icon"><Check size={20} /></span>
                  <p>{success}</p>
                  <span className="auth-success-sub">Redirigiendo al inicio de sesión...</span>
                </div>
              ) : (
                <form onSubmit={handleRegister}>
                  <label>
                    Nombre completo
                    <input type="text" placeholder="Ej. María García"
                      value={name} onChange={(e) => setName(e.target.value)} required />
                  </label>
                  <label>
                    Correo institucional
                    <input type="email" placeholder="estudiante@campusucc.ecu.co"
                      value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </label>
                  <label>
                    Contraseña
                    <input type="password" placeholder="Mínimo 6 caracteres"
                      value={password} onChange={(e) => setPassword(e.target.value)} required />
                  </label>
                  <label>
                    Confirmar contraseña
                    <input type="password" placeholder="Repite tu contraseña"
                      value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
                  </label>
                  {error && <p className="form-error">{error}</p>}
                  <button type="submit" className="primary-button auth-submit" disabled={isLoading}>
                    {isLoading ? 'Creando cuenta...' : 'Crear mi cuenta'}
                  </button>
                </form>
              )}

              <p className="auth-note">
                ¿Ya tienes cuenta?{' '}
                <button className="auth-link" onClick={() => switchView('login')}>Inicia sesión</button>
              </p>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
