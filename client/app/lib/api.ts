import { clearSession, getStoredToken, markSessionExpired } from './auth'

// ---------------------------------------------------------------------------
// Contract types. Timestamps are epoch milliseconds, distances metres, speeds
// m/s, roughness = RMS vertical acceleration in m/s² (higher = rougher).
// ---------------------------------------------------------------------------

export type TripStatus = 'PENDING' | 'UPLOADING' | 'STORED' | 'PROCESSING' | 'UPLOADED' | 'FAILED'
export type Condition = 'GOOD' | 'FAIR' | 'POOR'
export type HazardSource = 'detected' | 'tagged'

export type TripListItem = {
  trip_id: string
  server_trip_id: string
  device_id: string
  device_model: string | null
  operator_name: string | null
  status: TripStatus | string
  upload_source: string
  start_time: number
  end_time: number | null
  total_samples: number
  total_samples_received: number
  total_chunks_expected: number
  total_chunks_received: number
  road_surface: string | null
  vehicle_type: string | null
  mount_type: string | null
  sampling_profile: string | null
  mount_quality: number | null
  avg_speed: number | null
  total_distance: number | null
  created_at: number
  finalized_at: number | null
  processed_at: number | null
  roughness_avg: number | null
  good_m: number
  fair_m: number
  poor_m: number
  hazard_count: number
  tag_count: number
  notes: string | null
  raw_available: boolean
}

export type TripsResponse = { items: TripListItem[]; total: number }

export type TripDetailResponse = {
  trip: TripListItem
  quality_flags: Record<string, unknown> | null
  notes: string | null
}

export type SegmentProperties = {
  id: number | string
  trip_id: string
  seq: number
  start_ts: number
  length_m: number
  distance_from_start_m: number
  avg_speed: number | null
  sample_count: number
  roughness: number
  condition: Condition
}

export type SegmentFeature = {
  type: 'Feature'
  geometry: { type: 'LineString'; coordinates: [number, number][] }
  properties: SegmentProperties
}

export type SegmentCollection = { type: 'FeatureCollection'; features: SegmentFeature[] }

export type TrackProperties = {
  trip_id: string
  start_ts: number
  end_ts: number
  start: [number, number] // [lon, lat]
  end: [number, number] // [lon, lat]
  distance_m: number
  duration_s: number
  point_count: number
  /** Parallel to geometry.coordinates. Omitted by /analytics/tracks. */
  timestamps?: number[][]
  /** Parallel to geometry.coordinates (m/s). Omitted by /analytics/tracks. */
  speeds?: (number | null)[][]
}

/** Full GPS route; one MultiLineString part per continuous stretch (split at recording gaps). */
export type TrackFeature = {
  type: 'Feature'
  geometry: { type: 'MultiLineString'; coordinates: [number, number][][] }
  properties: TrackProperties
}

export type TrackCollection = { type: 'FeatureCollection'; features: TrackFeature[] }

export type Hazard = {
  id: number | string
  trip_id: string
  ts: number
  lat: number
  lon: number
  source: HazardSource
  kind: string
  magnitude: number | null
  speed: number | null
}

export type HazardCluster = {
  id: number | string
  lat: number
  lon: number
  kind: string
  source: HazardSource
  observations: number
  trip_count: number
  max_magnitude: number | null
  first_seen: number
  last_seen: number
  trip_ids: string[]
}

export type Device = {
  hashed_device_id: string
  model: string | null
  os_version: string | null
  app_version: string | null
  created_at: number
  last_seen_at: number | null
  trip_count: number
  last_trip_at: number | null
  distance_m: number
}

export type Summary = {
  trips_total: number
  trips_processed: number
  trips_pending: number
  trips_failed: number
  devices_total: number
  distance_km: number
  mapped_km: number
  good_km: number
  fair_km: number
  poor_km: number
  hazards_detected: number
  hazards_tagged: number
  last_upload_at: number | null
}

export type RoadAnalysisRow = {
  road_surface: string
  trips: number
  distance_km: number
  samples: number
  mapped_km: number
  avg_roughness: number | null
  good_km: number
  fair_km: number
  poor_km: number
}

export type RoadAnalysisResponse = {
  total_trips: number
  total_distance_km: number
  rows: RoadAnalysisRow[]
}

export type ProcessingHealthResponse = {
  status: string
  interval_seconds: number
  last_run_at: number | null
  next_run_at: number | null
  processed_trips_last_run: number
  cleaned_files_last_run: number
  roughness_fair: number
  roughness_poor: number
  segment_length_m: number
  raw_retention_days: number
}

export type HealthResponse = { status: string }

export type UserResponse = {
  id?: number | string
  username: string
  email: string
  full_name: string | null
  role: string
  is_active?: boolean
}

export type LoginResponse = {
  access_token: string
  token_type: 'bearer'
  user: UserResponse
}

export type WebTripUploadResponse = {
  trip_id: string
  status: string
  chunks_received: number
  samples_received: number
  artifact_path: string | null
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

// VITE_API_URL is the API origin. An empty string means same-origin (production:
// Caddy routes /api/* to FastAPI). Unset falls back to the local uvicorn port.
const API_ORIGIN = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '')
const API_PREFIX = `${API_ORIGIN}/api/v1`

