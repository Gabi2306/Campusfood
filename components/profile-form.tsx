'use client'

// RF-11 — Perfil editable: nombre y teléfono del estudiante.
import { useCallback, useEffect, useState } from 'react'
import { Check, Loader2, Phone, User } from 'lucide-react'

type ProfileData = {
  name: string
  email: string
  phone: string | null
  smsOptIn: boolean
  balance: number
}

export default function ProfileForm() {
  const [profile, setProfile]   = useState<ProfileData | null>(null)
  const [name, setName]         = useState('')
  const [phone, setPhone]       = useState('')
  const [smsOptIn, setSmsOptIn] = useState(false)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [success, setSuccess]   = useState(false)
  const [error, setError]       = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/profile', { cache: 'no-store' })
      if (!res.ok) throw new Error()
      const data = await res.json() as ProfileData
      setProfile(data)
      setName(data.name)
      setPhone(data.phone ?? '')
      setSmsOptIn(data.smsOptIn)
    } catch {
      setError('No se pudo cargar tu perfil.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess(false)

    try {
      const res = await fetch('/api/profile', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:    name.trim() || undefined,
          phone:   phone.trim() || null,
          smsOptIn,
        }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'No se pudo guardar.')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="profile-loading">
        <Loader2 size={16} className="spin" /> Cargando perfil...
      </div>
    )
  }

  return (
    <form className="profile-form" onSubmit={(e) => { void handleSave(e) }}>
      <p className="profile-section-label">DATOS PERSONALES</p>

      <label className="profile-field">
        <span><User size={13} /> Nombre completo</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tu nombre"
          maxLength={80}
          required
        />
      </label>

      <label className="profile-field">
        <span>Correo institucional</span>
        <input type="email" value={profile?.email ?? ''} disabled />
      </label>

      <p className="profile-section-label" style={{ marginTop: 16 }}>NOTIFICACIONES SMS</p>

      <label className="profile-field">
        <span><Phone size={13} /> Celular (opcional)</span>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="300 123 4567"
          maxLength={20}
        />
      </label>

      <label className="profile-sms-toggle">
        <input
          type="checkbox"
          checked={smsOptIn}
          onChange={(e) => setSmsOptIn(e.target.checked)}
          disabled={!phone.trim()}
        />
        <span>Recibir SMS cuando mi pedido esté listo</span>
      </label>

      {error   && <p className="form-error"  style={{ marginTop: 10 }}>{error}</p>}
      {success && (
        <p className="profile-success">
          <Check size={13} /> Perfil actualizado
        </p>
      )}

      <button
        type="submit"
        className="primary-button profile-save-btn"
        disabled={saving}
      >
        {saving ? <><Loader2 size={14} className="spin" /> Guardando...</> : 'Guardar cambios'}
      </button>
    </form>
  )
}
