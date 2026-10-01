import type { Condition } from './api'

const dateTimeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
const timeFormat = new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' })

export function formatDate(ms: number | null | undefined) {
  if (ms == null) return '—'
  return dateTimeFormat.format(new Date(ms))
}

export function formatDay(ms: number | null | undefined) {
  if (ms == null) return '—'
  return dateFormat.format(new Date(ms))
}

/** Local time of day with seconds (playback, route endpoints). */
export function formatTime(ms: number | null | undefined) {
  if (ms == null) return '—'
  return timeFormat.format(new Date(ms))
}

export function formatDuration(seconds: number | null | undefined) {
  if (seconds == null || Number.isNaN(seconds)) return '—'
  const total = Math.round(seconds)
  if (total < 60) return `${total} s`
  const minutes = Math.floor(total / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  return `${hours} h ${minutes % 60} min`
}

export function formatRelative(ms: number | null | undefined, now = Date.now()) {
  if (ms == null) return '—'
  const diff = Math.max(0, now - ms)
  const minutes = Math.round(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} h ago`
  return `${Math.round(hours / 24)} d ago`
}

/** API distances are metres everywhere. */
export function formatDistance(metres: number | null | undefined) {
  if (metres == null || Number.isNaN(metres)) return '—'
  if (Math.abs(metres) < 1000) return `${Math.round(metres)} m`
  const km = metres / 1000
  return `${km.toLocaleString(undefined, { maximumFractionDigits: km < 100 ? 1 : 0 })} km`
}

/** Analytics summary/roads endpoints report kilometres. */
export function formatKm(km: number | null | undefined) {
  if (km == null || Number.isNaN(km)) return '—'
  return formatDistance(km * 1000)
}

/** API speeds are m/s; operators think in km/h. */
export function formatSpeed(mps: number | null | undefined) {
  if (mps == null || Number.isNaN(mps)) return '—'
  return `${Math.round(mps * 3.6)} km/h`
}

/** Roughness = RMS vertical acceleration, m/s². */
export function formatRoughness(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return '—'
  return `${value.toFixed(2)} m/s²`
}

export function formatPercent(part: number, total: number) {
  if (!total) return '—'
  return `${Math.round((part / total) * 100)}%`
}

export function formatCoord(lat: number, lon: number) {
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`
}

export function titleCase(value: string | null | undefined) {
  if (!value) return '—'
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// --- Trip status ------------------------------------------------------------

export const TRIP_STATUSES = ['PENDING', 'UPLOADING', 'STORED', 'PROCESSING', 'UPLOADED', 'FAILED'] as const

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  UPLOADING: 'Uploading',
  STORED: 'Stored',
  PROCESSING: 'Processing',
  UPLOADED: 'Processed',
  FAILED: 'Failed',
}

export function statusLabel(status: string) {
  return STATUS_LABELS[status] ?? status
}

export function statusVariant(status: string): 'success' | 'warning' | 'destructive' | 'outline' {
  if (status === 'UPLOADED') return 'success'
  if (status === 'FAILED') return 'destructive'
  if (status === 'UPLOADING' || status === 'PENDING' || status === 'STORED' || status === 'PROCESSING') {
    return 'warning'
  }
  return 'outline'
}

// --- Road condition -----------------------------------------------------------

// Mirrors the theme status tokens in styles.css (--success / --warning /
// --destructive). Literal values because Leaflet writes them into SVG/canvas.
export const CONDITION_COLORS: Record<Condition, string> = {
  GOOD: 'hsl(150, 93%, 32%)',
  FAIR: 'hsl(38, 92%, 48%)',
  POOR: 'hsl(2, 78%, 55%)',
}

export const CONDITION_LABELS: Record<Condition, string> = {
  GOOD: 'Good',
  FAIR: 'Fair',
  POOR: 'Poor',
}

export const HAZARD_COLORS: Record<'detected' | 'tagged', string> = {
  detected: 'hsl(160, 24%, 14%)',
  tagged: 'hsl(262, 58%, 48%)',
}

// Neutral slate for full GPS routes, drawn underneath the condition colours.
export const TRACK_COLOR = 'hsl(215, 16%, 47%)'
export const ROUTE_START_COLOR = 'hsl(150, 93%, 28%)'
export const ROUTE_END_COLOR = 'hsl(2, 70%, 38%)'

export const HAZARD_KINDS = ['JOLT', 'POTHOLE', 'ROUGH', 'FLOOD', 'OBSTRUCTION', 'OTHER'] as const

export function hazardSourceLabel(source: string) {
  return source === 'tagged' ? 'Driver tagged' : source === 'detected' ? 'Detected' : source
}

// --- Time ranges ---------------------------------------------------------------

export type RangeKey = '7' | '30' | '90' | 'all'

export const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
]

export function rangeSince(range: RangeKey, now = Date.now()) {
  if (range === 'all') return undefined
  return now - Number(range) * 24 * 60 * 60 * 1000
}

/** `<input type="date">` value (local day) → epoch ms at start or end of that day. */
export function dateInputToMs(value: string, edge: 'start' | 'end') {
  if (!value) return undefined
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return undefined
  const date = edge === 'start' ? new Date(year, month - 1, day, 0, 0, 0, 0) : new Date(year, month - 1, day, 23, 59, 59, 999)
  return date.getTime()
}