export function getApiBaseUrl() {
  return API_PREFIX
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function errorMessage(error: unknown, fallback = 'Something went wrong') {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

type QueryValue = string | number | boolean | null | undefined

export function buildQuery(params: Record<string, QueryValue>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

async function parseError(response: Response): Promise<string> {
  const fallback = `Request failed (${response.status}${response.statusText ? ` ${response.statusText}` : ''})`
  let text = ''
  try {
    text = await response.text()
  } catch {
    return fallback
  }
  if (!text) return fallback
  try {
    const body = JSON.parse(text) as { detail?: unknown }
    const detail = body?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) => {
          if (typeof item === 'string') return item
          if (item && typeof item === 'object' && 'msg' in item) {
            const loc = Array.isArray((item as { loc?: unknown }).loc)
              ? ((item as { loc: unknown[] }).loc.filter((part) => part !== 'body').join('.'))
              : ''
            const msg = String((item as { msg: unknown }).msg)
            return loc ? `${loc}: ${msg}` : msg
          }
          return null
        })
        .filter(Boolean)
      if (messages.length > 0) return messages.join('; ')
    }
    return fallback
  } catch {
    // Non-JSON body (proxy error page etc.). Never surface HTML.
    if (text.length < 200 && !text.trimStart().startsWith('<')) return text
    return fallback
  }
}

let redirecting = false

function handleUnauthorized() {
  clearSession()
  markSessionExpired()
  if (typeof window !== 'undefined' && !redirecting) {
    redirecting = true
    window.location.assign('/login')
  }
}

async function send(path: string, init: RequestInit = {}, auth = true): Promise<Response> {
  const token = auth ? getStoredToken() : null
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let response: Response
  try {
    response = await fetch(`${API_PREFIX}${path}`, { ...init, headers })
  } catch {
    throw new ApiError(0, 'Cannot reach the API. Check your connection and try again.')
  }

  if (response.status === 401 && token) {
    handleUnauthorized()
    throw new ApiError(401, 'Your session has expired. Please sign in again.')
  }
  if (!response.ok) {
    throw new ApiError(response.status, await parseError(response))
  }
  return response
}

async function request<T>(path: string, init?: RequestInit, auth = true): Promise<T> {
  const response = await send(path, init, auth)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

/** Fetch a file with the bearer token and save it through a blob URL. */
export async function downloadAuthed(path: string, filename: string) {
  const response = await send(path)
  const blob = await response.blob()
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)
  const name = match ? decodeURIComponent(match[1]) : filename

  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

const enc = encodeURIComponent

export function fetchHealth() {
  return request<HealthResponse>('/health', undefined, false)
}

export function loginOperator(username: string, password: string) {
  return request<LoginResponse>(
    '/auth/login',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    },
    false,
  )
}

export function fetchCurrentUser() {
  return request<UserResponse>('/auth/me')
}

export type TripFilters = {
  q?: string
  status?: string
  device_id?: string
  since?: number
  until?: number
}

export function fetchTrips(filters: TripFilters & { limit?: number; offset?: number } = {}) {
  return request<TripsResponse>(`/trips${buildQuery({ limit: 50, offset: 0, ...filters })}`)
}

export function fetchTrip(tripId: string) {
  return request<TripDetailResponse>(`/trips/${enc(tripId)}`)
}

export function fetchTripSegments(tripId: string) {
  return request<SegmentCollection>(`/trips/${enc(tripId)}/segments`)
}

/** Full route for one trip, or null when the server has no GPS track (404). */
export async function fetchTripTrack(tripId: string): Promise<TrackFeature | null> {
  try {
    return await request<TrackFeature>(`/trips/${enc(tripId)}/track`)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

export function fetchTripHazards(tripId: string) {
  return request<{ items: Hazard[] }>(`/trips/${enc(tripId)}/hazards`)
}

export function reprocessTrip(tripId: string) {
  return request<{ trip_id: string; status: string }>(`/trips/${enc(tripId)}/reprocess`, { method: 'POST' })
}

export function deleteTrip(tripId: string) {
  return request<void>(`/trips/${enc(tripId)}`, { method: 'DELETE' })
}

export function downloadTripRaw(tripId: string) {
  return downloadAuthed(`/trips/${enc(tripId)}/download`, `${tripId}.ndjson.gz`)
}

export function uploadWebTrip(formData: FormData) {
  return request<WebTripUploadResponse>('/web/trips/upload', { method: 'POST', body: formData })
}

export function fetchDevices() {
  return request<{ items: Device[] }>('/devices')
}

export function fetchSummary() {
  return request<Summary>('/analytics/summary')
}

export type SegmentFilters = {
  since?: number
  until?: number
  trip_id?: string
  condition?: string
}

export function fetchSegments(filters: SegmentFilters & { limit?: number } = {}) {
  return request<SegmentCollection>(`/analytics/segments${buildQuery({ limit: 20000, ...filters })}`)
}

export type HazardFilters = {
  since?: number
  until?: number
  source?: string
  kind?: string
}

export function fetchHazardClusters(filters: HazardFilters & { limit?: number } = {}) {
  return request<{ items: HazardCluster[] }>(`/analytics/hazards${buildQuery({ limit: 500, ...filters })}`)
}

export function fetchTracks(filters: { since?: number; until?: number; device_id?: string; limit?: number } = {}) {
  return request<TrackCollection>(`/analytics/tracks${buildQuery({ limit: 50, ...filters })}`)
}

export function fetchRoadsAnalysis() {
  return request<RoadAnalysisResponse>('/analytics/roads')
}

export function fetchProcessingHealth() {
  return request<ProcessingHealthResponse>('/analytics/processing-health')
}

export function exportTripsCsv(filters: TripFilters = {}) {
  return downloadAuthed(`/export/trips.csv${buildQuery(filters)}`, 'tayenda-trips.csv')
}

export function exportHazardsCsv(filters: HazardFilters = {}) {
  return downloadAuthed(`/export/hazards.csv${buildQuery(filters)}`, 'tayenda-hazards.csv')
}

export function exportSegmentsGeojson(filters: SegmentFilters = {}) {
  return downloadAuthed(`/export/segments.geojson${buildQuery(filters)}`, 'tayenda-segments.geojson')
}
