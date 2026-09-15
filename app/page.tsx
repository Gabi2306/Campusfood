'use client'

import { useState } from 'react'
import CafeApp from '@/components/cafe-app'
import { Coffee } from 'lucide-react'

export default function Page() {
  const [user, setUser] = useState<{ email: string; role: 'admin' | 'student'; name: string } | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    setTimeout(() => {
      setIsLoading(false)
      
      const cleanEmail = email.trim().toLowerCase()

      // Validacion correo
      if (!cleanEmail.endsWith('@campusucc.ecu.co')) {
        setError('Solo se permiten correos institucionales (@campusucc.ecu.co)')
        return
      }

      if (password.length < 6) {
        setError('La contraseña debe tener al menos 6 caracteres')
        return
      }

      // rol para prueba
      const role = cleanEmail.startsWith('admin') ? 'admin' : 'student'
      
      const namePart = cleanEmail.split('@')[0].replace('.', ' ')
      const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1)
      
      setUser({ email: cleanEmail, role, name: formattedName })
    }, 800)
  }

  if (user) {
    return (
      <CafeApp
        role={user.role}
        userName={user.name}
        email={user.email}
        onLogout={() => setUser(null)}
      />
    )
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-mark"><Coffee size={24} /></div>
        <h1>Iniciar sesión</h1>
        <p className="auth-copy">Ingresa con tu correo institucional para acceder a Café Campus.</p>
        
        <form onSubmit={handleLogin}>
          <label>
            Correo electrónico
            <input 
              type="email" 
              placeholder="estudiante@campusucc.ecu.co" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </label>
          <label>
            Contraseña
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </label>
          
          {error && <p className="form-error">{error}</p>}
          
          <button type="submit" className="primary-button auth-submit" disabled={isLoading}>
            {isLoading ? 'Verificando...' : 'Entrar a mi cuenta'}
          </button>
        </form>
        <p className="auth-note">Usa "admin@campusucc.ecu.co" para probar la vista de Administrador.</p>
      </div>
    </div>
  )
}