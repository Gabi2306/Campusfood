'use client'

// HU-04 — Notificaciones en la app, push (Web Push) y SMS.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, BellRing, Check, MessageSquare, Smartphone, X } from 'lucide-react'
import { timeAgo } from '@/components/shared'

type AppNotification = {
  id: number
  orderId: number | null
  type: string
  title: string
  body: string
  channels: string
  readAt: string | null
  createdAt: string
}

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (char) => char.charCodeAt(0))
}

const isIos = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)
const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true)

// ══════════════════════════════════════════════════════════════════
// Push: registro del service worker y suscripción del dispositivo
// ══════════════════════════════════════════════════════════════════
export function usePushNotifications() {
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [subscribed, setSubscribed] = useState(false)
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [smsAvailable, setSmsAvailable] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const registration = useRef<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    let cancelled = false
    const pushSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    setSupported(pushSupported)
    setPermission(pushSupported ? Notification.permission : 'unsupported')

    const init = async () => {
      try {
        const response = await fetch('/api/notifications/subscribe', { cache: 'no-store' })
        if (response.ok) {
          const config = await response.json() as { publicKey: string | null; smsAvailable: boolean }
          if (cancelled) return
          setPublicKey(config.publicKey)
          setSmsAvailable(config.smsAvailable)
        }
        if (!pushSupported) return
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
        registration.current = reg
        const existing = await reg.pushManager.getSubscription()
        if (cancelled) return
        setSubscribed(Boolean(existing))
        // Re-sincroniza la suscripción por si cambió de usuario en este dispositivo.
        if (existing) {
          await fetch('/api/notifications/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(existing.toJSON()),
          })
        }
      } catch (initError) {
        console.error('No se pudo inicializar las notificaciones push:', initError)
      }
    }
    void init()
    return () => { cancelled = true }
  }, [])

  const enable = useCallback(async () => {
    setError('')
    if (!supported) {
      setError(isIos() && !isStandalone()
        ? 'En iPhone, agrega Café Campus a la pantalla de inicio (Compartir → Agregar a inicio) para activar las notificaciones.'
        : 'Este navegador no admite notificaciones push.')
      return
    }
    if (!publicKey) {
      setError('El servidor aún no tiene configuradas las notificaciones push (claves VAPID).')
      return
    }
    setBusy(true)
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result !== 'granted') {
        setError('Debes permitir las notificaciones en el navegador para recibir avisos.')
        return
      }
      const reg = registration.current ?? await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.getSubscription() ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })
      const response = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      })
      if (!response.ok) throw new Error('No se pudo registrar este dispositivo.')
      setSubscribed(true)
    } catch (enableError) {
      setError(enableError instanceof Error ? enableError.message : 'No se pudieron activar las notificaciones.')
    } finally {
      setBusy(false)
    }
  }, [publicKey, supported])

  const disable = useCallback(async () => {
    setError('')
    setBusy(true)
    try {
      const subscription = await registration.current?.pushManager.getSubscription()
      if (subscription) {
        await fetch('/api/notifications/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })
        await subscription.unsubscribe()
      }
      setSubscribed(false)
    } catch {
      setError('No se pudieron desactivar las notificaciones en este dispositivo.')
    } finally {
      setBusy(false)
    }
  }, [])

  const sendTest = useCallback(async () => {
    setError('')
    const response = await fetch('/api/notifications/test', { method: 'POST' })
    if (!response.ok) {
      const result = await response.json().catch(() => ({})) as { error?: string }
      setError(result.error ?? 'No se pudo enviar la prueba.')
    }
  }, [])

  return { supported, permission, subscribed, publicKey, smsAvailable, busy, error, enable, disable, sendTest }
}

