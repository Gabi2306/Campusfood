// HU-04 — Notificación push / SMS cuando el pedido está listo.
//
// Canales:
//  - inapp: siempre. Se guarda en la tabla Notification (campana de la app).
//  - push:  Web Push (VAPID) a cada dispositivo suscrito. Requiere
//           VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY.
//  - sms:   Twilio, si el estudiante registró su celular y aceptó SMS.
//           Requiere TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN y TWILIO_FROM_NUMBER.
//           Con SMS_PROVIDER="console" el SMS se simula en la terminal (desarrollo).
import webpush from 'web-push'
import { prisma } from '@/lib/prisma'

let vapidReady: boolean | null = null

function ensureWebPush() {
  if (vapidReady !== null) return vapidReady
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    vapidReady = false
    return false
  }
  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:soporte@campusucc.ecu.co', publicKey, privateKey)
    vapidReady = true
  } catch (error) {
    console.error('Configuración VAPID inválida:', error)
    vapidReady = false
  }
  return vapidReady
}

export function getPushPublicKey() {
  return ensureWebPush() ? process.env.VAPID_PUBLIC_KEY! : null
}

export function getSmsMode(): 'twilio' | 'console' | null {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER) return 'twilio'
  if (process.env.SMS_PROVIDER === 'console') return 'console'
  return null
}

export type PushPayload = { title: string; body: string; url?: string; tag?: string; orderId?: number }

export async function sendPushToUser(userId: number, payload: PushPayload) {
  if (!ensureWebPush()) return { sent: 0, failed: 0 }
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } })
  let sent = 0
  let failed = 0

  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        JSON.stringify(payload),
        { TTL: 60 * 60, urgency: 'high' },
      )
      sent += 1
    } catch (error) {
      failed += 1
      const statusCode = (error as { statusCode?: number }).statusCode
      // 404/410: la suscripción expiró o el usuario revocó el permiso.
      if (statusCode === 404 || statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: subscription.id } }).catch(() => undefined)
      } else {
        console.error(`No se pudo enviar push a la suscripción ${subscription.id}:`, error)
      }
    }
  }))

  return { sent, failed }
}

export async function sendSms(to: string, body: string): Promise<'sent' | 'simulated' | 'skipped' | 'failed'> {
  const mode = getSmsMode()
  if (!mode) return 'skipped'
  if (mode === 'console') {
    console.info(`[SMS simulado] → ${to}: ${body}`)
    return 'simulated'
  }

  const sid = process.env.TWILIO_ACCOUNT_SID!
  const token = process.env.TWILIO_AUTH_TOKEN!
  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: process.env.TWILIO_FROM_NUMBER!, Body: body }),
    })
    if (!response.ok) {
      console.error('Twilio rechazó el SMS:', response.status, await response.text())
      return 'failed'
    }
    return 'sent'
  } catch (error) {
    console.error('No se pudo enviar el SMS:', error)
    return 'failed'
  }
}

/**
 * Notifica al estudiante que su pedido está listo por todos los canales disponibles.
 * Es idempotente: si el pedido ya fue notificado no se vuelve a enviar.
 */
export async function notifyOrderReady(orderId: number) {
  const claim = await prisma.order.updateMany({
    where: { id: orderId, status: 'ready', notifiedAt: null },
    data: { notifiedAt: new Date() },
  })
  if (claim.count === 0) return null

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { id: true, name: true, phone: true, smsOptIn: true } },
      items: { include: { menuItem: { select: { name: true } } } },
    },
  })
  if (!order) return null

  const firstName = order.user.name.split(' ')[0]
  const summary = order.items.map((item) => `${item.quantity}× ${item.menuItem.name}`).join(', ')
  const title = `¡Tu pedido #${order.id} está listo!`
  const body = `${firstName}, recógelo en el mostrador de Café Campus. ${summary}.`

  const notification = await prisma.notification.create({
    data: { userId: order.user.id, orderId: order.id, type: 'order_ready', title, body, channels: 'inapp' },
  })

  const [push, sms] = await Promise.all([
    sendPushToUser(order.user.id, { title, body, url: '/?section=orders', tag: `order-${order.id}`, orderId: order.id }),
    order.user.smsOptIn && order.user.phone
      ? sendSms(order.user.phone, `Café Campus: tu pedido #${order.id} está listo. Recógelo en el mostrador.`)
      : Promise.resolve('skipped' as const),
  ])

  const channels = ['inapp']
  if (push.sent > 0) channels.push('push')
  if (sms === 'sent' || sms === 'simulated') channels.push('sms')
  await prisma.notification.update({ where: { id: notification.id }, data: { channels: channels.join(',') } })

  return { notificationId: notification.id, channels, push, sms }
}
