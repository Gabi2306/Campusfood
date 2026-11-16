'use client'

// HU-13 — Perfil editable: nombre completo del estudiante.
// El celular y los avisos por SMS se editan en "Avisos de pedido listo" (HU-04), justo debajo.
import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Check, Loader2, User } from 'lucide-react'
import { PROFILE_NAME_MAX, validateProfileName } from '@/lib/profile-input'

type ProfileData = {
  name: string
  email: string
}

export default function ProfileForm() {
  const { update } = useSession()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [name, setName]       = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError]     = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/profile', { cache: 'no-store' })
      if (!res.ok) throw new Error()
      const data = await res.json() as ProfileData
      setProfile(data)
      setName(data.name)
    } catch {
      setError('No se pudo cargar tu perfil.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!success) return
    const timeout = window.setTimeout(() => setSuccess(false), 3000)
    return () => window.clearTimeout(timeout)
  }, [success])

  const unchanged = profile !== null && name.trim().replace(/\s+/g, ' ') === profile.name

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    const checked = validateProfileName(name)
    if (!checked.ok) {
      setError(checked.error)
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: checked.value }),
      })
      const data = await res.json() as { name?: string; email?: string; error?: string }
      if (!res.ok || !data.name) throw new Error(data.error ?? 'No se pudo guardar.')
      setProfile((prev) => ({ email: prev?.email ?? data.email ?? '', name: data.name as string }))
      setName(data.name)
      // Refresca la sesión para que el nombre cambie en el encabezado sin volver a iniciar sesión.
      // update({}) envía trigger 'update' al callback jwt, que relee el nombre de la base de datos.
      await update({})
      setSuccess(true)
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

  if (!profile) {
    return (
      <div className="profile-form">
        <p className="form-error" role="alert">{error || 'No se pudo cargar tu perfil.'}</p>
        <button type="button" className="outline-button" onClick={() => { void load() }}>Reintentar</button>
      </div>
    )
  }

  return (
    <form className="profile-form" onSubmit={(e) => { void handleSave(e) }} noValidate>
      <p className="profile-section-label">DATOS PERSONALES</p>

      <label className="profile-field">
        <span><User size={13} /> Nombre completo</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tu nombre"
          maxLength={PROFILE_NAME_MAX}
          autoComplete="name"
          required
          aria-invalid={Boolean(error)}
        />
      </label>

      <label className="profile-field">
        <span>Correo institucional</span>
        <input type="email" value={profile.email} disabled />
      </label>

      {error && <p className="form-error" role="alert" style={{ marginTop: 10 }}>{error}</p>}
      {success && (
        <p className="profile-success" role="status">
          <Check size={13} /> Perfil actualizado
        </p>
      )}

      <button
        type="submit"
        className="primary-button profile-save-btn"
        disabled={saving || unchanged}
      >
        {saving ? <><Loader2 size={14} className="spin" /> Guardando...</> : 'Guardar cambios'}
      </button>
    </form>
  )
}