// ══════════════════════════════════════════════════════════════════
// Campana: lista de avisos + toast cuando llega uno nuevo
// ══════════════════════════════════════════════════════════════════
export function NotificationBell({ onOpenOrders }: { onOpenOrders?: () => void }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AppNotification[]>([])
  const [unread, setUnread] = useState(0)
  const [toast, setToast] = useState<AppNotification | null>(null)
  const lastSeenId = useRef<number | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications', { cache: 'no-store' })
      if (!response.ok) return
      const data = await response.json() as { notifications: AppNotification[]; unread: number }
      setItems(data.notifications)
      setUnread(data.unread)
      const newest = data.notifications[0]
      if (lastSeenId.current !== null && newest && newest.id > lastSeenId.current && !newest.readAt) {
        setToast(newest)
        if ('vibrate' in navigator) navigator.vibrate?.([120, 60, 120])
      }
      lastSeenId.current = newest?.id ?? 0
    } catch {
      /* sin conexión: se reintenta en el siguiente ciclo */
    }
  }, [])

  useEffect(() => {
    void load()
    const interval = window.setInterval(() => { void load() }, 10_000)
    const onVisible = () => { if (document.visibilityState === 'visible') void load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 8_000)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    if (!open) return
    const onClick = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const markAllRead = async () => {
    if (!unread) return
    setUnread(0)
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })))
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    }).catch(() => undefined)
  }

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) void markAllRead()
  }

  return (
    <div className="notif-wrapper" ref={wrapperRef}>
      <button className="icon-button notif-trigger" aria-label={`Notificaciones${unread ? ` (${unread} sin leer)` : ''}`} onClick={toggle}>
        {unread ? <BellRing size={20} /> : <Bell size={20} />}
        {unread > 0 && <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="notif-panel" role="dialog" aria-label="Notificaciones">
          <div className="notif-panel-head">
            <strong>Notificaciones</strong>
            <button className="icon-button" onClick={() => setOpen(false)} aria-label="Cerrar"><X size={17} /></button>
          </div>
          {items.length === 0 ? (
            <div className="notif-empty">
              <span className="empty-icon"><Bell size={22} /></span>
              <p>Sin avisos por ahora</p>
              <span>Te avisaremos cuando tu pedido esté listo.</span>
            </div>
          ) : (
            <ul className="notif-list">
              {items.map((item) => (
                <li key={item.id} className={item.readAt ? '' : 'notif-unread'}>
                  <button onClick={() => { setOpen(false); onOpenOrders?.() }}>
                    <span className="notif-dot" aria-hidden><Check size={13} /></span>
                    <span className="notif-copy">
                      <strong>{item.title}</strong>
                      <span>{item.body}</span>
                      <small>
                        {timeAgo(item.createdAt)}
                        {item.channels.includes('push') && ' · push'}
                        {item.channels.includes('sms') && ' · SMS'}
                      </small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {toast && (
        <div className="notif-toast" role="status" aria-live="polite">
          <span className="notif-toast-icon"><BellRing size={18} /></span>
          <button className="notif-toast-copy" onClick={() => { setToast(null); onOpenOrders?.() }}>
            <strong>{toast.title}</strong>
            <span>{toast.body}</span>
          </button>
          <button className="icon-button" aria-label="Cerrar aviso" onClick={() => setToast(null)}><X size={16} /></button>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// Preferencias: push en este dispositivo + SMS al celular
// ══════════════════════════════════════════════════════════════════
export function NotificationSettings() {
  const push = usePushNotifications()
  const [phone, setPhone] = useState('')
  const [smsOptIn, setSmsOptIn] = useState(false)
  const [savedPhone, setSavedPhone] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/profile', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((profile: { phone: string | null; smsOptIn: boolean } | null) => {
        if (!profile) return
        setSavedPhone(profile.phone)
        setPhone(profile.phone ?? '')
        setSmsOptIn(profile.smsOptIn)
      })
      .catch(() => undefined)
  }, [])

  const saveSms = async (nextOptIn: boolean) => {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() || null, smsOptIn: nextOptIn }),
      })
      const result = await response.json() as { phone?: string | null; smsOptIn?: boolean; error?: string }
      if (!response.ok) throw new Error(result.error ?? 'No se pudo guardar.')
      setSavedPhone(result.phone ?? null)
      setPhone(result.phone ?? '')
      setSmsOptIn(Boolean(result.smsOptIn))
      setMessage(result.smsOptIn ? 'Te enviaremos un SMS cuando tu pedido esté listo.' : 'Preferencias guardadas.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }

  const pushOn = push.subscribed && push.permission === 'granted'

  return (
    <div className="notif-settings">
      <p className="settings-label">AVISOS DE PEDIDO LISTO</p>

      <div className="settings-row">
        <span className="settings-icon"><Smartphone size={18} /></span>
        <div>
          <strong>Notificaciones push</strong>
          <small>
            {pushOn
              ? 'Activas en este dispositivo.'
              : push.permission === 'denied'
                ? 'Bloqueadas. Habilítalas desde los ajustes del navegador.'
                : 'Recibe un aviso aunque la app esté cerrada.'}
          </small>
        </div>
        <button
          className={`switch ${pushOn ? 'switch-on' : ''}`}
          role="switch"
          aria-checked={pushOn}
          aria-label="Notificaciones push"
          disabled={push.busy || push.permission === 'denied'}
          onClick={() => { void (pushOn ? push.disable() : push.enable()) }}
        ><span /></button>
      </div>
      {pushOn && (
        <button className="text-button" onClick={() => { void push.sendTest() }}>Enviar notificación de prueba</button>
      )}
      {push.error && <p className="settings-error" role="alert">{push.error}</p>}

      <div className="settings-row">
        <span className="settings-icon"><MessageSquare size={18} /></span>
        <div>
          <strong>SMS al celular</strong>
          <small>{push.smsAvailable ? 'Útil si no tienes datos móviles.' : 'El envío de SMS aún no está habilitado en la cafetería.'}</small>
        </div>
        <button
          className={`switch ${smsOptIn ? 'switch-on' : ''}`}
          role="switch"
          aria-checked={smsOptIn}
          aria-label="Avisos por SMS"
          disabled={saving || (!smsOptIn && !phone.trim())}
          onClick={() => { void saveSms(!smsOptIn) }}
        ><span /></button>
      </div>
      <div className="phone-field">
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="Celular, ej. 300 123 4567"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          aria-label="Número de celular"
        />
        <button
          className="outline-button"
          disabled={saving || phone.trim() === (savedPhone ?? '')}
          onClick={() => { void saveSms(smsOptIn || Boolean(phone.trim())) }}
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
      {message && <p className="settings-ok">{message}</p>}
      {error && <p className="settings-error" role="alert">{error}</p>}
    </div>
  )
}
