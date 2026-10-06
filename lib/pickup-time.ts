const BUSINESS_TIME_ZONE = 'America/Bogota'
const PICKUP_UTC_OFFSET = '-05:00'

export function getBogotaDateString(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))

  return `${values.year}-${values.month}-${values.day}`
}

export function isValidPickupTime(pickupDate: string, minutes: number, now: Date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pickupDate) || pickupDate !== getBogotaDateString(now)) return false
  if (!Number.isInteger(minutes) || minutes < 8 * 60 || minutes > 18 * 60 || (minutes - 8 * 60) % 30 !== 0) return false

  const [year, month, day] = pickupDate.split('-').map(Number)
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  const calendarDate = new Date(Date.UTC(year, month - 1, day))
  const pickupAt = new Date(`${pickupDate}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00${PICKUP_UTC_OFFSET}`)

  return (
    calendarDate.getUTCFullYear() === year &&
    calendarDate.getUTCMonth() === month - 1 &&
    calendarDate.getUTCDate() === day &&
    pickupAt.getTime() >= now.getTime() + 30 * 60 * 1000
  )
}

export function createPickupDateTime(pickupDate: string, minutes: number) {
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  return new Date(`${pickupDate}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00${PICKUP_UTC_OFFSET}`)
}
